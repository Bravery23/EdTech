from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI
from app.core.config import settings

class RAGService:
    def __init__(self):
        import os
        os.environ["OPENAI_API_KEY"] = settings.DEEPSEEK_API_KEY or "DUMMY"
        self.llm = ChatOpenAI(
            model="deepseek-chat", 
            api_key=settings.DEEPSEEK_API_KEY, 
            base_url="https://api.deepseek.com/v1",
            temperature=0.3
        )
        
    def socratic_prompt(self, context: str, query: str, subject: str, chat_history: str = "") -> str:
        prompt_template = PromptTemplate(
            input_variables=["context", "query", "subject", "chat_history"],
            template="""Bạn là một giáo viên {subject} ảo tại trường phổ thông. 
            Lịch sử hội thoại gần đây (dùng làm ngữ cảnh nếu cần):
            {chat_history}

            Một học sinh đang hỏi câu hỏi: "{query}".

            Yêu cầu Sư phạm (Socratic Tutoring Mode):
            1. KHÔNG BAO GIỜ giải bài thay cho học sinh hoặc đưa ra đáp án cuối cùng.
            2. Dựa vào Tài liệu Trường cung cấp dưới đây, hãy đưa ra gợi ý từng bước hoặc đặt câu hỏi ngược lại để kích thích tư duy giải quyết vấn đề của học sinh.
            3. Liên kết với Lịch sử hội thoại nếu học sinh đang hỏi tiếp ý cũ.
            4. Nếu câu hỏi không liên quan đến học tập hoặc nằm ngoài CƠ SỞ DỮ LIỆU, hãy từ chối một cách khéo léo và nhắc nhở học sinh tập trung vào việc học (Guardrails).

            Tài Liệu Của Trường:
            {context}

            Câu trả lời của giáo viên (Markdown, rõ ràng, khích lệ):
            """
        )
        return prompt_template.format(context=context, query=query, subject=subject, chat_history=chat_history)
    
    # TODO: remove after test
    def temp_test_prompt(self, context: str, query: str, subject: str, chat_history: str = "") -> str:
        prompt_template = PromptTemplate(
            input_variables=["context", "query", "subject", "chat_history"],
            template="""Bạn là một LLM để test hội thoại. 
            Lịch sử hội thoại gần đây (dùng làm ngữ cảnh nếu cần):
            {chat_history}
            Dựa vào ngữ cảnh hãy tiếp tục hội thoại 1 cách hợp lý.
            

            Câu trả lời của bạn (Markdown, rõ ràng):
            """
        )
        print("DEBUG: ",prompt_template.format(context=context, query=query, subject=subject, chat_history=chat_history))

        return prompt_template.format(context=context, query=query, subject=subject, chat_history=chat_history)

    def hybrid_admin_prompt(self, context: str, sql_data: str, query: str) -> str:
        prompt_template = PromptTemplate(
            input_variables=["context", "sql_data", "query"],
            template="""Bạn là giáo viên chủ nhiệm ảo, giao tiếp với phụ huynh học sinh.
            Phụ huynh hỏi: "{query}"

            Thông diễn Quy chế/Sự kiện:
            {context}

            Thông tin Điểm số truy xuất (Text-to-SQL result):
            {sql_data}

            Nhiệm vụ: Trả lời phụ huynh một cách lịch sự, thấu hiểu. Tổng hợp từ quy chế và điểm số thực tế. Nếu điểm có xu hướng giảm, hãy nhắc nhở nhẹ nhàng.
            Câu trả lời:"""
        )
        return prompt_template.format(context=context, sql_data=sql_data, query=query)

    async def get_academic_answer(self, query: str, context: str, subject: str, chat_history: str = "") -> str:
        # Evaluate Similarity Score (Dummy threshold logic)
        if len(context.strip()) < 10:
             # Fallback
             return f"Thầy chưa tìm thấy tài liệu liên quan trong hệ thống bài giảng môn {subject}. Em có thể làm rõ câu hỏi hơn không?"
             
        prompt = self.socratic_prompt(context, query, subject, chat_history)
        response = await self.llm.ainvoke(prompt)
        return response.content

    async def get_admin_answer(self, query: str, text_context: str, sql_context: str) -> str:
        prompt = self.hybrid_admin_prompt(text_context, sql_context, query)
        response = await self.llm.ainvoke(prompt)
        return response.content
