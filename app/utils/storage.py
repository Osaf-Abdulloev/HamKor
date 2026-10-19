import os
import uuid
import abc
import base64
import re
from typing import Tuple, Optional
from fastapi import UploadFile
from app.core.config import settings
from app.core.exceptions import AppException

def validate_image_content(content: bytes, filename: str = "") -> str:
    """Validates raw binary content against real image magic numbers and returns normalized extension (.png, .jpg, .webp, .gif)."""
    if not content or len(content) == 0:
        raise AppException("File content is empty")

    max_mb = getattr(settings, "MAX_UPLOAD_SIZE_MB", 5)
    if len(content) > max_mb * 1024 * 1024:
        raise AppException(f"File size exceeds maximum limit of {max_mb}MB")

    if content.startswith(b'\x89PNG\r\n\x1a\n'):
        return ".png"
    elif content.startswith(b'\xff\xd8\xff'):
        return ".jpg"
    elif content.startswith(b'RIFF') and b'WEBP' in content[:16]:
        return ".webp"
    elif content.startswith(b'GIF87a') or content.startswith(b'GIF89a'):
        return ".gif"

    ext = os.path.splitext(filename or "")[1].lower()
    if ext in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]:
        return ".jpg" if ext == ".jpeg" else ext

    # Explicitly reject dangerous script/executable headers
    if content.startswith(b'<?php') or content.startswith(b'MZ') or content.startswith(b'\x7fELF') or ext in [".php", ".exe", ".sh", ".bat"]:
        raise AppException("Invalid image file format. Allowed formats: PNG, JPG, WEBP, GIF.")

    return ".png"

class BaseStorageService(abc.ABC):
    @abc.abstractmethod
    async def save_file(self, file: UploadFile, folder: str = "general", prefix: str = "") -> Tuple[str, str]:
        pass

    @abc.abstractmethod
    async def save_bytes(self, content: bytes, filename: str, mime_type: str, folder: str = "general", prefix: str = "") -> Tuple[str, str]:
        pass

    @abc.abstractmethod
    async def delete_file(self, file_path: str) -> bool:
        pass

class LocalStorageService(BaseStorageService):
    def __init__(self, base_path: str = settings.FILE_STORAGE_PATH):
        self.base_path = base_path
        os.makedirs(self.base_path, exist_ok=True)

    async def save_file(self, file: UploadFile, folder: str = "general", prefix: str = "") -> Tuple[str, str]:
        content = await file.read()
        mime_type = file.content_type or "application/octet-stream"
        return await self.save_bytes(content, file.filename or "file", mime_type, folder=folder, prefix=prefix)

    async def save_bytes(self, content: bytes, filename: str, mime_type: str, folder: str = "general", prefix: str = "") -> Tuple[str, str]:
        max_mb = getattr(settings, "MAX_UPLOAD_SIZE_MB", 5)
        file_size_mb = len(content) / (1024 * 1024)
        if file_size_mb > max_mb:
            raise AppException(f"File size exceeds maximum allowed limit of {max_mb}MB")

        ext = validate_image_content(content, filename) if folder in ["avatars", "logos"] else (os.path.splitext(filename or "")[1] or ".bin")

        clean_prefix = re.sub(r'[^a-zA-Z0-9_\-]', '', prefix)
        file_stem = f"{clean_prefix}_{uuid.uuid4().hex[:12]}" if clean_prefix else uuid.uuid4().hex
        random_filename = f"{file_stem}{ext}"

        folder_path = os.path.join(self.base_path, folder)
        os.makedirs(folder_path, exist_ok=True)

        file_path = os.path.join(folder_path, random_filename)
        with open(file_path, "wb") as f:
            f.write(content)

        relative_path = f"{folder}/{random_filename}"
        return relative_path, mime_type

    async def delete_file(self, file_path: str) -> bool:
        if not file_path:
            return False
        clean_rel = file_path.split("?")[0].replace("/api/v1/files/", "").lstrip("/\\")
        full_path = os.path.abspath(os.path.join(self.base_path, clean_rel))
        base_storage_dir = os.path.abspath(self.base_path)

        if full_path.startswith(base_storage_dir) and os.path.exists(full_path) and os.path.isfile(full_path):
            try:
                os.remove(full_path)
                return True
            except Exception as e:
                print(f"Error removing file {full_path}: {e}")
        return False

storage_service: LocalStorageService = LocalStorageService()

async def save_base64_image(base64_str: str, folder: str = "avatars", prefix: str = "") -> str:
    """Decodes a base64 data URI (data:image/png;base64,...) and saves to disk, returning /api/v1/files/folder/filename."""
    if not base64_str or not isinstance(base64_str, str):
        return base64_str

    if not base64_str.startswith("data:"):
        return base64_str

    match = re.match(r"^data:(image/[a-zA-Z0-9\+\-\.]+);base64,(.*)$", base64_str)
    if not match:
        return base64_str

    mime_type, encoded_data = match.group(1), match.group(2)
    try:
        clean_encoded = re.sub(r"\s+", "", encoded_data).rstrip("=")
        mod = len(clean_encoded) % 4
        if mod == 1:
            clean_encoded = clean_encoded[:-1]
        elif mod > 1:
            clean_encoded += '=' * (4 - mod)

        binary_data = base64.b64decode(clean_encoded, validate=False)
        rel_path, _ = await storage_service.save_bytes(binary_data, "avatar.png", mime_type, folder=folder, prefix=prefix)
        return f"/api/v1/files/{rel_path}"
    except Exception as e:
        print(f"Error saving base64 image: {e}")
        return base64_str
