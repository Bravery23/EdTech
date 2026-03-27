from typing import Optional, List
import logging
from sqlalchemy.orm import Session
from sqlalchemy import Integer

from app.models.user import User
from app.models.document import Document
from app.services.vector_db import VectorStoreService
from app.services.document_parser import parse_and_chunk_document

logger = logging.getLogger(__name__)

class AICore:
    """
    Core AI logic acting as an orchestrator for parsing, embedding, storing,
    and querying knowledge, tightly integrated with school contexts (classes and subjects).
    """
    def __init__(self, db: Session):
        self.db = db
        self.vector_service = VectorStoreService(db)

    def index_document(
        self, 
        file_path: str, 
        filename: str, 
        uploader: User, 
        class_id: int, 
        subject_id: Optional[int] = None,
        subject_name: Optional[str] = None
    ) -> int:
        """
        Process a document and store its embeddings with class-specific metadata.
        For a homeroom teacher, subject_id may be None.
        For a subject teacher, subject_id ensures indexing is isolated correctly.
        """
        logger.info(f"[AICore] Bắt đầu xử lý file '{filename}' cho class_id={class_id}, subject_id={subject_id}")
        
        chunks = parse_and_chunk_document(file_path)
        logger.info(f"[AICore] File '{filename}' được cắt thành {len(chunks)} chunks.")
        
        texts = [c.page_content for c in chunks]
        
        # Determine effective role for logging/context
        uploader_role = uploader.role[0] if uploader.role else "teacher"
        
        metadatas = []
        for c in chunks:
            # Base metadata guarantees scope via class_id
            meta = {
                "class_id": class_id,
                "filename": filename,
                "uploader_role": uploader_role
            }
            if subject_id:
                meta["subject_id"] = subject_id
            if subject_name:
                meta["subject_name"] = subject_name
                
            # Merge with langchain document metadata (like page number, etc.)
            meta.update(c.metadata)
            metadatas.append(meta)

        logger.info(f"[AICore] Gửi {len(texts)} chunks tới Vector DB để tính toán vector...")
        self.vector_service.add_texts(
            texts=texts,
            metadatas=metadatas,
            teacher_id=uploader.id
        )
        logger.info(f"[AICore] Hoàn tất index file '{filename}'.")
        return len(chunks)

    def query_class_knowledge(self, query: str, class_id: int, subject_id: Optional[int] = None, top_k: int = 4) -> List[Document]:
        """
        Truy vấn kho kiến thức của lớp học, đảm bảo chỉ lấy thông tin liên quan đến lớp/môn được yêu cầu.
        Sử dụng VectorDB Service để thực hiện tìm kiếm tương đồng.
        """
        return self.vector_service.similarity_search(
            query=query, 
            class_id=class_id, 
            subject_id=subject_id, 
            top_k=top_k,
            distance_threshold=0.5 # Ngưỡng mặc định cho cosine distance
        )
