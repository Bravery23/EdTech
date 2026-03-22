from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routers import auth, users, chat, rag, admin, classes, grades, announcements, subjects

app = FastAPI(
    title="EdTech Virtual Teacher API",
    description="Smart Virtual Teacher System Integrated with RAG",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,  prefix="/api/v1/auth",  tags=["auth"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(chat.router,  prefix="/api/v1/chat",  tags=["chat"])
app.include_router(rag.router,   prefix="/api/v1/rag",   tags=["rag"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(classes.router, prefix="/api/v1/classes", tags=["classes"])
app.include_router(grades.router, prefix="/api/v1/grades", tags=["grades"])
app.include_router(announcements.router, prefix="/api/v1/announcements", tags=["announcements"])
app.include_router(subjects.router, prefix="/api/v1/subjects", tags=["subjects"])
@app.get("/")
def read_root():
    return {"message": "Welcome to the EdTech Virtual Teacher API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
