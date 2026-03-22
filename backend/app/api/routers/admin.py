import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.core.db import get_db
from app.core.deps import require_role
from app.models.document import Document
from app.models.user import User
from app.models.subject import Subject
from app.services.document_parser import parse_and_chunk_document
from app.services.vector_db import VectorStoreService

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class DocumentOut(BaseModel):
    id: int
    content: str
    metadata_json: Optional[dict]

    class Config:
        from_attributes = True


@router.post("/documents", status_code=201)
async def upload_document(
    subject_id: int = Form(..., description="ID môn học"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("subject_teacher", "homeroom_teacher")),
):
    """
    Upload a PDF/DOCX/TXT document and trigger the RAG pipeline:
    1. Save file to disk
    2. Parse + chunk the document
    3. Embed chunks using HuggingFace and store in PostgreSQL (pgvector)
    """
    allowed_types = {".pdf", ".docx", ".txt"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{ext}'. Allowed: {allowed_types}")

    subject_obj = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject_obj:
        raise HTTPException(status_code=404, detail="Subject not found")
        
    subject_name = subject_obj.name

    # 1. Save to disk
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        # 2. Parse + chunk
        chunks = parse_and_chunk_document(file_path)

        # 3. Embed + store in vector DB
        vector_service = VectorStoreService(db)
        texts = [c.page_content for c in chunks]
        metadatas = [{"subject_id": subject_id, "subject": subject_name, "filename": file.filename, **c.metadata} for c in chunks]
        vector_service.add_texts(texts, metadatas, teacher_id=current_user.id)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG pipeline error: {str(e)}")
    finally:
        os.remove(file_path)  # clean up temp file

    return {
        "message": f"Đã xử lý {len(chunks)} chunks từ file '{file.filename}' cho môn {subject_name}.",
        "chunks_count": len(chunks),
    }


@router.get("/documents", response_model=List[DocumentOut])
def list_documents(
    subject: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("subject_teacher", "homeroom_teacher")),
):
    query = db.query(Document).filter(Document.teacher_id == current_user.id, Document.deleted_at == None)
    if subject:
        # Filter by subject in JSON metadata
        query = query.filter(Document.metadata_json["subject"].astext == subject)
    return query.limit(limit).all()


@router.delete("/documents/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("subject_teacher", "homeroom_teacher")),
):
    doc = db.query(Document).filter(Document.id == doc_id, Document.teacher_id == current_user.id, Document.deleted_at == None).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    import datetime
    doc.deleted_at = datetime.datetime.utcnow()
    db.commit()
