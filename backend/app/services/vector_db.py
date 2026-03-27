from sqlalchemy import Integer
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
            
        logger.info(f"[VectorDB] Đang gọi Gemini API (model: models/gemini-embedding-001) để chuyển hóa {len(texts)} chunks thành vector...")
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
        
    def similarity_search(
        self, 
        query: str, 
        class_id: int = None,
        subject_id: int = None,
        teacher_id: int = None, 
        top_k: int = 4, 
        distance_threshold: float = 0.5
    ):
        """
        Tìm kiếm các đoạn văn bản tương đồng nhất dựa trên Vector Embedding.
        Hỗ trợ lọc theo lớp học, môn học và giáo viên để đảm bảo tính riêng tư và chính xác.
        """
        try:
            logger.info(f"[VectorDB] Đang tìm kiếm tương đồng cho query: '{query[:50]}...'")
            
            # 1. Chuyển câu hỏi thành vector embedding
            query_embedding = self.embeddings.embed_query(query)
            
            # 2. Xây dựng câu truy vấn cơ bản
            
            # Sử dụng cosine_distance (<-> operator trong pgvector)
            distance_expr = Document.embedding.cosine_distance(query_embedding)
            
            stmt = self.db.query(Document).filter(Document.deleted_at == None)
            
            # 3. Áp dụng các bộ lọc Metadata (nếu có)
            if class_id:
                # Trích xuất class_id từ JSONB metadata_json
                stmt = stmt.filter(Document.metadata_json["class_id"].astext.cast(Integer) == class_id)
                
            if subject_id:
                # Trích xuất subject_id từ JSONB metadata_json
                stmt = stmt.filter(Document.metadata_json["subject_id"].astext.cast(Integer) == subject_id)
                
            if teacher_id:
                # Lọc theo teacher_id (chủ sở hữu tài liệu)
                stmt = stmt.filter(Document.teacher_id == teacher_id)
                
            # 4. Thực thi tìm kiếm: Lọc theo ngưỡng khoảng cách, sắp xếp theo độ tương đồng và giới hạn kết quả
            docs = (
                stmt.filter(distance_expr < distance_threshold)
                .order_by(distance_expr)
                .limit(top_k)
                .all()
            )
            
            logger.info(f"[VectorDB] Tìm thấy {len(docs)} kết quả phù hợp (Threshold < {distance_threshold}).")
            return docs
            
        except Exception as e:
            logger.error(f"[VectorDB] Lỗi khi tìm kiếm tương đồng: {str(e)}")
            return []
