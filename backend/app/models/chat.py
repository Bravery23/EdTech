from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, JSON
from app.models.base import Base
import datetime

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    subject = Column(String) # to separate context namespaces
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"))
    role = Column(String) # user, assistant, system
    content = Column(Text)
    metadata_json = Column(JSON, nullable=True) # Any context, citation links
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
