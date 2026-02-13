from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import os

from backend.auth import get_current_user
from backend.core import ConstructionAI
from backend.database import Chat, ChatMessage, Document, Project, User, get_db
from backend.schemas import ChatHistoryResponse, ChatRequest, ChatResponse


router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Chat with AI about documents."""
    api_key = current_user.openai_api_key or os.environ.get("OPENAI_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No OpenAI API key configured. Please add your API key in settings.",
        )

    if not ConstructionAI:
        raise HTTPException(status_code=500, detail="AI assistant not available")

    doc_list = []

    if request.project_id:
        project = (
            db.query(Project)
            .filter(Project.id == request.project_id, Project.owner_id == current_user.id)
            .first()
        )
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        documents = db.query(Document).filter(Document.project_id == request.project_id).all()
        for doc in documents:
            if doc.extracted_text:
                word_count = len(doc.extracted_text.split())
                doc_list.append(
                    {
                        "filename": doc.original_filename,
                        "document_type": doc.document_type or "unknown",
                        "text_content": doc.extracted_text,
                        "word_count": word_count,
                    }
                )
    else:
        projects = db.query(Project).filter(Project.owner_id == current_user.id).all()
        for project in projects:
            documents = db.query(Document).filter(Document.project_id == project.id).all()
            for doc in documents:
                if doc.extracted_text:
                    word_count = len(doc.extracted_text.split())
                    doc_list.append(
                        {
                            "filename": doc.original_filename,
                            "document_type": doc.document_type or "unknown",
                            "text_content": doc.extracted_text,
                            "word_count": word_count,
                        }
                    )

    if not request.project_id:
        raise HTTPException(status_code=400, detail="project_id is required")

    chat = (
        db.query(Chat)
        .filter(Chat.project_id == request.project_id, Chat.user_id == current_user.id)
        .first()
    )

    if not chat:
        chat = Chat(project_id=request.project_id, user_id=current_user.id)
        db.add(chat)
        db.commit()
        db.refresh(chat)

    user_message = ChatMessage(chat_id=chat.id, role="user", content=request.message)
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    try:
        assistant = ConstructionAI(api_key=api_key)
        if doc_list:
            assistant.load_documents(doc_list)
        response = assistant.ask_question(request.message)

        assistant_message = ChatMessage(
            chat_id=chat.id, role="assistant", content=response
        )
        db.add(assistant_message)
        db.commit()
        db.refresh(assistant_message)

        return {"response": response, "message_id": assistant_message.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")


@router.get("/projects/{project_id}/chat", response_model=ChatHistoryResponse)
async def get_chat_history(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get chat history for a project."""
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.owner_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    chat = (
        db.query(Chat)
        .filter(Chat.project_id == project_id, Chat.user_id == current_user.id)
        .first()
    )

    if not chat:
        chat = Chat(project_id=project_id, user_id=current_user.id)
        db.add(chat)
        db.commit()
        db.refresh(chat)

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.chat_id == chat.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    return {"id": chat.id, "messages": messages, "created_at": chat.created_at}
