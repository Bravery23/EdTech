from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import datetime

from app.core.db import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.models.school import Class, ClassStudent, ClassTeacher

router = APIRouter()

# ---- Schemas ----
class ClassCreate(BaseModel):
    name: str
    grade_level: int
    academic_year: str
    homeroom_teacher_id: Optional[int] = None

class ClassUpdate(BaseModel):
    name: Optional[str] = None
    grade_level: Optional[int] = None
    academic_year: Optional[str] = None
    homeroom_teacher_id: Optional[int] = None

class ClassOut(BaseModel):
    id: int
    name: str
    grade_level: int
    academic_year: str
    homeroom_teacher_id: Optional[int]
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: List[str]

    class Config:
        from_attributes = True

class ClassStudentOut(BaseModel):
    student_id: int
    student: UserOut
    joined_at: datetime.datetime

    class Config:
        from_attributes = True

# ---- Endpoints ----

@router.get("/my-subjects")
def get_my_subjects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Học sinh lấy danh sách môn học và giáo viên của lớp mình."""
    # Find the student's class
    enrollment = db.query(ClassStudent).filter(ClassStudent.student_id == current_user.id).first()
    if not enrollment:
        return {"class": None, "subjects": [], "homeroom_teacher": None}

    school_class = db.query(Class).filter(Class.id == enrollment.class_id).first()
    
    # Get all subject-teacher assignments for this class
    assignments = db.query(ClassTeacher).filter(ClassTeacher.class_id == enrollment.class_id).all()
    
    subjects = []
    for a in assignments:
        subjects.append({
            "subject_id": a.subject_id,
            "subject_name": a.subject.name,
            "subject_code": a.subject.code,
            "teacher_id": a.teacher_id,
            "teacher_name": a.teacher.full_name,
            "teacher_email": a.teacher.email,
        })

    homeroom = None
    if school_class and school_class.homeroom_teacher_id:
        ht = school_class.homeroom_teacher
        homeroom = {
            "teacher_id": ht.id,
            "teacher_name": ht.full_name,
            "teacher_email": ht.email,
        }

    return {
        "class_id": enrollment.class_id,
        "class_name": school_class.name if school_class else None,
        "academic_year": school_class.academic_year if school_class else None,
        "subjects": subjects,
        "homeroom_teacher": homeroom,
    }


@router.get("/", response_model=List[ClassOut])
def list_classes(
    skip: int = 0, limit: int = 100, db: Session = Depends(get_db)
):
    """Lấy danh sách tất cả các lớp (Ai cũng xem được)."""
    return db.query(Class).offset(skip).limit(limit).all()


@router.get("/teacher-classes", response_model=List[ClassOut])
def list_teacher_classes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy danh sách các lớp mà giáo viên đang quản lý hoặc giảng dạy."""
    role_set = set(current_user.role or [])
    if "admin" in role_set:
        return db.query(Class).all()

    # Lớp mà user làm GVCN
    homeroom_classes = db.query(Class).filter(Class.homeroom_teacher_id == current_user.id).all()
    
    # Lớp mà user làm GVBM
    subject_assignments = db.query(ClassTeacher).filter(ClassTeacher.teacher_id == current_user.id).all()
    subject_class_ids = [a.class_id for a in subject_assignments]
    subject_classes = db.query(Class).filter(Class.id.in_(subject_class_ids)).all()
    
    # Gộp và loại bỏ trùng lặp (deduplicate)
    all_classes_dict = {c.id: c for c in homeroom_classes + subject_classes}
    
    # Sắp xếp theo tên lớp
    return sorted(list(all_classes_dict.values()), key=lambda x: x.name)



@router.post("/", response_model=ClassOut, status_code=status.HTTP_201_CREATED)
def create_class(
    class_in: ClassCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin"))
):
    """Tạo lớp học mới (Chỉ Admin)."""
    new_class = Class(**class_in.dict())
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    return new_class


@router.put("/{class_id}", response_model=ClassOut)
def update_class(
    class_id: int,
    class_update: ClassUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin"))
):
    """Cập nhật thông tin lớp (Chỉ Admin)."""
    db_class = db.query(Class).filter(Class.id == class_id).first()
    if not db_class:
        raise HTTPException(status_code=404, detail="Class not found")
    
    update_data = class_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_class, key, value)
    
    db.commit()
    db.refresh(db_class)
    return db_class


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_class(
    class_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin"))
):
    """Xóa lớp (Chỉ Admin)."""
    db_class = db.query(Class).filter(Class.id == class_id).first()
    if not db_class:
        raise HTTPException(status_code=404, detail="Class not found")
    db.delete(db_class)
    db.commit()


