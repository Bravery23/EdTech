from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.core.db import get_db
from app.core.deps import get_current_user, require_role
from app.core.security import get_password_hash
from app.models.user import User, ParentStudent

router = APIRouter()


class UserOut(BaseModel):
    id: int
    email: str
    full_name: Optional[str]
    role: List[str]
    is_active: bool

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[List[str]] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


@router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    return db.query(User).all()


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.password:
        user.hashed_password = get_password_hash(body.password)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()


@router.get("/{parent_id}/students", response_model=List[UserOut])
def get_parent_students(
    parent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lấy danh sách học sinh của một phụ huynh (Dành cho chính phụ huynh hoặc admin)."""
    role_set = set(current_user.role or [])
    if "admin" not in role_set and current_user.id != parent_id:
        raise HTTPException(status_code=403, detail="Unuthorized to view this parent's students")

    parent_students = db.query(ParentStudent).filter(ParentStudent.parent_id == parent_id).all()
    student_ids = [ps.student_id for ps in parent_students]
    
    if not student_ids:
        return []
        
    return db.query(User).filter(User.id.in_(student_ids)).all()


@router.post("/{parent_id}/students/{student_id}", status_code=status.HTTP_201_CREATED)
def link_parent_student(
    parent_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin"))
):
    """Liên kết phụ huynh với học sinh (Chỉ Admin)."""
    parent = db.query(User).filter(User.id == parent_id).first()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
        
    student = db.query(User).filter(User.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    existing = db.query(ParentStudent).filter(
        ParentStudent.parent_id == parent_id,
        ParentStudent.student_id == student_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student already linked to this parent")

    new_link = ParentStudent(parent_id=parent_id, student_id=student_id)
    db.add(new_link)
    db.commit()
    return {"message": "Parent and Student linked successfully"}


@router.delete("/{parent_id}/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def unlink_parent_student(
    parent_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin"))
):
    """Hủy liên kết phụ huynh và học sinh (Chỉ Admin)."""
    link = db.query(ParentStudent).filter(
        ParentStudent.parent_id == parent_id,
        ParentStudent.student_id == student_id
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
        
    db.delete(link)
    db.commit()
