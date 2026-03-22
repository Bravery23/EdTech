from sqlalchemy.orm import Session
from app.models.document import Document
from pgvector.sqlalchemy import Vector
from app.core.config import settings

# Using HuggingFace sentence-transformers for local, free embeddings
from langchain_huggingface import HuggingFaceEmbeddings

class VectorStoreService:
    def __init__(self, db: Session):
        self.db = db
        # Set explicitly to avoid downloading every restart, usually we cache this
        self.embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        
    def add_texts(self, texts: list[str], metadatas: list[dict] = None, teacher_id: int = None):
        if not texts:
            return []
            
        embeddings = self.embeddings.embed_documents(texts)
        
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
