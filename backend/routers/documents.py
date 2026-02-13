import os
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.core import DocumentParser, ConstructionAI, STORAGE_BACKEND
from backend.database import Document, Project, User, get_db
from backend.schemas import DocumentResponse, ConflictResponse
from backend.storage import delete_file, get_file, save_file


router = APIRouter(prefix="/projects/{project_id}", tags=["documents"])


def detect_document_type(filename: str) -> str:
    """Detect document type from filename."""
    lower = filename.lower()
    if "contract" in lower:
        return "contract"
    elif "spec" in lower:
        return "specification"
    elif "rfi" in lower:
        return "rfi"
    elif "submittal" in lower:
        return "submittal"
    elif "drawing" in lower or "dwg" in lower:
        return "drawing"
    return "unknown"


@router.get("/documents", response_model=List[DocumentResponse])
async def list_documents(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all documents in a project."""
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.owner_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    documents = db.query(Document).filter(Document.project_id == project_id).all()
    return documents


@router.post("/documents", response_model=DocumentResponse)
async def upload_document(
    project_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a document to a project."""
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.owner_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        file_info = await save_file(file, current_user.id, project_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

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

            extracted_text = result.get("text_content", "")
            if not extracted_text:
                extracted_text = result.get("text", "") or result.get("content", "")
        except Exception as e:
            import logging

            logging.warning(f"Text extraction failed: {e}")
            extracted_text = None

    doc_type = detect_document_type(file_info["original_filename"])

    if ConstructionAI:
        try:
            api_key = current_user.openai_api_key or os.environ.get("OPENAI_API_KEY")
            if api_key:
                ai_assistant = ConstructionAI(api_key=api_key)
                text_for_detection = extracted_text if extracted_text else ""
                doc_type = ai_assistant.detect_document_type(
                    file_info["original_filename"],
                    text_for_detection,
                )
        except Exception as e:
            import logging

            logging.warning(f"AI document type detection failed: {e}")

    document = Document(
        project_id=project_id,
        filename=file_info["filename"],
        original_filename=file_info["original_filename"],
        file_path=file_info["file_path"],
        file_size=file_info["file_size"],
        mime_type=file_info["mime_type"],
        document_type=doc_type,
        extracted_text=extracted_text,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    return document


@router.get("/documents/{document_id}/download")
async def download_document(
    project_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download a document.

    - local backend: serves from filesystem path
    - s3 backend: streams object bytes through API

    (We can switch to pre-signed URLs later if desired.)
    """
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.owner_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.project_id == project_id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if STORAGE_BACKEND == "s3":
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
        media_type=document.mime_type,
    )


@router.delete("/documents/{document_id}")
async def delete_document(
    project_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a document."""
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.owner_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.project_id == project_id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    delete_file(document.file_path)

    db.delete(document)
    db.commit()
    return {"message": "Document deleted"}


@router.post("/conflicts", response_model=List[ConflictResponse])
async def analyze_conflicts(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Analyze documents in a project for conflicts."""
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.owner_id == current_user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    documents = db.query(Document).filter(Document.project_id == project_id).all()

    if len(documents) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 documents are required for conflict analysis",
        )

    api_key = current_user.openai_api_key or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No OpenAI API key configured. Please add your API key in settings.",
        )

    if not ConstructionAI:
        raise HTTPException(status_code=500, detail="AI assistant not available")

    doc_list = []
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

    if len(doc_list) < 2:
        raise HTTPException(
            status_code=400,
            detail="At least 2 documents with extractable text are required",
        )

    try:
        assistant = ConstructionAI(api_key=api_key)
        assistant.load_documents(doc_list)
        conflict_analysis = assistant.find_conflicts()
        conflicts = _parse_conflict_response(
            conflict_analysis, [d["filename"] for d in doc_list]
        )
        return conflicts
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Conflict analysis error: {str(e)}",
        )


def _parse_conflict_response(analysis_text: str, document_names: List[str]):
    """Parse AI conflict analysis text into structured conflict objects."""
    import re

    conflicts = []

    sections = re.split(
        r"\n(?=##|\d+\.|[-*]|Conflict|Issue|Problem)",
        analysis_text,
        flags=re.IGNORECASE,
    )

    conflict_id = 1
    for section in sections:
        section = section.strip()
        if not section or len(section) < 50:
            continue

        severity = "medium"
        if any(word in section.lower() for word in ["critical", "urgent", "severe", "high", "major"]):
            severity = "high"
        elif any(word in section.lower() for word in ["minor", "low", "small"]):
            severity = "low"

        lines = section.split("\n")
        title = lines[0].strip()
        if title.startswith("#"):
            title = title.lstrip("#").strip()
        if len(title) > 100:
            title = title[:100] + "..."

        description = "\n".join(lines[1:]).strip()[:500]
        if not description:
            description = section[:500]

        mentioned_docs = []
        for doc_name in document_names:
            if doc_name.lower() in section.lower():
                mentioned_docs.append(doc_name)

        if not mentioned_docs and len(document_names) >= 2:
            mentioned_docs = document_names[:2]

        if title and description and mentioned_docs:
            conflicts.append(
                {
                    "id": str(conflict_id),
                    "severity": severity,
                    "title": title,
                    "description": description,
                    "documents": mentioned_docs,
                }
            )
            conflict_id += 1

    if not conflicts and analysis_text:
        conflicts.append(
            {
                "id": "1",
                "severity": "medium",
                "title": "Document Analysis Results",
                "description": analysis_text[:500],
                "documents": document_names[:2]
                if len(document_names) >= 2
                else document_names,
            }
        )

    return conflicts
