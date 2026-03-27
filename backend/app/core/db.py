from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(settings.DATABASE_URI, connect_args={"sslmode": "require"}, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# check engine
print("DEBUG DATABASE")
print(settings.DATABASE_URI)
print(engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
