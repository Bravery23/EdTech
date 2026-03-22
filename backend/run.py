import uvicorn
import os


def get_config():
    return {
        "app": "app.main:app",
        "host": os.getenv("HOST", "0.0.0.0"),
        "port": int(os.getenv("PORT", 8000)),
        "reload": os.getenv("RELOAD", "true").lower() == "true",
        "log_level": os.getenv("LOG_LEVEL", "info"),
    }


def main():
    config = get_config()
    uvicorn.run(
        config["app"],
        host=config["host"],
        port=config["port"],
        reload=config["reload"],
        log_level=config["log_level"],
    )


if __name__ == "__main__":
    main()