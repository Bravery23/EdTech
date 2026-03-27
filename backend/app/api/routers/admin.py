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
from app.services.ai_core import AICore
from sqlalchemy import Integer

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
    class_id: int = Form(..., description="ID lớp học"),
    subject_id: Optional[int] = Form(None, description="ID môn học"),
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

    if subject_id:
        subject_obj = db.query(Subject).filter(Subject.id == subject_id).first()
        if not subject_obj:
            raise HTTPException(status_code=404, detail="Subject not found")
    else:
        subject_obj = None
        
    subject_name = subject_obj.name if subject_obj else None

    # 1. Save to disk
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        # 2 & 3. Process with AI_Core
        ai_core = AICore(db)
        chunk_count = ai_core.index_document(
            file_path=file_path, 
            filename=file.filename, 
            uploader=current_user, 
            class_id=class_id, 
            subject_id=subject_id, 
            subject_name=subject_name
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG pipeline error: {str(e)}")
    finally:
        os.remove(file_path)  # clean up temp file

    return {
        "message": f"Đã xử lý {chunk_count} chunks từ file '{file.filename}'.",
        "chunks_count": chunk_count,
    }


@router.get("/documents", response_model=List[DocumentOut])
def list_documents(
    class_id: Optional[int] = None,
    subject_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("subject_teacher", "homeroom_teacher")),
):
    query = db.query(Document).filter(Document.teacher_id == current_user.id, Document.deleted_at == None)
    
    if class_id:
        query = query.filter(Document.metadata_json["class_id"].astext.cast(Integer) == class_id)
    if subject_id:
        query = query.filter(Document.metadata_json["subject_id"].astext.cast(Integer) == subject_id)
        
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
