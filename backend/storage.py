"""
File Storage

Supports two backends:
- local filesystem (default)
- S3 (recommended for lean EC2 deployments)

Env vars:
- STORAGE_BACKEND: "local" | "s3" (default: local)

Local:
- UPLOAD_DIR: local directory (default: uploads)

S3:
- S3_BUCKET: bucket name (required)
- AWS_REGION: region (default: us-east-1)
- S3_PREFIX: optional prefix within bucket (default: "uploads")

Notes:
- For S3, Document.file_path stores the S3 key (not a local path).
"""

import os
import shutil
import uuid
from pathlib import Path
from typing import Optional, BinaryIO, Dict

from fastapi import UploadFile


STORAGE_BACKEND = os.environ.get("STORAGE_BACKEND", "local").strip().lower()

# Local storage configuration
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")

# Common config
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


def _require(condition: bool, msg: str):
    if not condition:
        raise ValueError(msg)


# -------------------------
# Local backend
# -------------------------

def ensure_upload_dir():
    """Create upload directory if it doesn't exist."""
    Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)


def _local_get_file_path(user_id: int, project_id: int, filename: str) -> str:
    """Generate a unique file path for storage."""
    user_dir = Path(UPLOAD_DIR) / str(user_id) / str(project_id)
    user_dir.mkdir(parents=True, exist_ok=True)

    file_ext = Path(filename).suffix
    unique_name = f"{uuid.uuid4().hex}{file_ext}"

    return str(user_dir / unique_name)


# -------------------------
# S3 backend
# -------------------------

def _s3_client():
    import boto3

    region = os.environ.get("AWS_REGION", "us-east-1")
    return boto3.client("s3", region_name=region)


def _s3_bucket() -> str:
    b = os.environ.get("S3_BUCKET")
    _require(bool(b), "S3_BUCKET env var is required when STORAGE_BACKEND=s3")
    return b


def _s3_prefix() -> str:
    # Keep objects grouped; do not start with leading slash.
    prefix = os.environ.get("S3_PREFIX", "uploads").strip().strip("/")
    return prefix


def _s3_key(user_id: int, project_id: int, filename: str) -> str:
    ext = Path(filename).suffix
    unique_name = f"{uuid.uuid4().hex}{ext}"
    return f"{_s3_prefix()}/{user_id}/{project_id}/{unique_name}"


# -------------------------
# Public API
# -------------------------

async def save_file(file: UploadFile, user_id: int, project_id: int) -> dict:
    """Save an uploaded file (local or S3)."""

    # Read content (simpler + lets us enforce size)
    content = await file.read()
    file_size = len(content)

    if file_size > MAX_FILE_SIZE:
        raise ValueError(
            f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
        )

    if STORAGE_BACKEND == "s3":
        client = _s3_client()
        bucket = _s3_bucket()
        key = _s3_key(user_id, project_id, file.filename)

        client.put_object(
            Bucket=bucket,
            Key=key,
            Body=content,
            ContentType=file.content_type or "application/octet-stream",
        )

        return {
            "file_path": key,  # store S3 key here
            "filename": Path(key).name,
            "original_filename": file.filename,
            "file_size": file_size,
            "mime_type": file.content_type,
            "storage": "s3",
            "bucket": bucket,
        }

    # Default: local
    ensure_upload_dir()
    file_path = _local_get_file_path(user_id, project_id, file.filename)

    with open(file_path, "wb") as f:
        f.write(content)

    return {
        "file_path": file_path,
        "filename": Path(file_path).name,
        "original_filename": file.filename,
        "file_size": file_size,
        "mime_type": file.content_type,
        "storage": "local",
    }


def get_file(file_path: str) -> Optional[bytes]:
    """Read a file from storage and return bytes."""

    if STORAGE_BACKEND == "s3":
        client = _s3_client()
        bucket = _s3_bucket()
        try:
            obj = client.get_object(Bucket=bucket, Key=file_path)
            return obj["Body"].read()
        except Exception:
            return None

    try:
        with open(file_path, "rb") as f:
            return f.read()
    except FileNotFoundError:
        return None


def delete_file(file_path: str) -> bool:
    """Delete a file from storage."""

    if STORAGE_BACKEND == "s3":
        client = _s3_client()
        bucket = _s3_bucket()
        try:
            client.delete_object(Bucket=bucket, Key=file_path)
            return True
        except Exception:
            return False

    try:
        os.remove(file_path)
        return True
    except FileNotFoundError:
        return False


def delete_project_files(user_id: int, project_id: int) -> bool:
    """Delete all files for a project.

    - Local: deletes directory.
    - S3: deletes objects under prefix/user_id/project_id.
    """

    if STORAGE_BACKEND == "s3":
        client = _s3_client()
        bucket = _s3_bucket()
        prefix = f"{_s3_prefix()}/{user_id}/{project_id}/"

        try:
            paginator = client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
                contents = page.get("Contents", [])
                if not contents:
                    continue
                client.delete_objects(
                    Bucket=bucket,
                    Delete={"Objects": [{"Key": o["Key"]} for o in contents]},
                )
            return True
        except Exception:
            return False

    project_dir = Path(UPLOAD_DIR) / str(user_id) / str(project_id)
    if project_dir.exists():
        shutil.rmtree(project_dir)
        return True
    return False


def get_storage_stats(user_id: int) -> dict:
    """Get storage statistics for a user.

    For S3 this is approximate and limited to keys under the user's prefix.
    """

    if STORAGE_BACKEND == "s3":
        client = _s3_client()
        bucket = _s3_bucket()
        prefix = f"{_s3_prefix()}/{user_id}/"

        total_files = 0
        total_size = 0

        try:
            paginator = client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
                for o in page.get("Contents", []):
                    total_files += 1
                    total_size += int(o.get("Size", 0))
        except Exception:
            return {"total_files": 0, "total_size": 0, "total_size_mb": 0, "backend": "s3"}

        return {
            "total_files": total_files,
            "total_size": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "backend": "s3",
        }

    user_dir = Path(UPLOAD_DIR) / str(user_id)
    if not user_dir.exists():
        return {"total_files": 0, "total_size": 0, "backend": "local"}

    total_files = 0
    total_size = 0

    for p in user_dir.rglob("*"):
        if p.is_file():
            total_files += 1
            total_size += p.stat().st_size

    return {
        "total_files": total_files,
        "total_size": total_size,
        "total_size_mb": round(total_size / (1024 * 1024), 2),
        "backend": "local",
    }
