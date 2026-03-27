from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import datetime

from app.core.db import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.models.school import Grade, ClassStudent

router = APIRouter()

# ---- Schemas ----
class GradeCreate(BaseModel):
    student_id: int
    subject_id: int
    semester: int
    academic_year: str
    exam_type: str # e.g., "15p", "1_tiet", "giua_ky", "cuoi_ky"
    score: float
    comments: Optional[str] = None

class GradeUpdate(BaseModel):
    score: Optional[float] = None
    comments: Optional[str] = None
    exam_type: Optional[str] = None

class GradeOut(BaseModel):
    id: int
    student_id: int
    subject_id: int
    subject_name: Optional[str] = None
    semester: int
    academic_year: str
    exam_type: str
    score: float
    teacher_id: int
    comments: Optional[str]
    created_at: datetime.datetime

    class Config:
        from_attributes = True

# ---- Endpoints ----

@router.get("/student/{student_id}", response_model=List[GradeOut])
def get_student_grades(
    student_id: int,
    subject_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy danh sách điểm của một học sinh (Giáo viên, Admin, Hoặc chính học sinh đó)."""
    # Simple access control: Allow if admin/teacher, or if user is the student
    role_set = set(current_user.role or [])
    if "admin" not in role_set and "subject_teacher" not in role_set and "homeroom_teacher" not in role_set and "parent" not in role_set:
        if current_user.id != student_id:
            raise HTTPException(status_code=403, detail="Not allowed to view other student's grades")

    query = db.query(Grade).filter(Grade.student_id == student_id, Grade.deleted_at == None)
    if subject_id:
        query = query.filter(Grade.subject_id == subject_id)
    return query.all()


@router.get("/class/{class_id}", response_model=List[GradeOut])
def get_class_grades(
    class_id: int,
    subject_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "subject_teacher", "homeroom_teacher"))
):
    """Lấy danh sách điểm của cả 1 lớp (Dành cho Giáo viên / Admin)."""
    student_ids = [cs.student_id for cs in db.query(ClassStudent).filter(ClassStudent.class_id == class_id).all()]
    if not student_ids:
        return []
    
    query = db.query(Grade).filter(Grade.student_id.in_(student_ids), Grade.deleted_at == None)
    if subject_id:
        query = query.filter(Grade.subject_id == subject_id)
        
    return query.all()


@router.post("/", response_model=GradeOut, status_code=status.HTTP_201_CREATED)
def create_grade(
    grade_in: GradeCreate,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(require_role("subject_teacher"))
):
    """Nhập điểm mới cho học sinh (Dành cho Giáo viên bộ môn)."""
    new_grade = Grade(**grade_in.dict(), teacher_id=current_teacher.id)
    db.add(new_grade)
    db.commit()
    db.refresh(new_grade)
    return new_grade


@router.put("/{grade_id}", response_model=GradeOut)
def update_grade(
    grade_id: int,
    grade_update: GradeUpdate,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(require_role("subject_teacher"))
):
    """Sửa điểm (Dành cho Giáo viên bộ môn - Có thể thêm logic chỉ cho phép người thiết lập điểm sửa)."""
    db_grade = db.query(Grade).filter(Grade.id == grade_id, Grade.deleted_at == None).first()
    if not db_grade:
        raise HTTPException(status_code=404, detail="Grade not found")
        
    # Optional logic: Only the teacher who entered it can update it
    if db_grade.teacher_id != current_teacher.id:
        raise HTTPException(status_code=403, detail="Can only update grades you entered")

    update_data = grade_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_grade, key, value)
    
    db.commit()
    db.refresh(db_grade)
    return db_grade


@router.delete("/{grade_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_grade(
    grade_id: int,
    db: Session = Depends(get_db),
    current_teacher: User = Depends(require_role("subject_teacher", "admin"))
):
    """Xóa điểm (Dành cho Giáo viên bộ môn đã nhập hoặc admin)."""
    db_grade = db.query(Grade).filter(Grade.id == grade_id, Grade.deleted_at == None).first()
    if not db_grade:
        raise HTTPException(status_code=404, detail="Grade not found")

    role_set = set(current_teacher.role or [])
    if "admin" not in role_set and db_grade.teacher_id != current_teacher.id:
        raise HTTPException(status_code=403, detail="Can only delete grades you entered")

    db_grade.deleted_at = datetime.datetime.utcnow()
    db.commit()
