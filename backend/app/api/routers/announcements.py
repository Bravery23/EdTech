from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import datetime

from app.core.db import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.models.school import Announcement, ClassTeacher, Class

router = APIRouter()

# ---- Schemas ----
class AnnouncementCreate(BaseModel):
    title: str
    content: str
    class_id: int

class AnnouncementOut(BaseModel):
    id: int
    title: str
    content: str
    class_id: int
    teacher_id: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# ---- Endpoints ----

@router.get("/class/{class_id}", response_model=List[AnnouncementOut])
def get_class_announcements(
    class_id: int,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy danh sách thông báo của một lớp (Tất cả user học sinh/phụ huynh lớp đó hoặc giáo viên đều xem được)."""
    # Simple logic: Anyone authenticated can view class announcements for now
    # More strict: check if student is in ClassStudent for class_id
    announcements = db.query(Announcement).filter(
        Announcement.class_id == class_id
    ).order_by(Announcement.created_at.desc()).limit(limit).all()
    return announcements


@router.post("/", response_model=AnnouncementOut, status_code=status.HTTP_201_CREATED)
def create_announcement(
    ann_in: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("subject_teacher", "homeroom_teacher", "admin"))
):
    """Giáo viên hoặc Admin tạo thông báo cho một lớp."""
    # Check if class exists
    school_class = db.query(Class).filter(Class.id == ann_in.class_id).first()
    if not school_class:
        raise HTTPException(status_code=404, detail="Class not found")
        
    role_set = set(r.strip() for r in (current_user.role or "").split(","))
    
    # If not admin, check if teacher is allowed
    if "admin" not in role_set:
        # Check if homeroom teacher
        is_homeroom = school_class.homeroom_teacher_id == current_user.id
        
        # Check if subject teacher for this class
        is_subject_teacher = db.query(ClassTeacher).filter(
            ClassTeacher.class_id == ann_in.class_id,
            ClassTeacher.teacher_id == current_user.id
        ).first() is not None
        
        if not is_homeroom and not is_subject_teacher:
            raise HTTPException(status_code=403, detail="Not authorized to announce to this class")

    new_announcement = Announcement(
        title=ann_in.title,
        content=ann_in.content,
        class_id=ann_in.class_id,
        teacher_id=current_user.id
    )
    db.add(new_announcement)
    db.commit()
    db.refresh(new_announcement)
    return new_announcement


@router.delete("/{ann_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_announcement(
    ann_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("subject_teacher", "homeroom_teacher", "admin"))
):
    """Xóa thông báo (Chỉ người tạo hoặc Admin)."""
    ann = db.query(Announcement).filter(Announcement.id == ann_id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
        
    role_set = set(r.strip() for r in (current_user.role or "").split(","))
    if "admin" not in role_set and ann.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only delete your own announcements")
        
    db.delete(ann)
    db.commit()
