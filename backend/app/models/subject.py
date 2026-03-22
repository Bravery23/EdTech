from sqlalchemy import Column, Integer, String, DateTime
import datetime
from app.models.base import Base

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False) # e.g., "Toán học"
    code = Column(String, unique=True, index=True, nullable=True)  # e.g., "MATH"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
