import os
import mimetypes
from fastapi import APIRouter, Depends, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.session import get_db
from app.utils.storage import storage_service
from app.auth.deps import get_current_user
from app.models.domain import User, FileUpload
from app.core.config import settings
from app.core.exceptions import NotFoundException

router = APIRouter(prefix="/files", tags=["File Storage"])

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    folder: str = Form(default="general"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    rel_path, mime_type = await storage_service.save_file(file, folder=folder)
    file_url = f"/api/v1/files/{rel_path}"

    full_disk_path = os.path.join(settings.FILE_STORAGE_PATH, rel_path)
    file_size = os.path.getsize(full_disk_path) if os.path.exists(full_disk_path) else 0

    db_file = FileUpload(
        user_id=current_user.id,
        original_filename=file.filename or "file",
        stored_filename=os.path.basename(rel_path),
        folder=folder,
        mime_type=mime_type,
        file_size=file_size,
        storage_path=rel_path,
        url=file_url
    )
    db.add(db_file)
    await db.commit()
    await db.refresh(db_file)

    return {
        "id": str(db_file.id),
        "url": file_url,
        "file_url": file_url,
        "relative_path": rel_path,
        "mime_type": mime_type,
        "original_filename": db_file.original_filename,
        "file_size": file_size
    }

@router.get("/{file_path:path}")
async def get_file(file_path: str):
    # Sanitize path to prevent directory traversal
    clean_path = os.path.normpath(file_path).lstrip("/\\")
    if ".." in clean_path:
        raise NotFoundException("Invalid file path")

    full_path = os.path.abspath(os.path.join(settings.FILE_STORAGE_PATH, clean_path))
    base_storage_dir = os.path.abspath(settings.FILE_STORAGE_PATH)

    if not full_path.startswith(base_storage_dir) or not os.path.exists(full_path) or not os.path.isfile(full_path):
        raise NotFoundException("File not found")

    media_type, _ = mimetypes.guess_type(full_path)
    return FileResponse(full_path, media_type=media_type or "application/octet-stream")
