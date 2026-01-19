"""
File Storage - Local filesystem storage
"""
import os
import shutil
import uuid
from pathlib import Path
from typing import Optional
from fastapi import UploadFile

# Storage configuration
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def ensure_upload_dir():
    """Create upload directory if it doesn't exist."""
    Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)


def get_file_path(user_id: int, project_id: int, filename: str) -> str:
    """Generate a unique file path for storage."""
    # Create directory structure: uploads/<user_id>/<project_id>/
    user_dir = Path(UPLOAD_DIR) / str(user_id) / str(project_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename to prevent collisions
    file_ext = Path(filename).suffix
    unique_name = f"{uuid.uuid4().hex}{file_ext}"
    
    return str(user_dir / unique_name)


async def save_file(file: UploadFile, user_id: int, project_id: int) -> dict:
    """
    Save an uploaded file to local storage.
    
    Returns:
        dict with file_path, filename, original_filename, file_size, mime_type
    """
    ensure_upload_dir()
    
    # Generate unique path
    file_path = get_file_path(user_id, project_id, file.filename)
    
    # Read and save file
    content = await file.read()
    file_size = len(content)
    
    # Check file size
    if file_size > MAX_FILE_SIZE:
        raise ValueError(f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB")
    
    # Write file
    with open(file_path, "wb") as f:
        f.write(content)
    
    return {
        "file_path": file_path,
        "filename": Path(file_path).name,
        "original_filename": file.filename,
        "file_size": file_size,
        "mime_type": file.content_type
    }


def get_file(file_path: str) -> Optional[bytes]:
    """
    Read a file from local storage.
    
    Returns:
        File content as bytes or None if not found
    """
    try:
        with open(file_path, "rb") as f:
            return f.read()
    except FileNotFoundError:
        return None


def delete_file(file_path: str) -> bool:
    """
    Delete a file from local storage.
    
    Returns:
        True if deleted, False if not found
    """
    try:
        os.remove(file_path)
        return True
    except FileNotFoundError:
        return False


def delete_project_files(user_id: int, project_id: int) -> bool:
    """Delete all files for a project."""
    project_dir = Path(UPLOAD_DIR) / str(user_id) / str(project_id)
    if project_dir.exists():
        shutil.rmtree(project_dir)
        return True
    return False


def get_storage_stats(user_id: int) -> dict:
    """Get storage statistics for a user."""
    user_dir = Path(UPLOAD_DIR) / str(user_id)
    if not user_dir.exists():
        return {"total_files": 0, "total_size": 0}
    
    total_files = 0
    total_size = 0
    
    for file_path in user_dir.rglob("*"):
        if file_path.is_file():
            total_files += 1
            total_size += file_path.stat().st_size
    
    return {
        "total_files": total_files,
        "total_size": total_size,
        "total_size_mb": round(total_size / (1024 * 1024), 2)
    }
