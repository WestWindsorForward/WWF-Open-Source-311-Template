"""
Translation service using LibreTranslate (self-hosted, free).
Uses in-memory cache to minimize translation calls.
Falls back gracefully when translation service is unavailable.
"""
from typing import Optional, Dict, List
import logging
import httpx
import os

logger = logging.getLogger(__name__)

# In-memory translation cache: {("text", "target_lang"): "translated_text"}
_translation_cache: Dict[tuple, str] = {}

# LibreTranslate API URL (internal Docker network)
LIBRETRANSLATE_URL = os.getenv("LIBRETRANSLATE_URL", "http://libretranslate:5000")


async def translate_text(
    text: str,
    source_lang: str = "en",
    target_lang: str = "es"
) -> Optional[str]:
    """
    Translate text using LibreTranslate API.
    Uses in-memory cache to minimize API calls.
    Returns None if translation fails (graceful degradation).
    """
    if not text or not text.strip():
        return text
        
    if source_lang == target_lang:
        return text
    
    # Check cache first
    cache_key = (text, target_lang)
    if cache_key in _translation_cache:
        return _translation_cache[cache_key]
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{LIBRETRANSLATE_URL}/translate",
                json={
                    "q": text,
                    "source": source_lang,
                    "target": target_lang,
                    "format": "text"
                }
            )
            response.raise_for_status()
            result = response.json()
            
            if "translatedText" in result:
                translated = result["translatedText"]
                # Cache the result
                _translation_cache[cache_key] = translated
                logger.info(f"Translated and cached: '{text[:30]}...' -> '{translated[:30]}...'")
                return translated
            return None
    except httpx.ConnectError:
        logger.warning("LibreTranslate not available - translation service offline")
        return None
    except Exception as e:
        logger.error(f"Translation failed ({source_lang} -> {target_lang}): {e}")
        return None


async def translate_service_response(service_dict: dict, target_lang: str) -> dict:
    """
    Translate service response dict without modifying database.
    Returns a new dict with translated fields.
    """
    if target_lang == 'en':
        return service_dict
    
    result = dict(service_dict)
    
    # Translate service name
    if result.get('service_name'):
        translated = await translate_text(result['service_name'], 'en', target_lang)
        if translated:
            result['service_name'] = translated
    
    # Translate description
    if result.get('description'):
        translated = await translate_text(result['description'], 'en', target_lang)
        if translated:
            result['description'] = translated
    
    return result


async def auto_translate_object(
    obj: dict, 
    fields: List[str],
    target_languages: Optional[List[str]] = None
) -> Dict[str, dict]:
    """
    Auto-translate specific fields of an object to multiple languages.
    Returns a dict of {lang_code: translated_object}.
    """
    if target_languages is None:
        target_languages = list(get_supported_languages().keys())
        target_languages.remove("en")  # Don't translate to English
    
    translations = {}
    for lang in target_languages:
        translated_obj = dict(obj)
        for field in fields:
            if field in obj and obj[field]:
                translated = await translate_text(obj[field], "en", lang)
                if translated:
                    translated_obj[field] = translated
        translations[lang] = translated_obj
    
    return translations


def get_supported_languages() -> Dict[str, str]:
    """Get list of supported language codes and names."""
    return {
        "en": "English",
        "es": "Español", 
        "zh": "中文",
        "fr": "Français",
        "hi": "हिन्दी",
        "ar": "العربية"
    }


async def check_translation_service() -> bool:
    """Check if LibreTranslate is available."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{LIBRETRANSLATE_URL}/languages")
            return response.status_code == 200
    except Exception:
        return False


def clear_translation_cache():
    """Clear the translation cache."""
    global _translation_cache
    _translation_cache = {}
    logger.info("Translation cache cleared")
