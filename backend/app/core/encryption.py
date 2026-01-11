"""
Encryption utilities for protecting sensitive data at rest.

Uses Fernet symmetric encryption (AES-128-CBC with HMAC) derived from 
the application's SECRET_KEY environment variable.

Government compliance: Secrets are encrypted before storage and 
decrypted only when needed by authorized services.
"""

import base64
import hashlib
import logging
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken
from functools import lru_cache

logger = logging.getLogger(__name__)

# Prefix used to identify encrypted values
ENCRYPTED_PREFIX = "gAAAA"  # Fernet tokens always start with this


def _derive_key(secret_key: str) -> bytes:
    """
    Derive a Fernet-compatible key from the application's SECRET_KEY.
    
    Uses SHA-256 to hash the secret key, then base64 encodes it to create
    a valid 32-byte Fernet key.
    
    Args:
        secret_key: The application's SECRET_KEY from environment
        
    Returns:
        A base64-encoded 32-byte key suitable for Fernet
    """
    # Hash the secret key to get consistent 32 bytes
    digest = hashlib.sha256(secret_key.encode()).digest()
    # Fernet requires url-safe base64 encoded 32-byte key
    return base64.urlsafe_b64encode(digest)


@lru_cache(maxsize=1)
def _get_fernet() -> Fernet:
    """
    Get a cached Fernet instance using the application's SECRET_KEY.
    
    The instance is cached to avoid repeated key derivation.
    """
    from app.core.config import get_settings
    settings = get_settings()
    key = _derive_key(settings.secret_key)
    return Fernet(key)


def encrypt(plaintext: str) -> str:
    """
    Encrypt a plaintext string.
    
    Args:
        plaintext: The string to encrypt
        
    Returns:
        Base64-encoded encrypted ciphertext
    """
    if not plaintext:
        return plaintext
    
    try:
        fernet = _get_fernet()
        encrypted = fernet.encrypt(plaintext.encode())
        return encrypted.decode()
    except Exception as e:
        logger.error(f"Encryption failed: {e}")
        raise


def decrypt(ciphertext: str) -> str:
    """
    Decrypt an encrypted string.
    
    Args:
        ciphertext: The base64-encoded encrypted string
        
    Returns:
        The decrypted plaintext string
        
    Raises:
        InvalidToken: If decryption fails (wrong key or corrupted data)
    """
    if not ciphertext:
        return ciphertext
    
    try:
        fernet = _get_fernet()
        decrypted = fernet.decrypt(ciphertext.encode())
        return decrypted.decode()
    except InvalidToken:
        logger.warning("Decryption failed - may be legacy unencrypted value")
        raise
    except Exception as e:
        logger.error(f"Decryption error: {e}")
        raise


def is_encrypted(value: Optional[str]) -> bool:
    """
    Check if a value appears to be encrypted (Fernet format).
    
    This is used during migration to handle both encrypted and 
    legacy unencrypted values.
    
    Args:
        value: The string to check
        
    Returns:
        True if the value appears to be Fernet-encrypted
    """
    if not value:
        return False
    return value.startswith(ENCRYPTED_PREFIX)


def decrypt_safe(ciphertext: str) -> str:
    """
    Safely decrypt a value, returning the original if it's not encrypted.
    
    This handles the migration case where old unencrypted values 
    may still exist in the database.
    
    Args:
        ciphertext: The potentially encrypted string
        
    Returns:
        The decrypted string, or original if not encrypted
    """
    if not ciphertext:
        return ciphertext
    
    # Check if it looks like an encrypted value
    if not is_encrypted(ciphertext):
        # Return as-is (legacy unencrypted value)
        logger.debug("Value not encrypted, returning as-is")
        return ciphertext
    
    try:
        return decrypt(ciphertext)
    except InvalidToken:
        # If decryption fails even though it looks encrypted,
        # log a warning and return empty (security: don't expose corrupted data)
        logger.warning("Failed to decrypt value that appeared encrypted")
        return ""
    except Exception as e:
        logger.error(f"Unexpected decryption error: {e}")
        return ""
