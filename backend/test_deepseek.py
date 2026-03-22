import asyncio
import os
from app.core.config import settings
from app.services.rag_service import RAGService
from app.services.vector_db import VectorStoreService

async def test_deepseek():
    # Make sure we have a dummy or real key
    print(f"DeepSeek API Key configured: {'[REDACTED]' if settings.DEEPSEEK_API_KEY else 'None'}")
    
    # Init RAG Service
    print("Initializing RAG Service...")
    rag_service = RAGService()
    
    print("Testing Socratic Prompt Generation...")
    prompt = rag_service.socratic_prompt("Đây là tài liệu Toán 10 về phương trình bậc 2.", "Làm thế nào tính Delta?", "Toán học")
    print("--- PROMPT ---")
    print(prompt)
    print("--------------")
    
    if settings.DEEPSEEK_API_KEY:
        print("Calling DeepSeek API...")
        try:
            response = await rag_service.llm.ainvoke(prompt)
            print("API Response:", response.content)
        except Exception as e:
            print("Error connecting to DeepSeek:", e)
    else:
        print("No DeepSeek API key provided, skipping actual LLM call.")

def test_embeddings():
    print("Initializing Vector DB Service mapping (testing local HuggingFace load)...")
    try:
        # Mock Session
        class MockSession:
            pass
        vector_service = VectorStoreService(MockSession())
        test_text = "Thử nghiệm vector hóa tiếng Việt với SentenceTransformers."
        print(f"Embedding text: '{test_text}'")
        emb = vector_service.embeddings.embed_query(test_text)
        print(f"Embedding dimension: {len(emb)}")
        print("Embedding test successful.")
    except Exception as e:
        print("Error loading embeddings:", e)

if __name__ == "__main__":
    test_embeddings()
    asyncio.run(test_deepseek())
