"""
FastAPI REST API
"""
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import get_db, User, Project, Document, Chat, ChatMessage, init_db
from backend.auth import (
    get_current_user, 
    create_access_token, 
    register_user, 
    authenticate_user,
    get_password_hash
)
from backend.storage import save_file, get_file, delete_file

# Import document parser and AI assistant from parent
try:
    from document_parser import DocumentParser
    from ai_assistant import ConstructionAIAssistant
except ImportError:
    DocumentParser = None
    ConstructionAIAssistant = None

# Initialize FastAPI
app = FastAPI(
    title="Foreperson.ai API",
    description="Construction Document Intelligence API",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models
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


class APIKeyUpdate(BaseModel):
    openai_api_key: str


# Initialize database on startup
@app.on_event("startup")
async def startup():
    init_db()


# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "foreperson-api"}


# ============ Auth Routes ============

@app.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    user = register_user(db, user_data.email, user_data.password, user_data.name)
    return user


@app.post("/auth/login", response_model=TokenResponse)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Login and get access token."""
    user = authenticate_user(db, user_data.email, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token = create_access_token(data={"sub": user.id})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info."""
    return current_user


@app.put("/auth/api-key")
async def update_api_key(
    data: APIKeyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user's OpenAI API key."""
    current_user.openai_api_key = data.openai_api_key
    db.commit()
    return {"message": "API key updated"}


# ============ Project Routes ============

@app.get("/projects", response_model=List[ProjectResponse])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all projects for current user."""
    projects = db.query(Project).filter(Project.owner_id == current_user.id).all()
    
    # Add document count
    result = []
    for p in projects:
        doc_count = db.query(Document).filter(Document.project_id == p.id).count()
        result.append(ProjectResponse(
            id=p.id,
            name=p.name,
            description=p.description,
            created_at=p.created_at,
            document_count=doc_count
        ))
    
    return result


@app.post("/projects", response_model=ProjectResponse)
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new project."""
    project = Project(
        name=project_data.name,
        description=project_data.description,
        owner_id=current_user.id
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
        document_count=0
    )


@app.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific project."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    doc_count = db.query(Document).filter(Document.project_id == project.id).count()
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
        document_count=doc_count
    )


@app.delete("/projects/{project_id}")
async def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a project and all its documents."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Delete associated files
    documents = db.query(Document).filter(Document.project_id == project_id).all()
    for doc in documents:
        delete_file(doc.file_path)
    
    db.delete(project)
    db.commit()
    return {"message": "Project deleted"}


# ============ Document Routes ============

@app.get("/projects/{project_id}/documents", response_model=List[DocumentResponse])
async def list_documents(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all documents in a project."""
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    documents = db.query(Document).filter(Document.project_id == project_id).all()
    return documents


@app.post("/projects/{project_id}/documents", response_model=DocumentResponse)
async def upload_document(
    project_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload a document to a project."""
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Save file
    try:
        file_info = await save_file(file, current_user.id, project_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Detect document type
    doc_type = detect_document_type(file_info["original_filename"])
    
    # Extract text if parser available
    extracted_text = None
    if DocumentParser:
        try:
            parser = DocumentParser()
            extracted_text = parser.extract_text(file_info["file_path"])
        except Exception:
            pass
    
    # Create document record
    document = Document(
        project_id=project_id,
        filename=file_info["filename"],
        original_filename=file_info["original_filename"],
        file_path=file_info["file_path"],
        file_size=file_info["file_size"],
        mime_type=file_info["mime_type"],
        document_type=doc_type,
        extracted_text=extracted_text
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    
    return document


@app.get("/projects/{project_id}/documents/{document_id}/download")
async def download_document(
    project_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download a document."""
    # Verify ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.project_id == project_id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return FileResponse(
        document.file_path,
        filename=document.original_filename,
        media_type=document.mime_type
    )


@app.delete("/projects/{project_id}/documents/{document_id}")
async def delete_document(
    project_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a document."""
    # Verify ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.project_id == project_id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete file
    delete_file(document.file_path)
    
    db.delete(document)
    db.commit()
    return {"message": "Document deleted"}


# ============ Chat Routes ============

@app.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Chat with AI about documents."""
    # Get user's API key
    api_key = current_user.openai_api_key or os.environ.get("OPENAI_API_KEY")
    
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No OpenAI API key configured. Please add your API key in settings."
        )
    
    if not ConstructionAIAssistant:
        raise HTTPException(
            status_code=500,
            detail="AI assistant not available"
        )
    
    # Get documents context
    documents_text = ""
    if request.project_id:
        # Verify project ownership
        project = db.query(Project).filter(
            Project.id == request.project_id,
            Project.owner_id == current_user.id
        ).first()
        
        if project:
            documents = db.query(Document).filter(
                Document.project_id == request.project_id
            ).all()
            
            for doc in documents:
                if doc.extracted_text:
                    documents_text += f"\n\n--- {doc.original_filename} ---\n{doc.extracted_text[:5000]}"
    
    # Create AI assistant and get response
    try:
        assistant = ConstructionAIAssistant(api_key=api_key)
        response = assistant.chat(request.message, documents_text)
        return {"response": response}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI error: {str(e)}"
        )


# ============ Helper Functions ============

def detect_document_type(filename: str) -> str:
    """Detect document type from filename."""
    lower = filename.lower()
    if 'contract' in lower:
        return 'contract'
    elif 'spec' in lower:
        return 'specification'
    elif 'rfi' in lower:
        return 'rfi'
    elif 'submittal' in lower:
        return 'submittal'
    elif 'drawing' in lower or 'dwg' in lower:
        return 'drawing'
    return 'unknown'


# Run with: uvicorn backend.api:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
