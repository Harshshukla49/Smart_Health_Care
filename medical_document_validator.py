"""
medical_document_validator.py

Healthcare Medical Document & Diagnostic Attachment Validator
Provides rigorous validation for clinical documents (PDF, PNG, JPEG, DICOM)
to prevent arbitrary file upload, cross-site scripting (via malicious PDF scripts),
oversized payload exhaustion, and MIME-type spoofing.
"""

import os
import re
from typing import Tuple, Optional, Dict, Any

# Allowed extensions and standard MIME types
ALLOWED_EXTENSIONS = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.dcm': 'application/dicom',
}

# Maximum file sizes (bytes)
MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB for PDF and standard diagnostic images
MAX_DICOM_SIZE_BYTES = 50 * 1024 * 1024     # 50 MB for high-resolution DICOM slices

# Magic byte signatures
MAGIC_SIGNATURES = {
    'application/pdf': b'%PDF-',
    'image/png': b'\x89PNG\r\n\x1a\n',
    'image/jpeg': b'\xff\xd8\xff',
}

# Dangerous PDF tokens that could trigger client-side script execution or external network calls
SUSPICIOUS_PDF_TOKENS = [
    b'/JavaScript',
    b'/JS',
    b'/Launch',
    b'/EmbeddedFiles',
    b'/SubmitForm',
    b'/ImportData',
]


def sanitize_filename(filename: str) -> str:
    """
    Sanitizes a user-supplied filename:
    - Strips directory path traversal (/, \\, ..)
    - Replaces unsafe characters with underscores
    - Preserves a clean extension
    """
    if not filename:
        return 'unnamed_document.pdf'
    
    # Strip any directory path components
    clean_name = os.path.basename(filename.replace('\\', '/')).strip()
    
    # Remove null bytes and control characters
    clean_name = re.sub(r'[\x00-\x1f\x7f]', '', clean_name)
    
    # Disallow leading dot (hidden file)
    clean_name = clean_name.lstrip('.')
    
    # Extract base and ext
    name_parts = clean_name.rsplit('.', 1)
    if len(name_parts) == 2:
        base, ext = name_parts
        base = re.sub(r'[^a-zA-Z0-9_\-]', '_', base)
        ext = re.sub(r'[^a-zA-Z0-9]', '', ext).lower()
        clean_name = f"{base}.{ext}" if base else f"document.{ext}"
    else:
        clean_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', clean_name)
    
    return clean_name or 'unnamed_document'


def detect_magic_mimetype(content_bytes: bytes) -> Optional[str]:
    """
    Inspects leading file bytes to determine the true MIME type.
    """
    if not content_bytes or len(content_bytes) < 4:
        return None

    # 1. Standard magic signatures
    if content_bytes.startswith(MAGIC_SIGNATURES['application/pdf']):
        return 'application/pdf'
    if content_bytes.startswith(MAGIC_SIGNATURES['image/png']):
        return 'image/png'
    if content_bytes.startswith(MAGIC_SIGNATURES['image/jpeg']):
        return 'image/jpeg'

    # 2. DICOM Part 10 signature (128-byte preamble followed by 'DICM')
    if len(content_bytes) >= 132 and content_bytes[128:132] == b'DICM':
        return 'application/dicom'

    return None


def validate_medical_document(
    file_bytes: bytes,
    filename: str,
    declared_mimetype: Optional[str] = None,
    allow_dicom: bool = True
) -> Tuple[bool, Optional[str], Dict[str, Any]]:
    """
    Performs comprehensive security and integrity validation on a medical document:
    1. Validates content presence (non-empty)
    2. Validates filename and extension against approved healthcare document formats
    3. Enforces strict file size limits (10MB for reports/images, 50MB for DICOM)
    4. Validates binary magic byte headers against declared extension and MIME type
    5. Checks for executable scripts or malicious active content in PDFs
    
    Returns:
        (is_valid, error_message, metadata_dict)
    """
    if not file_bytes:
        return False, "File content is empty.", {}

    file_size = len(file_bytes)

    # 1. Filename & extension validation
    clean_filename = sanitize_filename(filename)
    _, ext = os.path.splitext(clean_filename)
    ext = ext.lower()

    if not ext or ext not in ALLOWED_EXTENSIONS:
        return (
            False,
            f"Unsupported document format '{ext}'. Only certified clinical formats ({', '.join(ALLOWED_EXTENSIONS.keys())}) are permitted.",
            {},
        )

    expected_mimetype = ALLOWED_EXTENSIONS[ext]

    if ext == '.dcm' and not allow_dicom:
        return False, "DICOM medical imaging uploads are currently restricted in this facility.", {}

    # 2. Size limit validation
    max_size = MAX_DICOM_SIZE_BYTES if ext == '.dcm' else MAX_DOCUMENT_SIZE_BYTES
    if file_size > max_size:
        max_mb = max_size // (1024 * 1024)
        return (
            False,
            f"File size ({file_size / (1024 * 1024):.2f} MB) exceeds maximum allowed limit of {max_mb} MB for {ext.upper()} files.",
            {},
        )

    # 3. Magic byte inspection & MIME matching
    detected_mimetype = detect_magic_mimetype(file_bytes)
    if not detected_mimetype:
        return (
            False,
            f"Invalid file structure. The uploaded {ext.upper()} document does not contain a valid binary header.",
            {},
        )

    if detected_mimetype != expected_mimetype:
        return (
            False,
            f"MIME type mismatch. File extension is '{ext}' ({expected_mimetype}), but file content signature corresponds to '{detected_mimetype}'.",
            {},
        )

    if declared_mimetype and str(declared_mimetype).strip().lower() != expected_mimetype:
        # Some browsers declare jpeg as image/pjpeg or pdf as application/x-pdf
        normalized_declared = declared_mimetype.strip().lower()
        if not (
            (expected_mimetype == 'image/jpeg' and normalized_declared in {'image/jpeg', 'image/pjpeg', 'image/jpg'}) or
            (expected_mimetype == 'application/pdf' and normalized_declared in {'application/pdf', 'application/x-pdf'})
        ):
            return (
                False,
                f"Declared Content-Type '{declared_mimetype}' does not match validated format '{expected_mimetype}'.",
                {},
            )

    # 4. Deep Inspection: Malicious active content in PDF
    if detected_mimetype == 'application/pdf':
        for token in SUSPICIOUS_PDF_TOKENS:
            if token in file_bytes:
                return (
                    False,
                    f"Security policy violation: Document contains forbidden active content ({token.decode('ascii', errors='ignore')}). PDF must be a static, sanitized document.",
                    {},
                )

    metadata = {
        'filename': clean_filename,
        'sizeBytes': file_size,
        'mimetype': detected_mimetype,
        'extension': ext,
        'isStatic': True,
    }

    return True, None, metadata
