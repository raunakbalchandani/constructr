"""
FastAPI REST API
"""
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
from pathlib import Path
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

# Storage backend flag (local vs s3)
STORAGE_BACKEND = os.environ.get("STORAGE_BACKEND", "local").strip().lower()


# Import document parser and AI assistant from parent
try:
    from document_parser import ConstructionDocumentParser as DocumentParser
    from ai_assistant import ConstructionAI
except ImportError:
    DocumentParser = None
    ConstructionAI = None

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
    
    # Extract text if parser available
    extracted_text = None
    if DocumentParser:
        try:
            parser = DocumentParser()

            # DocumentParser expects a local file path. When using S3 storage,
            # file_info["file_path"] is an S3 key, so we download to a temp file first.
            parse_path = file_info["file_path"]
            tmp_path = None
            try:
                if STORAGE_BACKEND == "s3":
                    blob = get_file(file_info["file_path"])
                    if blob is None:
                        raise ValueError("File not found in storage")
                    import tempfile
                    suffix = Path(file_info["original_filename"]).suffix or ""
                    fd, tmp_path = tempfile.mkstemp(prefix="foreperson-", suffix=suffix)
                    with os.fdopen(fd, "wb") as f:
                        f.write(blob)
                    parse_path = tmp_path

                result = parser.parse_document(parse_path)
            finally:
                if tmp_path:
                    try:
                        os.remove(tmp_path)
                    except Exception:
                        pass
            extracted_text = result.get('text_content', '')
            if not extracted_text:
                # Try alternative key
                extracted_text = result.get('text', '') or result.get('content', '')
        except Exception as e:
            # Log error but continue
            import logging
            logging.warning(f"Text extraction failed: {e}")
            extracted_text = None
    
    # Detect document type - use AI if available, otherwise use filename
    doc_type = detect_document_type(file_info["original_filename"])
    
    # Use AI to detect document type if we have API key (even with minimal text)
    if ConstructionAI:
        try:
            api_key = current_user.openai_api_key or os.environ.get("OPENAI_API_KEY")
            if api_key:
                ai_assistant = ConstructionAI(api_key=api_key)
                # Use extracted text if available, otherwise use filename for detection
                text_for_detection = extracted_text if extracted_text else ""
                doc_type = ai_assistant.detect_document_type(
                    file_info["original_filename"], 
                    text_for_detection
                )
        except Exception as e:
            # Log error but fall back to filename-based detection
            import logging
            logging.warning(f"AI document type detection failed: {e}")
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
    """Download a document.

    - local backend: serves from filesystem path
    - s3 backend: streams object bytes through API

    (We can switch to pre-signed URLs later if desired.)
    """
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

    if STORAGE_BACKEND == "s3":
        # document.file_path stores S3 key
        content = get_file(document.file_path)
        if content is None:
            raise HTTPException(status_code=404, detail="File not found in storage")

        return StreamingResponse(
            iter([content]),
            media_type=document.mime_type or "application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename=\"{document.original_filename}\""
            },
        )

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
    
    if not ConstructionAI:
        raise HTTPException(
            status_code=500,
            detail="AI assistant not available"
        )
    
    # Get documents for the specified project (or all projects if no project_id)
    doc_list = []
    
    if request.project_id:
        # Only get documents from the specified project
        project = db.query(Project).filter(
            Project.id == request.project_id,
            Project.owner_id == current_user.id
        ).first()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        documents = db.query(Document).filter(Document.project_id == request.project_id).all()
        for doc in documents:
            if doc.extracted_text:
                # Count words in extracted text
                word_count = len(doc.extracted_text.split())
                doc_list.append({
                    "filename": doc.original_filename,
                    "document_type": doc.document_type or "unknown",
                    "text_content": doc.extracted_text,
                    "word_count": word_count
                })
    else:
        # Fallback: get all documents from all projects (for backward compatibility)
        projects = db.query(Project).filter(Project.owner_id == current_user.id).all()
        for project in projects:
            documents = db.query(Document).filter(Document.project_id == project.id).all()
            for doc in documents:
                if doc.extracted_text:
                    word_count = len(doc.extracted_text.split())
                    doc_list.append({
                        "filename": doc.original_filename,
                        "document_type": doc.document_type or "unknown",
                        "text_content": doc.extracted_text,
                        "word_count": word_count
                    })
    
    # Get or create chat session for this project
    if not request.project_id:
        raise HTTPException(status_code=400, detail="project_id is required")
    
    chat = db.query(Chat).filter(
        Chat.project_id == request.project_id,
        Chat.user_id == current_user.id
    ).first()
    
    if not chat:
        chat = Chat(
            project_id=request.project_id,
            user_id=current_user.id
        )
        db.add(chat)
        db.commit()
        db.refresh(chat)
    
    # Save user message to database
    user_message = ChatMessage(
        chat_id=chat.id,
        role="user",
        content=request.message
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)
    
    # Create AI assistant and get response
    try:
        assistant = ConstructionAI(api_key=api_key)
        
        # Load documents if available
        if doc_list:
            assistant.load_documents(doc_list)
        
        response = assistant.ask_question(request.message)
        
        # Save assistant response to database
        assistant_message = ChatMessage(
            chat_id=chat.id,
            role="assistant",
            content=response
        )
        db.add(assistant_message)
        db.commit()
        db.refresh(assistant_message)
        
        return {
            "response": response,
            "message_id": assistant_message.id
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI error: {str(e)}"
        )


