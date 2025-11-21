#!/usr/bin/env python3
"""
Interactive first-boot wizard for plug-and-play appliances.

The script guides the operator through providing the minimum configuration
required to bring Township online (admin credentials and domain settings),
then invokes the standard setup bootstrapper with those answers.

It creates a sentinel file so subsequent boots do not re-run the wizard.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from getpass import getpass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
STATE_DIR = Path(os.environ.get("TOWNSHIP_STATE_DIR", "/var/lib/township"))
STATE_FILE = STATE_DIR / "appliance_state.json"
SETUP_SCRIPT = PROJECT_ROOT / "scripts" / "setup_township.sh"


def prompt(text: str, *, default: str | None = None, validator: callable | None = None) -> str:
    while True:
        suffix = f" [{default}]" if default else ""
        value = input(f"{text}{suffix}: ").strip()
        if not value and default is not None:
            value = default
        if not value:
            print("Value is required.")
            continue
        if validator and not validator(value):
            continue
        return value


def prompt_password() -> str:
    while True:
        pwd = getpass("Admin password: ")
        confirm = getpass("Confirm password: ")
        if pwd != confirm:
            print("Passwords do not match. Try again.")
            continue
        if len(pwd) < 8:
            print("Password must be at least 8 characters.")
            continue
        return pwd


def ensure_state_dir() -> None:
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
    except PermissionError:
        print(f"Unable to create state directory at {STATE_DIR}. Run as root or set TOWNSHIP_STATE_DIR.")
        sys.exit(1)


def run_setup(admin_email: str, admin_password: str, admin_name: str, app_domain: str, public_url: str) -> None:
    cmd = [
        str(SETUP_SCRIPT),
        "--reset",
        "--admin-email",
        admin_email,
        "--admin-password",
        admin_password,
        "--admin-name",
        admin_name,
        "--domain",
        app_domain,
        "--public-url",
        public_url,
    ]
    print("\nStarting Township bootstrap...\n")
    subprocess.run(cmd, check=True)


def main() -> None:
    if not SETUP_SCRIPT.exists():
        print(f"Bootstrap script not found at {SETUP_SCRIPT}")
        sys.exit(1)

    ensure_state_dir()
    if STATE_FILE.exists():
        print("Appliance already configured; skipping first-boot wizard.")
        return

    print(
        """
==========================================
  Township Appliance First-Boot Wizard
==========================================
"""
    )
    print("This wizard will collect the minimum details needed to bring your deployment online.\n")

    admin_email = prompt("Admin email")
    admin_name = prompt("Admin display name", default="Township Administrator")
    admin_password = prompt_password()
    app_domain = prompt("Hostname (APP_DOMAIN)", default=":80")
    public_url = prompt("Public URL", default=f"http://{app_domain}" if app_domain != ":80" else "http://localhost")

    try:
        run_setup(admin_email, admin_password, admin_name, app_domain, public_url)
    except subprocess.CalledProcessError as exc:
        print(f"\nBootstrap failed with exit code {exc.returncode}. See installer output above.")
        sys.exit(exc.returncode)

    STATE_FILE.write_text(
        json.dumps(
            {
                "admin_email": admin_email,
                "admin_name": admin_name,
                "app_domain": app_domain,
                "public_url": public_url,
            },
            indent=2,
        )
    )

    print(
        f"""
✅ First-boot configuration complete.

Visit {public_url}/login to sign in with the admin account you just created.
Re-run this wizard manually only if you intend to reset the appliance (remove {STATE_FILE} first).
"""
    )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nWizard cancelled by user.")
        sys.exit(1)
