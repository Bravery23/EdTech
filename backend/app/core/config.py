from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "EdTech Virtual Teacher API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    DATABASE_URI: str
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # AI models
    DEEPSEEK_API_KEY: str = ""
    
    # JWT
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_SECRET_KEY"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True, extra="ignore")

settings = Settings()