@app.get("/projects/{project_id}/chat", response_model=ChatHistoryResponse)
async def get_chat_history(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get chat history for a project."""
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get or create chat
    chat = db.query(Chat).filter(
        Chat.project_id == project_id,
        Chat.user_id == current_user.id
    ).first()
    
    if not chat:
        # Create empty chat if none exists
        chat = Chat(
            project_id=project_id,
            user_id=current_user.id
        )
        db.add(chat)
        db.commit()
        db.refresh(chat)
    
    # Get all messages ordered by creation time
    messages = db.query(ChatMessage).filter(
        ChatMessage.chat_id == chat.id
    ).order_by(ChatMessage.created_at.asc()).all()
    
    return {
        "id": chat.id,
        "messages": messages,
        "created_at": chat.created_at
    }


@app.post("/projects/{project_id}/conflicts", response_model=List[ConflictResponse])
async def analyze_conflicts(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Analyze documents in a project for conflicts."""
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get all documents for the project
    documents = db.query(Document).filter(Document.project_id == project_id).all()
    
    if len(documents) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 documents are required for conflict analysis"
        )
    
    # Get user's API key
    api_key = current_user.openai_api_key or os.environ.get("OPENAI_API_KEY")
    
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No OpenAI API key configured. Please add your API key in settings."
        )
    
    if not ConstructionAI:
        raise HTTPException(
            status_code=500,
            detail="AI assistant not available"
        )
    
    # Prepare document list for AI
    doc_list = []
    doc_name_map = {}
    
    for doc in documents:
        if doc.extracted_text:
            word_count = len(doc.extracted_text.split())
            doc_list.append({
                "filename": doc.original_filename,
                "document_type": doc.document_type or "unknown",
                "text_content": doc.extracted_text,
                "word_count": word_count
            })
            doc_name_map[doc.original_filename] = doc
    
    if len(doc_list) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 documents with extractable text are required"
        )
    
    # Use AI to find conflicts
    try:
        assistant = ConstructionAI(api_key=api_key)
        assistant.load_documents(doc_list)
        conflict_analysis = assistant.find_conflicts()
        
        # Parse the AI response into structured conflicts
        conflicts = _parse_conflict_response(conflict_analysis, [d['filename'] for d in doc_list])
        
        return conflicts
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Conflict analysis error: {str(e)}"
        )


def _parse_conflict_response(analysis_text: str, document_names: List[str]) -> List[dict]:
    """Parse AI conflict analysis text into structured conflict objects."""
    import re
    
    conflicts = []
    
    # Split by common conflict indicators
    # Look for patterns like "##", numbered lists, or conflict descriptions
    sections = re.split(r'\n(?=##|\d+\.|[-*]|Conflict|Issue|Problem)', analysis_text, flags=re.IGNORECASE)
    
    conflict_id = 1
    for section in sections:
        section = section.strip()
        if not section or len(section) < 50:  # Skip very short sections
            continue
        
        # Determine severity based on keywords
        severity = "medium"
        if any(word in section.lower() for word in ["critical", "urgent", "severe", "high", "major"]):
            severity = "high"
        elif any(word in section.lower() for word in ["minor", "low", "small"]):
            severity = "low"
        
        # Extract title (first line or first sentence)
        lines = section.split('\n')
        title = lines[0].strip()
        if title.startswith('#'):
            title = title.lstrip('#').strip()
        if len(title) > 100:
            title = title[:100] + "..."
        
        # Extract description (rest of section, limited to 500 chars)
        description = '\n'.join(lines[1:]).strip()[:500]
        if not description:
            description = section[:500]
        
        # Find which documents are mentioned
        mentioned_docs = []
        for doc_name in document_names:
            if doc_name.lower() in section.lower():
                mentioned_docs.append(doc_name)
        
        # If no documents mentioned, include all (conflict might be across all)
        if not mentioned_docs and len(document_names) >= 2:
            mentioned_docs = document_names[:2]  # At least 2 for a conflict
        
        if title and description and mentioned_docs:
            conflicts.append({
                "id": str(conflict_id),
                "severity": severity,
                "title": title,
                "description": description,
                "documents": mentioned_docs
            })
            conflict_id += 1
    
    # If parsing didn't work well, create a single summary conflict
    if not conflicts and analysis_text:
        conflicts.append({
            "id": "1",
            "severity": "medium",
            "title": "Document Analysis Results",
            "description": analysis_text[:500],
            "documents": document_names[:2] if len(document_names) >= 2 else document_names
        })
    
    return conflicts


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
