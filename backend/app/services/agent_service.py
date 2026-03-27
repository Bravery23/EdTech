from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from typing import List, Callable, AsyncGenerator
import json
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class EdTechAgentService:
    def __init__(self):
        self.llm = ChatOpenAI(
            model="deepseek-chat", 
            api_key=settings.DEEPSEEK_API_KEY or "DUMMY", 
            base_url="https://api.deepseek.com/v1",
            temperature=0.3
        )
        
    async def student_agent_stream(
        self, 
        query: str, 
        subject: str, 
        chat_history_str: str, 
        knowledge_search_func: Callable[[str], str]
    ) -> AsyncGenerator[str, None]:
        """
        Agentic Flow cho Học Sinh:
        1. Phân loại ý định & Dùng công cụ (nếu cần tra cứu).
        2. Áp dụng phương pháp Socratic (hướng dẫn từng bước).
        3. Phát ra kết quả dạng stream.
        """
        system_prompt = f"""Bạn là giáo viên {subject} ảo tại trường phổ thông.
        Lịch sử hội thoại:
        {chat_history_str}

        QUY TẮC CHIẾN LƯỢC:
        1. Xếp loại câu hỏi: Nếu học sinh hỏi linh tinh (chơi game, giải trí, thô tục), TỪ CHỐI KHÉO LÉO và khuyên học sinh tập trung học.
        2. Tự động tra cứu: Với câu hỏi bài học, HÃY DÙNG CÔNG CỤ `search_knowledge_base` để tự bổ sung kiến thức nếu bạn cần dữ liệu từ trường -> nếu không tìm thấy nội dung liên quan hoặc nội dung không liên quan tới câu hỏi trong cơ sở dữ liệu thì trả lời "Không tìm thấy nội dung liên quan trong cơ sở dữ liệu."
        3. PHƯƠNG PHÁP SOCRATIC: KHÔNG BAO GIỜ giải bài thay hoặc cung cấp đáp án cuối cùng. Hãy đặt câu hỏi gợi mở, hướng dẫn từng bước (step-by-step) để học sinh tự suy nghĩ.
        """
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=query)
        ]

        tools = [
            {
                "type": "function",
                "function": {
                    "name": "search_knowledge_base",
                    "description": f"Tìm kiếm tài liệu bài giảng nội bộ môn {subject}",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "search_query": {"type": "string", "description": "Câu truy vấn tối ưu hóa để tìm kiếm trong VectorDB"}
                        },
                        "required": ["search_query"]
                    }
                }
            }
        ]

        llm_with_tools = self.llm.bind_tools(tools)
        
        try:
            # Pre-flight call to determine Intent/Tools
            ai_msg = await llm_with_tools.ainvoke(messages)
            
            if ai_msg.tool_calls:
                logger.info(f"[Agent] Student Agent quyết định dùng tool: {ai_msg.tool_calls[0]['name']}")
                messages.append(ai_msg)
                
                # Execute tools
                for tool_call in ai_msg.tool_calls:
                    if tool_call["name"] == "search_knowledge_base":
                        search_q = tool_call["args"].get("search_query", query)
                        docs_str = knowledge_search_func(search_q)
                        
                        if not docs_str.strip():
                            docs_str = "Không tìm thấy nội dung liên quan trong cơ sở dữ liệu."
                            
                        messages.append(ToolMessage(
                            tool_call_id=tool_call["id"],
                            name=tool_call["name"],
                            content=docs_str
                        ))
                
                # Stream the final response after getting tool data
                async for chunk in self.llm.astream(messages):
                    yield chunk.content
            else:
                # No tools used (e.g., greeting, rejection, or basic knowledge).
                # We yield the content directly. To simulate stream for the frontend, we can just yield the whole block or chunk it artificially if ainvoke was used.
                # Actually, if we just use astream from the beginning we can't easily intercept tool calls without writing a complex parser.
                # Since we already have the ai_msg.content, we can just yield it.
                logger.info("[Agent] Student Agent trả lời trực tiếp không dùng tool.")
                if ai_msg.content:
                    # chunk it to simulate streaming
                    words = ai_msg.content.split(" ")
                    for i in range(0, len(words), 5):
                        yield " ".join(words[i:i+5]) + " "
                else:
                    yield "Thầy đang xem xét câu hỏi của em..."
                    
        except Exception as e:
            logger.error(f"[Agent] Lỗi khi xử lý Student Agent: {e}")
            yield "Xin lỗi em, hệ thống đang gặp chút khó khăn. Em thử lại sau nhé."


    async def parent_agent_stream(
        self, 
        query: str, 
        chat_history_str: str, 
        get_grades_func: Callable[[], str],
        search_policy_func: Callable[[str], str]
    ) -> AsyncGenerator[str, None]:
        """
        Agentic Flow cho Phụ Huynh:
        1. Phân loại ý định: Hỏi điểm hay hỏi quy chế/sự kiện?
        2. Dùng công cụ tương ứng.
        3. Tổng hợp câu trả lời thấu cảm.
        """
        system_prompt = f"""Bạn là Trợ lý Giáo viên chủ nhiệm ảo, giao tiếp với phụ huynh học sinh.
Lịch sử hội thoại:
{chat_history_str}

QUY TẮC CHIẾN LƯỢC:
1. Bạn có công cụ tra điểm (`get_student_grades`) và tra quy chế/thông báo trường (`search_school_policy`). Hãy sử dụng đúng công cụ khi phụ huynh hỏi tương ứng.
2. TONE: Lịch sự, thấu hiểu, mang tính tư vấn giáo dục.
3. Nếu điểm số của học sinh không tốt, hãy nhắc nhở nhẹ nhàng và đề xuất giải pháp đồng hành cùng phụ huynh.
"""
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=query)
        ]

        tools = [
            {
                "type": "function",
                "function": {
                    "name": "get_student_grades",
                    "description": "Lấy bảng điểm gần đây của học sinh do vị phụ huynh này quản lý.",
                    "parameters": {"type": "object", "properties": {}}
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "search_school_policy",
                    "description": "Tìm kiếm quy chế, sự kiện, thông báo của nhà trường.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "search_query": {"type": "string", "description": "Từ khóa tìm kiếm quy chế (vd: lịch nghỉ Tết, đồng phục)"}
                        },
                        "required": ["search_query"]
                    }
                }
            }
        ]

        llm_with_tools = self.llm.bind_tools(tools)
        
        try:
            ai_msg = await llm_with_tools.ainvoke(messages)
            
            if ai_msg.tool_calls:
                logger.info(f"[Agent] Parent Agent gọi tool: {[t['name'] for t in ai_msg.tool_calls]}")
                messages.append(ai_msg)
                
                for tool_call in ai_msg.tool_calls:
                    if tool_call["name"] == "get_student_grades":
                        grades_str = get_grades_func()
                        if not grades_str:
                            grades_str = "Không tìm thấy dữ liệu điểm."
                        messages.append(ToolMessage(
                            tool_call_id=tool_call["id"],
                            name=tool_call["name"],
                            content=grades_str
                        ))
                    elif tool_call["name"] == "search_school_policy":
                        search_q = tool_call["args"].get("search_query", query)
                        policy_str = search_policy_func(search_q)
                        if not policy_str.strip():
                            policy_str = "Không có kết quả quy chế/thông báo phù hợp."
                        messages.append(ToolMessage(
                            tool_call_id=tool_call["id"],
                            name=tool_call["name"],
                            content=policy_str
                        ))
                
                async for chunk in self.llm.astream(messages):
                    yield chunk.content
            else:
                logger.info("[Agent] Parent Agent trả lời trực tiếp không dùng tool.")
                if ai_msg.content:
                    words = ai_msg.content.split(" ")
                    for i in range(0, len(words), 5):
                        yield " ".join(words[i:i+5]) + " "
                else:
                    yield "Dạ, hệ thống đang kiểm tra thông tin ạ..."
                    
        except Exception as e:
            logger.error(f"[Agent] Lỗi khi xử lý Parent Agent: {e}")
            yield "Dạ xin lỗi anh/chị, hệ thống đang bận. Anh/chị thử lại sau nhé."
