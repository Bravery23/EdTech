from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Text, UniqueConstraint
from sqlalchemy.orm import relationship
import datetime
from app.models.base import Base

class Class(Base):
    __tablename__ = "classes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    grade_level = Column(Integer, nullable=False) # e.g., 10, 11, 12
    academic_year = Column(String, nullable=False) # e.g., "2023-2024"
    homeroom_teacher_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    homeroom_teacher = relationship("User", foreign_keys=[homeroom_teacher_id])
    students = relationship("ClassStudent", back_populates="school_class")

class ClassStudent(Base):
    __tablename__ = "class_students"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    joined_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Constraints
    __table_args__ = (
        UniqueConstraint('class_id', 'student_id', name='uq_class_student'),
    )

    # Relationships
    school_class = relationship("Class", back_populates="students")
    student = relationship("User")

class Grade(Base):
    __tablename__ = "grades"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    semester = Column(Integer, nullable=False) # e.g., 1, 2
    academic_year = Column(String, nullable=False) # e.g., "2023-2024"
    exam_type = Column(String, nullable=False) # e.g., "15p", "1_tiet", "giua_ky", "cuoi_ky"
    score = Column(Float, nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id")) # Teacher who graded
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    # Relationships
    student = relationship("User", foreign_keys=[student_id])
    subject = relationship("Subject")
    teacher = relationship("User", foreign_keys=[teacher_id])
    
    @property
    def subject_name(self):
        return self.subject.name if self.subject else None

class ClassTeacher(Base):
    __tablename__ = "class_teachers"

    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)

    # Constraints
    __table_args__ = (
        UniqueConstraint('class_id', 'teacher_id', 'subject_id', name='uq_class_teacher'),
    )

    # Relationships
    school_class = relationship("Class")
    teacher = relationship("User")
    subject = relationship("Subject")

class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    class_id = Column(Integer, ForeignKey("classes.id"), nullable=False)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    school_class = relationship("Class")
    teacher = relationship("User")
