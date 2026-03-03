"""
FastAPI REST API
"""
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime
import os
import sys
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.requests import Request
from backend.constants import MAX_FILE_SIZE, PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT, CHAT_RATE_LIMIT, CONFLICTS_RATE_LIMIT, CHAT_HISTORY_WINDOW
from backend.database import get_db, User, Project, Document, Chat, ChatMessage, ProjectMemory, init_db
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
    from document_parser import ConstructionDocumentParser as DocumentParser
    from document_parser import detect_document_type
    from ai_assistant import ConstructionAI
except ImportError:
    DocumentParser = None
    detect_document_type = None
    ConstructionAI = None

# Initialize FastAPI
app = FastAPI(
    title="Foreperson.ai API",
    description="Construction Document Intelligence API",
    version="1.0.0"
)

# CORS configuration
_allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _allowed_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


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
    parse_quality: Optional[str] = "good"
    created_at: datetime

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    message: str
    project_id: Optional[int] = None
    chat_id: Optional[int] = None
    model: Optional[str] = None  # e.g. "gpt-4o-mini" or "claude-sonnet-4-6"
    use_memory: bool = True
    referenced_chat_id: Optional[int] = None


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
    title: Optional[str] = None
    messages: List[ChatMessageResponse]
    created_at: datetime

    class Config:
        from_attributes = True


class ChatThreadResponse(BaseModel):
    id: int
    title: Optional[str] = None
    message_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class ConflictResponse(BaseModel):
    id: str
    severity: str
    title: str
    description: str
    resolution: str = ""
    documents: List[str]


class ConflictsRequest(BaseModel):
    doc_ids: Optional[List[int]] = None  # if None, use all docs in project


class CompareRequest(BaseModel):
    doc_id_1: int
    doc_id_2: int


class CompareConflictItem(BaseModel):
    title: str
    doc_a: str
    doc_b: str
    impact: str
    recommendation: str


class CompareRiskItem(BaseModel):
    title: str
    description: str


class CompareResponse(BaseModel):
    summary: str
    conflicts: List[CompareConflictItem]
    gaps: List[str]
    agreements: List[str]
    risks: List[CompareRiskItem]
    doc1_name: str
    doc2_name: str


# Initialize database on startup
@app.on_event("startup")
async def startup():
    init_db()
    # Add title column to chats table if it doesn't exist (migration)
    from backend.database import engine
    with engine.connect() as conn:
        try:
            conn.execute(__import__('sqlalchemy').text("ALTER TABLE chats ADD COLUMN title VARCHAR(255)"))
            conn.commit()
        except Exception:
            pass  # Column already exists
        try:
            conn.execute(__import__('sqlalchemy').text(
                "ALTER TABLE documents ADD COLUMN parse_quality VARCHAR(20) DEFAULT 'good'"
            ))
            conn.commit()
        except Exception:
            pass  # Column already exists


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


