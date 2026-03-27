from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.config import settings
from app.core.deps import get_current_user
from app.services.agent_service import EdTechAgentService
from app.services.vector_db import VectorStoreService
from app.models.chat import ChatMessage
from app.models.user import User, ParentStudent
from app.models.school import ClassStudent, ClassTeacher, Grade
from app.models.subject import Subject
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
_agent_service = None

def get_agent_service() -> EdTechAgentService:
    global _agent_service
    if _agent_service is None:
        _agent_service = EdTechAgentService()
    return _agent_service


class ChatRequest(BaseModel):
    query: str
    subject: Optional[str] = "Toán học"
    role: str = "student"          # student | parent
    session_id: Optional[int] = None  # if provided, messages are persisted
    stream: bool = False              # if True, use Server-Sent Events


@router.post("/message")
async def send_message(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # --- Mock mode: no DeepSeek key ---
    if not settings.DEEPSEEK_API_KEY:
        return {
            "response": (
                f"[MOCK] Thầy đã nhận câu hỏi '{req.query}' về môn {req.subject}. Hãy thử tính Delta nhé!"
                if req.role == "student"
                else "[MOCK] Điểm của cháu đang ổn định. Anh/chị lưu ý phần thông báo lịch thi."
            )
        }
    
    # Find teacher_id to scope documents
    teacher_id = None
    if req.role == "student":
        # Get student's class
        school_class = db.query(ClassStudent).filter(ClassStudent.student_id == current_user.id).first()
        if school_class:
            subject_obj = db.query(Subject).filter(Subject.name == req.subject).first()
            if subject_obj:
                # Find subject teacher for that class
                teacher_assign = db.query(ClassTeacher).filter(
                    ClassTeacher.class_id == school_class.class_id,
                    ClassTeacher.subject_id == subject_obj.id
                ).first()
                if teacher_assign:
                    teacher_id = teacher_assign.teacher_id

    # Define a callback for Student Agent to search knowledge base
    def knowledge_search_func(search_query: str) -> str:
        try:
            vector_service = VectorStoreService(db)
            logger.info(f"[VectorDB Tool] Searching for query: '{search_query}'")
            docs = vector_service.similarity_search(
                query=search_query,
                class_id=school_class.class_id if school_class else None,
                subject_id=subject_obj.id if subject_obj else None,
                teacher_id=teacher_id,
                top_k=4
            )
            return "\n".join([d.content for d in docs])
        except Exception as e:
            logger.warning(f"Vector DB tool error: {e}")
            return "Không thể truy cập cơ sở dữ liệu nội bộ."
            
    # Define a callback for Parent Agent to search school policy
    def search_policy_func(search_query: str) -> str:
        try:
            vector_service = VectorStoreService(db)
            logger.info(f"[VectorDB Tool] Searching policy for query: '{search_query}'")
            docs = vector_service.similarity_search(
                query=search_query,
                top_k=3
            )
            return "\n".join([d.content for d in docs])
        except Exception as e:
            logger.warning(f"Vector DB tool error: {e}")
            return ""

    # Fetch chat history if session_id is provided
    chat_history = ""
    sql_data = "" # Initialize sql_data
    if req.session_id:
        student_ids = []
        if req.role == "parent":
            # Find students associated with this parent
            parent_students = db.query(ParentStudent).filter(ParentStudent.parent_id == current_user.id).all()
            student_ids = [ps.student_id for ps in parent_students]
        elif req.role == "student":
            student_ids = [current_user.id]

        if student_ids:
            # Fetch recent grades
            grades = db.query(Grade).join(Subject, Grade.subject_id == Subject.id).filter(
                Grade.student_id.in_(student_ids), 
                Grade.deleted_at == None
            ).order_by(Grade.created_at.desc()).limit(20).all()
            if grades:
                lines = ["[Dữ liệu Điểm số từ Database]"]
                for g in grades:
                    lines.append(f"- Kỳ {g.semester} ({g.academic_year}) | Môn: {g.subject.name} | Loại: {g.exam_type} | Điểm: {g.score} | Điểm số: {g.score} | Nhận xét: {g.comments or 'Không'}")
                sql_data = "\n".join(lines)
            else:
                sql_data = "" # No grades found for these students

        recent_messages = db.query(ChatMessage).filter(
            ChatMessage.session_id == req.session_id
        ).order_by(ChatMessage.created_at.desc()).limit(5).all()
        
        # reverse them to chronological order
        recent_messages.reverse()
        history_lines = [f"{'Học sinh' if msg.role == 'user' else 'Giáo viên'}: {msg.content}" for msg in recent_messages]
        chat_history = "\n".join(history_lines)

    # --- Streaming Response ---
    agent_service = get_agent_service()
    
    if req.stream:
        async def response_generator():
            full_response = ""
            if req.role == "student":
                async for chunk in agent_service.student_agent_stream(
                    query=req.query,
                    subject=req.subject,
                    chat_history_str=chat_history,
                    knowledge_search_func=knowledge_search_func
                ):
                    full_response += chunk
                    cleaned_chunk = chunk.replace("\n", "\\n")
                    yield f"data: {cleaned_chunk}\n\n"
                    
            elif req.role == "parent":
                def get_grades_func() -> str:
                    return sql_data
                    
                async for chunk in agent_service.parent_agent_stream(
                    query=req.query,
                    chat_history_str=chat_history,
                    get_grades_func=get_grades_func,
                    search_policy_func=search_policy_func
                ):
                    full_response += chunk
                    cleaned_chunk = chunk.replace("\n", "\\n")
                    yield f"data: {cleaned_chunk}\n\n"
                    
            yield "data: [DONE]\n\n"
            
            if req.session_id:
                try:
                    db_new = next(get_db())
                    db_new.add(ChatMessage(session_id=req.session_id, role="user", content=req.query))
                    db_new.add(ChatMessage(session_id=req.session_id, role="assistant", content=full_response))
                    db_new.commit()
                except Exception as e:
                    logger.warning(f"Save message error: {e}")

        return StreamingResponse(response_generator(), media_type="text/event-stream")

    # --- Standard Non-Streaming Response (Fallback if used) ---
    # In full production we should also map these to Agent methods. For now just wrap stream.
    # To keep it simple, we can just consume the stream if non-streaming is requested.
    full_response = ""
    if req.role == "student":
        async for chunk in agent_service.student_agent_stream(req.query, req.subject, chat_history, knowledge_search_func):
            full_response += chunk
    elif req.role == "parent":
        def get_grades_func() -> str:
            return sql_data
        async for chunk in agent_service.parent_agent_stream(req.query, chat_history, get_grades_func, search_policy_func):
            full_response += chunk
    else:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'student' or 'parent'.")
        
    response_text = full_response

    # --- Persist messages to DB if session_id provided ---
    if req.session_id:
        try:
            db.add(ChatMessage(session_id=req.session_id, role="user", content=req.query))
            db.add(ChatMessage(session_id=req.session_id, role="assistant", content=response_text))
            db.commit()
        except Exception as e:
            logger.warning(f"Could not save messages to DB: {e}")

    return {"response": response_text}
