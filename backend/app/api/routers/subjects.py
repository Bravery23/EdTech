from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.core.db import get_db
from app.core.deps import require_role
from app.models.subject import Subject

router = APIRouter()

class SubjectCreate(BaseModel):
    name: str
    code: Optional[str] = None

class SubjectOut(BaseModel):
    id: int
    name: str
    code: Optional[str]

    class Config:
        from_attributes = True

@router.get("/", response_model=List[SubjectOut])
def list_subjects(db: Session = Depends(get_db)):
    """Lấy danh sách điểm các môn học (Công khai cho mọi user có token)."""
    return db.query(Subject).all()

@router.post("/", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
def create_subject(
    req: SubjectCreate, 
    db: Session = Depends(get_db), 
    _ = Depends(require_role("admin"))
):
    """Tạo mới môn học (Chỉ Admin)."""
    existing = db.query(Subject).filter((Subject.name == req.name) | (Subject.code == req.code)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Subject with this name or code already exists")
    
    subject = Subject(name=req.name, code=req.code)
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject

@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
    subject_id: int, 
    db: Session = Depends(get_db), 
    _ = Depends(require_role("admin"))
):
    """Xóa môn học (Chỉ Admin)."""
    subject = db.query(Subject).filter(Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
        
    db.delete(subject)
    db.commit()
