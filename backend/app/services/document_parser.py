from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, TextLoader, Docx2txtLoader
import os

def parse_and_chunk_document(file_path: str, chunk_size: int = 1000, chunk_overlap: int = 200):
    """
    Load a document from the given file_path and split it into chunks.
    """
    # Choose loader based on extension
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext == '.pdf':
        loader = PyPDFLoader(file_path)
    elif ext == '.txt':
        loader = TextLoader(file_path, encoding='utf-8')
    elif ext == '.docx':
        loader = Docx2txtLoader(file_path)
    else:
        raise ValueError(f"Unsupported file format: {ext}")

    documents = loader.load()
    
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ".", " ", ""]
    )
    
    chunks = text_splitter.split_documents(documents)
    return chunks
