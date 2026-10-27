#!/usr/bin/env python3
"""
manage_admin.py

Secure Administrative Management CLI for Smart Healthcare.
Enables the system owner to inspect administrator accounts and provision the
initial Super Administrator safely without exposing credentials or modifying code.

Usage:
  python manage_admin.py status
  python manage_admin.py create-super-admin
"""

import sys
import os
import re
import uuid
import getpass
from datetime import datetime, timezone
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from werkzeug.security import generate_password_hash, check_password_hash


def _mask_email(email: str) -> str:
    email = str(email or '').strip()
    if '@' not in email:
        return email
    name, domain = email.split('@', 1)
    if len(name) <= 2:
        masked = name[0] + '*' if name else '*'
    else:
        masked = f"{name[0]}{'*' * (len(name) - 2)}{name[-1]}"
    return f"{masked}@{domain}"


def _is_valid_email(email: str) -> bool:
    return bool(re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', str(email or '').strip()))


def _init_firebase_db():
    import firebase_admin
    from firebase_admin import credentials, db

    if not firebase_admin._apps:
        cred_json = os.getenv('FIREBASE_CREDENTIALS_JSON')
        if cred_json:
            import json
            cred = credentials.Certificate(json.loads(cred_json))
        else:
            key_path = BASE_DIR / "firebase_key.json"
            if not key_path.exists():
                raise FileNotFoundError(
                    f"Firebase key not found at {key_path}. "
                    "Set FIREBASE_CREDENTIALS_JSON or place firebase_key.json in project root."
                )
            cred = credentials.Certificate(str(key_path))

        db_url = os.getenv(
            'FIREBASE_DATABASE_URL',
            'https://smart-health-care-cd723-default-rtdb.asia-southeast1.firebasedatabase.app/'
        )
        firebase_admin.initialize_app(cred, {'databaseURL': db_url})

    return db.reference('admins')


def cmd_status():
    """Safely inspects administrator presence without exposing passwords, hashes, or tokens."""
    try:
        admin_ref = _init_firebase_db()
        raw_admins = admin_ref.get() or {}
    except Exception as err:
        print(f"[ERROR] Failed to query database: {err}")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("SMART HEALTHCARE — ADMINISTRATOR ACCOUNT STATUS AUDIT")
    print("=" * 60)

    if not isinstance(raw_admins, dict) or not raw_admins:
        print("Status: NO ADMINISTRATOR ACCOUNTS FOUND")
        print("Summary: Database has 0 administrator records.")
        print("Action Needed: Run 'python manage_admin.py create-super-admin' to initialize.")
        print("=" * 60 + "\n")
        return

    super_admin_count = 0
    hospital_admin_count = 0
    accounts_summary = []

    for key, data in raw_admins.items():
        if not isinstance(data, dict):
            continue
        role = str(data.get('role') or 'unknown').lower()
        is_active = bool(data.get('isActive', True)) and data.get('status') != 'deactivated'
        masked_email = _mask_email(data.get('email') or key.replace(',', '.'))
        created_at = data.get('createdAt') or 'N/A'
        admin_id = data.get('id') or data.get('adminId') or 'N/A'

        if role == 'super_admin':
            if is_active:
                super_admin_count += 1
        elif role == 'hospital_admin':
            if is_active:
                hospital_admin_count += 1

        accounts_summary.append({
            'id': admin_id,
            'email': masked_email,
            'role': role,
            'active': is_active,
            'createdAt': created_at,
        })

    print(f"Total Accounts: {len(accounts_summary)}")
    print(f"Active Super Administrators: {super_admin_count}")
    print(f"Active Hospital Administrators: {hospital_admin_count}")
    print("-" * 60)
    print(f"{'Admin ID':<20} {'Masked Email':<25} {'Role':<15} {'Status':<10}")
    print("-" * 60)
    for acc in accounts_summary:
        status_label = "ACTIVE" if acc['active'] else "INACTIVE"
        print(f"{acc['id']:<20} {acc['email']:<25} {acc['role']:<15} {status_label:<10}")
    print("=" * 60 + "\n")


def cmd_create_super_admin():
    """Interactively provisions a Super Administrator with hidden password input and strong validation."""
    try:
        admin_ref = _init_firebase_db()
        raw_admins = admin_ref.get() or {}
    except Exception as err:
        print(f"[ERROR] Failed to connect to database: {err}")
        sys.exit(1)

    has_super = False
    if isinstance(raw_admins, dict):
        for data in raw_admins.values():
            if isinstance(data, dict) and str(data.get('role') or '').lower() == 'super_admin' and data.get('isActive') is not False:
                has_super = True
                break

    if has_super:
        print("\n[WARNING] An active Super Administrator account already exists in this database.")
        print("To protect against accidental privilege escalation or account takeover,")
        print("creating an additional Super Administrator requires explicit confirmation.\n")
        confirm = input("Type 'CONFIRM' to proceed with creating another Super Administrator: ").strip()
        if confirm != 'CONFIRM':
            print("Operation aborted by user.")
            sys.exit(0)

    print("\n--- Provision Initial Super Administrator ---")
    name = input("Enter Administrator Full Name (e.g. Lead Health Director): ").strip()
    if not name:
        name = "System Super Administrator"

    email = input("Enter Administrator Email: ").strip().lower()
    if not _is_valid_email(email):
        print("[ERROR] Invalid email address format.")
        sys.exit(1)

    sanitized_key = email.replace('.', ',')
    existing = admin_ref.child(sanitized_key).get()
    if existing:
        print(f"[ERROR] An account already exists for {email}. Refusing to overwrite.")
        sys.exit(1)

    password = getpass.getpass("Enter Administrator Password (hidden, min 10 chars): ").strip()
    if len(password) < 10:
        print("[ERROR] Password must be at least 10 characters long.")
        sys.exit(1)

    insecure_defaults = {
        'admin@smarthealth2026!',
        'changemeinproduction!2026',
        'admin',
        'password',
        '12345678',
        'admin123',
        'smarthealth',
        'secret',
    }
    if password.lower() in insecure_defaults:
        print("[ERROR] Password matches an insecure known default. Choose a unique, strong password.")
        sys.exit(1)

    confirm_password = getpass.getpass("Confirm Administrator Password: ").strip()
    if password != confirm_password:
        print("[ERROR] Passwords do not match.")
        sys.exit(1)

    admin_id = f"ADMIN-ROOT-{uuid.uuid4().hex[:6].upper()}"
    record = {
        'id': admin_id,
        'adminId': admin_id,
        'email': email,
        'name': name,
        'role': 'super_admin',
        'isActive': True,
        'passwordHash': generate_password_hash(password),
        'createdAt': datetime.now(timezone.utc).isoformat(),
        'provisionMethod': 'cli_manual_provisioning',
    }

    try:
        admin_ref.child(sanitized_key).set(record)
        print("\n" + "=" * 60)
        print("[SUCCESS] Super Administrator provisioned successfully!")
        print(f"Admin ID:     {admin_id}")
        print(f"Masked Email: {_mask_email(email)}")
        print(f"Role:         super_admin")
        print("You can now sign in at: /login -> Administrator Sign In")
        print("=" * 60 + "\n")
    except Exception as err:
        print(f"[ERROR] Failed to save administrator record: {err}")
        sys.exit(1)


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ('-h', '--help', 'help'):
        print(__doc__)
        print("Available Commands:")
        print("  status              - Audit administrator accounts safely (no secrets exposed)")
        print("  create-super-admin  - Interactively provision a new Super Administrator")
        sys.exit(0)

    cmd = sys.argv[1].lower()
    if cmd == 'status':
        cmd_status()
    elif cmd in ('create-super-admin', 'create_super_admin', 'create'):
        cmd_create_super_admin()
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)
        sys.exit(1)


if __name__ == '__main__':
    main()
