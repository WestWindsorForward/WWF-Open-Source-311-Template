from __future__ import annotations

import base64
import json
import logging
import mimetypes
from pathlib import Path
from typing import Any

import httpx
from google.auth.transport.requests import Request
from google.oauth2 import service_account

from app.core.config import AppConfiguration, get_settings
from app.core.enums import RequestPriority

logger = logging.getLogger(__name__)

settings = get_settings()
config: AppConfiguration = settings.township_config  # type: ignore[assignment]


def _default_priority(category_code: str | None) -> tuple[RequestPriority, str | None]:
    for category in config.issue_categories:
        if category.code == category_code:
            priority_text = (category.default_priority or RequestPriority.MEDIUM.value).lower()
            dept = category.default_department
            try:
                mapped_priority = RequestPriority(priority_text)
            except ValueError:
                mapped_priority = RequestPriority.MEDIUM
            return mapped_priority, dept
    return RequestPriority.MEDIUM, None


def classify_request(description: str, category_code: str | None) -> tuple[RequestPriority, str | None, dict[str, Any] | None]:
    fallback_priority, fallback_department = _default_priority(category_code)

    endpoint = settings.google_vertex_ai_endpoint or _build_gemini_endpoint()
    if not endpoint:
        logger.info("Vertex AI Gemini endpoint not configured; using defaults")
        return fallback_priority, fallback_department, None

    access_token = _get_google_access_token()
    headers = {"Content-Type": "application/json"}
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"

    prompt = _build_prompt(description, category_code)
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "topP": 0.2,
            "maxOutputTokens": 256,
            "responseMimeType": "application/json",
        },
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(endpoint, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:  # pragma: no cover - best effort integration
        logger.warning("Gemini classification failed: %s", exc)
        return fallback_priority, fallback_department, None

    parsed = _parse_gemini_response(data)
    if not parsed:
        return fallback_priority, fallback_department, data

    priority_value = parsed.get("priority") or fallback_priority.value
    department = parsed.get("department") or fallback_department

    try:
        priority = RequestPriority(priority_value.lower())
    except ValueError:
        logger.warning("Gemini returned unknown priority '%s'", priority_value)
        priority = fallback_priority

    return priority, department, parsed


def analyze_request_photo(file_path: str, description: str | None = None) -> dict[str, Any] | None:
    endpoint = settings.google_vertex_ai_endpoint or _build_gemini_endpoint()
    if not endpoint:
        logger.info("Gemini endpoint not configured; skipping photo analysis")
        return None

    access_token = _get_google_access_token()
    headers = {"Content-Type": "application/json"}
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"

    abs_path = Path(settings.uploads_dir) / file_path if not file_path.startswith("/") else Path(file_path)
    if not abs_path.exists():
        logger.warning("Attachment for analysis not found: %s", abs_path)
        return None

    mime_type, _ = mimetypes.guess_type(abs_path.name)
    if not mime_type:
        mime_type = "image/jpeg"

    image_bytes = abs_path.read_bytes()
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    prompt = (
        "Review the uploaded photo for a municipal service request. "
        "Return JSON with fields: issue_type (string), qualitative_summary (string), estimated_severity (one of low, medium, high, emergency), "
        "estimated_depth_cm (number, null if unknown), recommended_action (string), confidence (0-1)."
    )
    if description:
        prompt += f"\nResident description: {description}"

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": prompt},
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": image_b64,
                        }
                    },
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "topP": 0.2,
            "maxOutputTokens": 512,
            "responseMimeType": "application/json",
        },
    }

    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.post(endpoint, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:  # pragma: no cover - best effort integration
        logger.warning("Gemini photo analysis failed: %s", exc)
        return None

    return _parse_gemini_response(data)


def _build_prompt(description: str, category_code: str | None) -> str:
    categories_text = "\n".join(
        f"- {category.code}: {category.label} (default priority {category.default_priority or 'medium'}, department {category.default_department or 'unspecified'})"
        for category in config.issue_categories
    )

    instructions = (
        "You are helping a township triage resident service requests. "
        "Return JSON with keys 'priority' (one of low, medium, high, emergency) and 'department' (a short string). "
        "Consider the description, optional category code, and defaults. If unsure about department, reuse the default for the category or leave a sensible guess."
    )

    return (
        f"{instructions}\n\n"
        f"Township: {config.township.name}\n"
        f"Category code: {category_code or 'unspecified'}\n"
        f"Description: {description}\n\n"
        f"Known categories:\n{categories_text}"
    )


def _parse_gemini_response(data: dict[str, Any]) -> dict[str, Any] | None:
    try:
        candidates = data.get("candidates", [])
        if not candidates:
            return None
        parts = candidates[0]["content"]["parts"]
        text = "".join(part.get("text", "") for part in parts)
        if not text:
            return None
        return json.loads(text)
    except (KeyError, json.JSONDecodeError, TypeError) as exc:
        logger.warning("Failed to parse Gemini response: %s", exc)
        return None


def _build_gemini_endpoint() -> str | None:
    project = settings.google_vertex_ai_project
    location = settings.google_vertex_ai_location
    model = settings.google_vertex_ai_model

    if not (project and location):
        return None

    if not model:
        model = "gemini-1.5-flash"

    if "/models/" not in model:
        model = f"publishers/google/models/{model}"

    return (
        f"https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/{model}:generateContent"
    )


def _get_google_access_token() -> str | None:
    if not settings.google_application_credentials:
        return None

    credentials_path = Path(settings.google_application_credentials)
    if not credentials_path.exists():
        logger.warning("Google credentials file not found at %s", credentials_path)
        return None

    creds = service_account.Credentials.from_service_account_file(
        credentials_path,
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )
    creds.refresh(Request())
    return creds.token
