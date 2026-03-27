from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey, DateTime
from sqlalchemy.orm import relationship
import datetime
from app.models.base import Base

class Document(Base):
    """
    Simulates a Vector Store inside Postgres using pgvector.
    Alternatively, Langchain's direct pgvector wrapper can be used, 
    but having a model gives more control over metadata.
    """
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(3072)) # Using pgvector for deepseek/huggingface embeddings
    metadata_json = Column(JSONB, default={}) # e.g. subject, filename, page
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Differentiate different teachers' docs
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)
    
    teacher = relationship("User")
