"""Pydantic schemas for the API.

Keeping schemas separate helps prevent backend/api.py from becoming a mega-file.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class APIKeyUpdate(BaseModel):
    openai_api_key: str


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: datetime
    document_count: int = 0

    class Config:
        from_attributes = True


class DocumentResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    file_size: int
    document_type: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    message: str
    project_id: Optional[int] = None


class ChatResponse(BaseModel):
    response: str
    message_id: Optional[int] = None


class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatHistoryResponse(BaseModel):
    id: int
    messages: List[ChatMessageResponse]
    created_at: datetime

    class Config:
        from_attributes = True


class ConflictResponse(BaseModel):
    id: str
    severity: str
    title: str
    description: str
    documents: List[str]