@router.get("/{class_id}/students", response_model=List[ClassStudentOut])
def list_students_in_class(
    class_id: int,
    db: Session = Depends(get_db)
):
    """Xem danh sách học sinh của một lớp (Ai cũng xem được)."""
    db_class = db.query(Class).filter(Class.id == class_id).first()
    if not db_class:
        raise HTTPException(status_code=404, detail="Class not found")
    return db.query(ClassStudent).filter(ClassStudent.class_id == class_id).all()


@router.post("/{class_id}/students/{student_id}", status_code=status.HTTP_201_CREATED)
def add_student_to_class(
    class_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin"))
):
    """Thêm học sinh vào lớp (Chỉ Admin)."""
    db_class = db.query(Class).filter(Class.id == class_id).first()
    if not db_class:
        raise HTTPException(status_code=404, detail="Class not found")
    
    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student user not found")
        
    existing = db.query(ClassStudent).filter(
        ClassStudent.class_id == class_id, ClassStudent.student_id == student_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student already in class")
        
    db_cs = ClassStudent(class_id=class_id, student_id=student_id)
    db.add(db_cs)
    db.commit()
    return {"message": "Student added successfully"}


@router.delete("/{class_id}/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_student_from_class(
    class_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin"))
):
    """Xóa học sinh khỏi lớp (Chỉ Admin)."""
    db_cs = db.query(ClassStudent).filter(
        ClassStudent.class_id == class_id, ClassStudent.student_id == student_id
    ).first()
    if not db_cs:
        raise HTTPException(status_code=404, detail="Student is not in this class")
    db.delete(db_cs)
    db.commit()


@router.get("/{class_id}/teachers")
def list_teachers_in_class(
    class_id: int,
    db: Session = Depends(get_db)
):
    """Lấy danh sách giáo viên bộ môn của một lớp."""
    db_class = db.query(Class).filter(Class.id == class_id).first()
    if not db_class:
        raise HTTPException(status_code=404, detail="Class not found")
        
    assignments = db.query(ClassTeacher).filter(ClassTeacher.class_id == class_id).all()
    res = []
    for a in assignments:
        res.append({
            "teacher_id": a.teacher_id,
            "teacher": {
                "id": a.teacher.id,
                "full_name": a.teacher.full_name,
                "email": a.teacher.email
            },
            "subject_id": a.subject_id,
            "subject": {
                "id": a.subject.id,
                "name": a.subject.name
            }
        })
    return res


@router.post("/{class_id}/teachers/{teacher_id}", status_code=status.HTTP_201_CREATED)
def add_teacher_to_class(
    class_id: int,
    teacher_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin"))
):
    """Phân công giáo viên bộ môn cho lớp (Chỉ Admin)."""
    db_class = db.query(Class).filter(Class.id == class_id).first()
    if not db_class:
        raise HTTPException(status_code=404, detail="Class not found")
    
    teacher = db.query(User).filter(User.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher user not found")
        
    existing = db.query(ClassTeacher).filter(
        ClassTeacher.class_id == class_id, ClassTeacher.teacher_id == teacher_id, ClassTeacher.subject_id == subject_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Teacher already assigned to this subject in this class")
        
    db_ct = ClassTeacher(class_id=class_id, teacher_id=teacher_id, subject_id=subject_id)
    db.add(db_ct)
    db.commit()
    return {"message": "Teacher assigned successfully"}


@router.delete("/{class_id}/teachers/{teacher_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_teacher_from_class(
    class_id: int,
    teacher_id: int,
    subject_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin"))
):
    """Xóa phân công giáo viên bộ môn khỏi lớp (Chỉ Admin)."""
    db_ct = db.query(ClassTeacher).filter(
        ClassTeacher.class_id == class_id, ClassTeacher.teacher_id == teacher_id, ClassTeacher.subject_id == subject_id
    ).first()
    if not db_ct:
        raise HTTPException(status_code=404, detail="Teacher assignment not found")
    db.delete(db_ct)
    db.commit()
