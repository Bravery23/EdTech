from sqlalchemy.orm import Session
import logging
from app.models.document import Document
from pgvector.sqlalchemy import Vector
from app.core.config import settings

# Using Google Gemini embeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings

logger = logging.getLogger(__name__)

class VectorStoreService:
    def __init__(self, db: Session):
        self.db = db
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001", 
            google_api_key=settings.GEMINI_API_KEY
        )
        
    def add_texts(self, texts: list[str], metadatas: list[dict] = None, teacher_id: int = None):
        if not texts:
            logger.warning("[VectorDB] Không có đoạn text nào để xử lý.")
            return []
            
        logger.info(f"[VectorDB] Đang gọi Gemini API (model: models/embedding-001) để chuyển hóa {len(texts)} chunks thành vector...")
        embeddings = self.embeddings.embed_documents(texts)
        logger.info(f"[VectorDB] Tạo vector thành công. Bắt đầu lưu vào Database...")
        
        docs = []
        for i, text in enumerate(texts):
            doc = Document(
                content=text,
                embedding=embeddings[i],
                metadata_json=metadatas[i] if metadatas else {},
                teacher_id=teacher_id
            )
            docs.append(doc)
            self.db.add(doc)
            
        self.db.commit()
        logger.info(f"[VectorDB] Đã lưu thành công {len(docs)} records vào bảng documents.")
        return docs
        
    def similarity_search(self, query: str, subject_filter: str = None, top_k: int = 4, teacher_id: int = None, distance_threshold: float = 0.5):
        query_embedding = self.embeddings.embed_query(query)
        
        # pgvector cosine similarity <-> operator
        # Distance calculation is sorted ascending (closer is smaller distance)
        stmt = self.db.query(Document).filter(Document.deleted_at == None)
        
        if teacher_id:
            stmt = stmt.filter(Document.teacher_id == teacher_id)
            
        if subject_filter:
            # Requires postgres jsonb filtering if we implemented it, 
            # for now let's just do a basic text filter or fetch more and filter in Python
            pass
            
        # Guardrail: only return docs where cosine distance is below threshold
        distance_expr = Document.embedding.cosine_distance(query_embedding)
        docs = stmt.filter(distance_expr < distance_threshold).order_by(distance_expr).limit(top_k).all()
        return docs
