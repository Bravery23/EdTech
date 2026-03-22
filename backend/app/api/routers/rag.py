from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.core.db import get_db
from app.core.config import settings
from app.core.deps import get_current_user
from app.services.rag_service import RAGService
from app.services.vector_db import VectorStoreService
from app.models.chat import ChatMessage
from app.models.user import User, ParentStudent
from app.models.school import ClassStudent, ClassTeacher, Grade
from app.models.subject import Subject
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
_rag_service = None

def get_rag_service() -> RAGService:
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service


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

    # --- Retrieve context from vector DB (graceful fallback) ---
    context = ""
    try:
        vector_service = VectorStoreService(db)
        # Note: VectorStoreService.similarity_search will also need to filter out deleted documents
        docs = vector_service.similarity_search(
            req.query,
            subject_filter=req.subject if req.role == "student" else None,
            teacher_id=teacher_id
        )
        context = "\n".join([d.content for d in docs])
    except Exception as e:
        logger.warning(f"Vector DB unavailable, skipping context: {e}")

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
    rag_service = get_rag_service()
    
    if req.stream:
        async def response_generator():
            full_response = ""
            if req.role == "student":
                # if len(context.strip()) < 10:
                #     yield f"data: Thầy chưa tìm thấy tài liệu liên quan trong hệ thống bài giảng môn {req.subject}. Em có thể làm rõ câu hỏi hơn không?\n\n"
                #     full_response = "Thầy chưa tìm thấy tài liệu liên quan..."
                # else:
                #     prompt = rag_service.socratic_prompt(context, req.query, req.subject, chat_history)
                #     async for chunk in rag_service.llm.astream(prompt):
                #         full_response += chunk.content
                #         # SSE format: data: <content>\n\n
                #         # replace newlines in chunks to avoid breaking SSE format easily, 
                #         # or just rely on proper client parsing standard
                #         cleaned_chunk = chunk.content.replace("\n", "\\n")
                #         yield f"data: {cleaned_chunk}\n\n"
                prompt = rag_service.temp_test_prompt(context, req.query, req.subject, chat_history)
                async for chunk in rag_service.llm.astream(prompt):
                    full_response += chunk.content
                    # SSE format: data: <content>\n\n
                    # replace newlines in chunks to avoid breaking SSE format easily, 
                    # or just rely on proper client parsing standard
                    cleaned_chunk = chunk.content.replace("\n", "\\n")
                    yield f"data: {cleaned_chunk}\n\n"
            elif req.role == "parent":
                prompt = rag_service.hybrid_admin_prompt(context, sql_data, req.query)
                async for chunk in rag_service.llm.astream(prompt):
                    full_response += chunk.content
                    cleaned_chunk = chunk.content.replace("\n", "\\n")
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

    # --- Standard Non-Streaming Response ---
    if req.role == "student":
        response_text = await rag_service.get_academic_answer(req.query, context, req.subject, chat_history)
    elif req.role == "parent":
        response_text = await rag_service.get_admin_answer(req.query, context, sql_data)
    else:
        raise HTTPException(status_code=400, detail="Invalid role. Must be 'student' or 'parent'.")

    # --- Persist messages to DB if session_id provided ---
    if req.session_id:
        try:
            db.add(ChatMessage(session_id=req.session_id, role="user", content=req.query))
            db.add(ChatMessage(session_id=req.session_id, role="assistant", content=response_text))
            db.commit()
        except Exception as e:
            logger.warning(f"Could not save messages to DB: {e}")

    return {"response": response_text}