@app.get("/projects/{project_id}/analytics")
async def get_project_analytics(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return analytics summary for a project."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    docs = db.query(Document).filter(Document.project_id == project_id).all()

    type_breakdown: dict = {}
    total_words = 0
    for doc in docs:
        t = doc.document_type or 'unknown'
        type_breakdown[t] = type_breakdown.get(t, 0) + 1
        if doc.extracted_text:
            total_words += len(doc.extracted_text.split())

    chat_count = db.query(Chat).filter(
        Chat.project_id == project_id,
        Chat.user_id == current_user.id
    ).count()

    message_count = (
        db.query(ChatMessage)
        .join(Chat, Chat.id == ChatMessage.chat_id)
        .filter(Chat.project_id == project_id)
        .count()
    )

    memory_count = db.query(ProjectMemory).filter(
        ProjectMemory.project_id == project_id
    ).count()

    return {
        "doc_count": len(docs),
        "total_words": total_words,
        "type_breakdown": type_breakdown,
        "chat_count": chat_count,
        "message_count": message_count,
        "memory_fact_count": memory_count,
    }


# ============ Document Routes ============

@app.get("/projects/{project_id}/documents", response_model=List[DocumentResponse])
async def list_documents(
    project_id: int,
    page: int = 1,
    limit: int = PAGINATION_DEFAULT_LIMIT,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all documents in a project."""
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id, Project.owner_id == current_user.id
    ).first()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    limit = min(limit, PAGINATION_MAX_LIMIT)
    offset = (page - 1) * limit

    docs = (
        db.query(Document)
        .filter(Document.project_id == project_id)
        .offset(offset)
        .limit(limit)
        .all()
    )
    return docs


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
    parse_result = {}
    if DocumentParser:
        try:
            parser = DocumentParser()
            parse_result = parser.parse_document(file_info["file_path"])
            extracted_text = parse_result.get('text_content', '')
            if not extracted_text:
                # Try alternative key
                extracted_text = parse_result.get('text', '') or parse_result.get('content', '')
        except Exception as e:
            # Log error but continue
            logger.warning(f"Text extraction failed: {e}")
            extracted_text = None
    
    # Detect document type using the canonical keyword/pattern scorer
    doc_type = detect_document_type(
        extracted_text or "",
        file_info["original_filename"]
    ) if detect_document_type else "unknown"
    
    # Create document record
    document = Document(
        project_id=project_id,
        filename=file_info["filename"],
        original_filename=file_info["original_filename"],
        file_path=file_info["file_path"],
        file_size=file_info["file_size"],
        mime_type=file_info["mime_type"],
        document_type=doc_type,
        extracted_text=extracted_text,
        parse_quality=(
            parse_result.get('parse_quality', 'good')
            if parse_result and 'parse_quality' in parse_result
            else ('empty' if not extracted_text else 'good')
        ),
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

def _extract_and_save_facts(
    assistant,
    question: str,
    response: str,
    project_id: int,
    chat_id: int,
):
    """Background task: extract facts from a Q&A exchange and upsert into ProjectMemory."""
    # Need a fresh DB session since this runs outside the request context
    from backend.database import SessionLocal
    db = SessionLocal()
    try:
        facts = assistant.extract_facts(question, response)
        for fact in facts:
            key = str(fact.get("key", "")).strip()
            value = str(fact.get("value", "")).strip()
            confidence = str(fact.get("confidence", "medium")).strip()
            if not key or not value:
                continue
            existing = db.query(ProjectMemory).filter(
                ProjectMemory.project_id == project_id,
                ProjectMemory.fact_key == key,
            ).first()
            if existing:
                existing.fact_value = value
                existing.confidence = confidence
                existing.source_thread_id = chat_id
            else:
                db.add(ProjectMemory(
                    project_id=project_id,
                    fact_key=key,
                    fact_value=value,
                    confidence=confidence,
                    source_thread_id=chat_id,
                ))
        db.commit()
        if facts:
            logger.info("Memory: saved %d fact(s) for project %d", len(facts), project_id)
    except Exception as e:
        logger.warning("Memory: failed to save facts: %s", e)
    finally:
        db.close()


@app.post("/chat", response_model=ChatResponse)
@limiter.limit(CHAT_RATE_LIMIT)
async def chat(
    request: Request,
    chat_request: ChatRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Chat with AI about documents."""
    if not ConstructionAI:
        raise HTTPException(
            status_code=500,
            detail="AI assistant not available"
        )

    # project_id is required for all chat operations
    if not chat_request.project_id:
        raise HTTPException(status_code=400, detail="project_id is required")

    # Get documents for the specified project
    doc_list = []

    project = db.query(Project).filter(
        Project.id == chat_request.project_id,
        Project.owner_id == current_user.id
    ).first()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    documents = db.query(Document).filter(Document.project_id == chat_request.project_id).all()
    for doc in documents:
        # Include all documents — even those with no extracted text may have
        # visual content (drawings, maps) that the vision API can process at query time.
        text = doc.extracted_text or ""
        word_count = len(text.split()) if text else 0
        doc_list.append({
            "filename": doc.original_filename,
            "document_type": doc.document_type or "unknown",
            "text_content": text,
            "word_count": word_count,
            "file_path": doc.file_path,
        })

    # Get or create chat session for this project
    if chat_request.chat_id:
        chat = db.query(Chat).filter(
            Chat.id == chat_request.chat_id,
            Chat.project_id == chat_request.project_id,
            Chat.user_id == current_user.id
        ).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat thread not found")
    else:
        chat = db.query(Chat).filter(
            Chat.project_id == chat_request.project_id,
            Chat.user_id == current_user.id
        ).order_by(Chat.created_at.asc()).first()

    if not chat:
        chat = Chat(
            project_id=chat_request.project_id,
            user_id=current_user.id,
            title="Chat 1"
        )
        db.add(chat)
        db.commit()
        db.refresh(chat)

    # Save user message to database
    user_message = ChatMessage(
        chat_id=chat.id,
        role="user",
        content=chat_request.message
    )
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    # Load conversation history for this thread (excluding the message just saved)
    raw_history = (
        db.query(ChatMessage)
        .filter(ChatMessage.chat_id == chat.id, ChatMessage.id != user_message.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(CHAT_HISTORY_WINDOW)
        .all()
    )
    raw_history.reverse()  # restore chronological order
    chat_history = [{"role": m.role, "content": m.content} for m in raw_history]

    # Load cross-thread project memory (only if enabled)
    memory_list = []
    if chat_request.use_memory:
        memories = db.query(ProjectMemory).filter(
            ProjectMemory.project_id == chat_request.project_id
        ).order_by(ProjectMemory.updated_at.desc()).all()
        memory_list = [{"fact_key": m.fact_key, "fact_value": m.fact_value} for m in memories]

    # Load referenced chat thread context if specified
    if chat_request.referenced_chat_id:
        ref_chat = db.query(Chat).filter(
            Chat.id == chat_request.referenced_chat_id,
            Chat.project_id == chat_request.project_id,
            Chat.user_id == current_user.id
        ).first()
        if ref_chat:
            ref_msgs = db.query(ChatMessage).filter(
                ChatMessage.chat_id == ref_chat.id
            ).order_by(ChatMessage.created_at.asc()).limit(40).all()
            if ref_msgs:
                ref_title = ref_chat.title or f"Chat {ref_chat.id}"
                ref_text = "\n".join(f"{m.role.upper()}: {m.content}" for m in ref_msgs)
                chat_history = [
                    {"role": "user", "content": f"[Context from {ref_title}]\n{ref_text}"},
                    {"role": "assistant", "content": f"I've read the context from {ref_title}. How can I help?"}
                ] + chat_history

    # Create AI assistant and get response
    try:
        assistant = ConstructionAI(model=chat_request.model)

        # Load documents if available
        if doc_list:
            assistant.load_documents(doc_list)

        response = assistant.ask_question(
            chat_request.message,
            history=chat_history,
            project_memory=memory_list,
        )

        # Save assistant response to database
        assistant_message = ChatMessage(
            chat_id=chat.id,
            role="assistant",
            content=response
        )
        db.add(assistant_message)
        db.commit()
        db.refresh(assistant_message)

        # Schedule fact extraction in background (non-blocking)
        background_tasks.add_task(
            _extract_and_save_facts,
            assistant,
            chat_request.message,
            response,
            chat_request.project_id,
            chat.id,
        )

        return {
            "response": response,
            "message_id": assistant_message.id
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI error: {str(e)}"
        )


@app.get("/projects/{project_id}/chats", response_model=List[ChatThreadResponse])
async def list_chat_threads(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all chat threads for a project."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    chats = db.query(Chat).filter(
        Chat.project_id == project_id,
        Chat.user_id == current_user.id
    ).order_by(Chat.created_at.asc()).all()

    result = []
    for c in chats:
        count = db.query(ChatMessage).filter(ChatMessage.chat_id == c.id).count()
        result.append({"id": c.id, "title": c.title, "message_count": count, "created_at": c.created_at})
    return result


@app.post("/projects/{project_id}/chats", response_model=ChatHistoryResponse)
async def create_chat_thread(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new chat thread for a project."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    count = db.query(Chat).filter(
        Chat.project_id == project_id,
        Chat.user_id == current_user.id
    ).count()

    chat = Chat(
        project_id=project_id,
        user_id=current_user.id,
        title=f"Chat {count + 1}"
    )
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return {"id": chat.id, "title": chat.title, "messages": [], "created_at": chat.created_at}


@app.patch("/projects/{project_id}/chats/{chat_id}")
async def rename_chat_thread(
    project_id: int,
    chat_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Rename a chat thread."""
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.project_id == project_id,
        Chat.user_id == current_user.id
    ).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat thread not found")
    title = (body.get("title") or "").strip()
    if title:
        chat.title = title
        db.commit()
    return {"id": chat.id, "title": chat.title}


@app.delete("/projects/{project_id}/chats/{chat_id}")
async def delete_chat_thread(
    project_id: int,
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a chat thread. Cannot delete the last remaining thread."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    total = db.query(Chat).filter(
        Chat.project_id == project_id,
        Chat.user_id == current_user.id
    ).count()

    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.project_id == project_id,
        Chat.user_id == current_user.id
    ).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat thread not found")

    db.delete(chat)
    db.commit()
    return {"ok": True}


@app.get("/projects/{project_id}/chat", response_model=ChatHistoryResponse)
async def get_chat_history(
    project_id: int,
    chat_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get chat history for a project (optionally a specific thread)."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if chat_id:
        chat = db.query(Chat).filter(
            Chat.id == chat_id,
            Chat.project_id == project_id,
            Chat.user_id == current_user.id
        ).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat thread not found")
    else:
        chat = db.query(Chat).filter(
            Chat.project_id == project_id,
            Chat.user_id == current_user.id
        ).order_by(Chat.created_at.asc()).first()

    if not chat:
        chat = Chat(
            project_id=project_id,
            user_id=current_user.id,
            title="Chat 1"
        )
        db.add(chat)
        db.commit()
        db.refresh(chat)

    messages = db.query(ChatMessage).filter(
        ChatMessage.chat_id == chat.id
    ).order_by(ChatMessage.created_at.asc()).all()

    return {
        "id": chat.id,
        "title": chat.title,
        "messages": messages,
        "created_at": chat.created_at
    }


@app.get("/projects/{project_id}/memory")
async def get_project_memory(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all remembered facts for a project."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    memories = db.query(ProjectMemory).filter(
        ProjectMemory.project_id == project_id
    ).order_by(ProjectMemory.updated_at.desc()).all()

    return {
        "project_id": project_id,
        "facts": [
            {
                "key": m.fact_key,
                "value": m.fact_value,
                "confidence": m.confidence,
                "updated_at": m.updated_at,
            }
            for m in memories
        ]
    }


@app.delete("/projects/{project_id}/memory/{fact_key}")
async def delete_memory_fact(
    project_id: int,
    fact_key: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a specific remembered fact."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    fact = db.query(ProjectMemory).filter(
        ProjectMemory.project_id == project_id,
        ProjectMemory.fact_key == fact_key,
    ).first()
    if not fact:
        raise HTTPException(status_code=404, detail="Fact not found")

    db.delete(fact)
    db.commit()
    return {"message": f"Deleted fact: {fact_key}"}


@app.post("/projects/{project_id}/conflicts", response_model=List[ConflictResponse])
@limiter.limit(CONFLICTS_RATE_LIMIT)
async def analyze_conflicts(
    request: Request,
    project_id: int,
    body: ConflictsRequest = ConflictsRequest(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Analyze documents in a project for conflicts. Optionally filter to specific doc IDs."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not ConstructionAI:
        raise HTTPException(status_code=500, detail="AI assistant not available")

    query = db.query(Document).filter(Document.project_id == project_id)
    if body.doc_ids:
        query = query.filter(Document.id.in_(body.doc_ids))
    documents = query.all()

    doc_list = []
    for doc in documents:
        if doc.extracted_text:
            doc_list.append({
                "filename": doc.original_filename,
                "document_type": doc.document_type or "unknown",
                "text_content": doc.extracted_text,
                "word_count": len(doc.extracted_text.split()),
                "file_path": doc.file_path,
            })

    if len(doc_list) < 2:
        raise HTTPException(status_code=400, detail="At least 2 documents with extractable text are required")

    try:
        assistant = ConstructionAI()
        assistant.load_documents(doc_list)
        raw_conflicts = assistant.find_conflicts()

        result = []
        for i, c in enumerate(raw_conflicts):
            result.append({
                "id": str(i + 1),
                "severity": c.get("severity", "medium"),
                "title": c.get("title", "Untitled conflict"),
                "description": c.get("description", ""),
                "resolution": c.get("resolution", ""),
                "documents": c.get("documents", []),
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Conflict analysis error: {str(e)}")


@app.post("/projects/{project_id}/compare", response_model=CompareResponse)
async def compare_documents(
    project_id: int,
    body: CompareRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Deep comparison of two documents in a project."""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.owner_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not ConstructionAI:
        raise HTTPException(status_code=500, detail="AI assistant not available")

    doc1 = db.query(Document).filter(Document.id == body.doc_id_1, Document.project_id == project_id).first()
    doc2 = db.query(Document).filter(Document.id == body.doc_id_2, Document.project_id == project_id).first()

    if not doc1 or not doc2:
        raise HTTPException(status_code=404, detail="One or both documents not found")
    if doc1.id == doc2.id:
        raise HTTPException(status_code=400, detail="Select two different documents")

    doc_list = []
    for doc in [doc1, doc2]:
        doc_list.append({
            "filename": doc.original_filename,
            "document_type": doc.document_type or "unknown",
            "text_content": doc.extracted_text or "",
            "word_count": len((doc.extracted_text or "").split()),
            "file_path": doc.file_path,
        })

    try:
        assistant = ConstructionAI()
        assistant.load_documents(doc_list)
        result_dict = assistant.compare_documents(0, 1)
        return {
            "summary": result_dict.get("summary", ""),
            "conflicts": result_dict.get("conflicts", []),
            "gaps": result_dict.get("gaps", []),
            "agreements": result_dict.get("agreements", []),
            "risks": result_dict.get("risks", []),
            "doc1_name": doc1.original_filename,
            "doc2_name": doc2.original_filename,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compare error: {str(e)}")




# Run with: uvicorn backend.api:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
