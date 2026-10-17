import uvicorn

from app.core.config import get_settings


def run() -> None:
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        access_log=False,
        server_header=False,
    )


if __name__ == "__main__":
    run()
