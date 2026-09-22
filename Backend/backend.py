import re
import time
import uuid
from urllib.parse import urlparse, unquote

import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from typing import List

from RAG_QnA import RAG_Model
from logging_config import logger, activity_logger

app = FastAPI()

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = uuid.uuid4().hex[:8]
    start = time.perf_counter()
    logger.info(f"--> [{request_id}] {request.method} {request.url.path}")

    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (time.perf_counter() - start) * 1000
        logger.exception(f"<!> [{request_id}] {request.method} {request.url.path} raised after {duration_ms:.1f}ms")
        raise

    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(f"<-- [{request_id}] {request.method} {request.url.path} {response.status_code} {duration_ms:.1f}ms")
    response.headers["X-Request-ID"] = request_id
    return response


# ── Request models ────────────────────────────────────────────────────────────
class ChatTurn(BaseModel):
    question: str
    answer: str

class ProcessPageRequest(BaseModel):
    url: str
    text: str
    # Prior turns of a conversation being resumed (oldest first). When empty,
    # the backend starts with a clean conversational memory for this source.
    history: List[ChatTurn] = []

class GenerateResponseRequest(BaseModel):
    message: str

class SetModelRequest(BaseModel):
    model: str

class SetToneRequest(BaseModel):
    tone: str

# ── URL helpers ───────────────────────────────────────────────────────────────
def get_file_url(file_url: str) -> str:
    """Return a usable file path or HTTPS URL from any URL format."""
    if file_url.startswith("https://"):
        return file_url
    parsed   = urlparse(file_url)
    return unquote(parsed.path)


def is_pdf_url(url: str) -> bool:
    """Return True if the URL points to a PDF file."""
    if url.lower().endswith('.pdf'):
        return True
    try:
        response     = requests.head(url, allow_redirects=True, timeout=5)
        content_type = response.headers.get('Content-Type', '')
        is_doc       = 'application/pdf' in content_type.lower()
        logger.debug(f"PDF content-type check for {url}: {is_doc}")
        return is_doc
    except requests.RequestException as e:
        logger.warning(f"PDF check request failed for {url}: {e}")
        return False


def is_youtube_url(url: str) -> bool:
    """Return True if the URL is a YouTube link."""
    pattern = re.compile(
        r'(https?://)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)/.+',
        re.IGNORECASE
    )
    return bool(re.match(pattern, url))


def detect_source_type(url: str, is_pdf: bool, is_youtube: bool) -> str:
    if is_pdf:
        return "pdf"
    if is_youtube:
        return "youtube"
    return "website"


# ── Startup: initialise heavy models once ────────────────────────────────────
rag  = RAG_Model()
logger.info("RAG_Model initialised — backend ready")


# ── Routes ────────────────────────────────────────────────────────────────────
@app.post('/process_page')
async def process_page(request_data: ProcessPageRequest):
    url  = request_data.url.strip()
    text = request_data.text.strip()

    if not url:
        raise HTTPException(status_code=400, detail="Missing URL")
    if not text:
        raise HTTPException(status_code=400, detail="Missing text")

    start = time.perf_counter()

    try:
        is_pdf     = await run_in_threadpool(is_pdf_url, url)
        is_youtube = (not is_pdf) and is_youtube_url(url)
        source_type = detect_source_type(url, is_pdf, is_youtube)

        if is_pdf:
            parse_url = get_file_url(url)
            await run_in_threadpool(rag.load_Database, is_pdf=True, pdf_url=parse_url)

        elif is_youtube:
            await run_in_threadpool(rag.load_Database, is_youtube_url=True, youtube_url=url)

        else:
            await run_in_threadpool(rag.load_Database, text=text, is_raw_text=True)

        history = [turn.model_dump() for turn in request_data.history]
        if history:
            rag.seed_memory(history)
        else:
            rag.reset_memory()

        duration_ms = (time.perf_counter() - start) * 1000
        activity_logger.info(
            f"page_processed url={url} type={source_type} history_turns={len(history)} duration_ms={duration_ms:.1f}"
        )

        return JSONResponse(content={'message': 'Page processed successfully'})

    except Exception as e:
        duration_ms = (time.perf_counter() - start) * 1000
        logger.exception(f"process_page failed for url={url} after {duration_ms:.1f}ms")
        activity_logger.info(f"page_process_failed url={url} error={e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/generate_response')
async def generate_response(request_data: GenerateResponseRequest):
    user_input = request_data.message.strip()

    if not user_input:
        raise HTTPException(status_code=400, detail="Missing message")

    if not hasattr(rag, 'database') or rag.database is None:
        raise HTTPException(
            status_code=400,
            detail="No page loaded yet. Please open a webpage first."
        )

    model_key = rag.current_model_key
    tone_key  = rag.current_tone_key

    async def token_stream():
        pieces = []
        start = time.perf_counter()
        try:
            async for chunk in rag.astream_response(user_input):
                pieces.append(chunk)
                yield chunk

            duration_ms = (time.perf_counter() - start) * 1000
            activity_logger.info(
                f"message_answered model={model_key} tone={tone_key} "
                f"question_len={len(user_input)} answer_len={len(''.join(pieces))} duration_ms={duration_ms:.1f}"
            )

        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.exception(f"generate_response failed after {duration_ms:.1f}ms (model={model_key}, tone={tone_key})")
            activity_logger.info(f"message_failed model={model_key} tone={tone_key}")
            yield "\n\nSorry, something went wrong while generating a response. Please try again."

    return StreamingResponse(token_stream(), media_type="text/plain")


@app.get('/models')
async def list_models():
    return JSONResponse(content={
        'models': rag.list_models(),
        'current': rag.current_model_key,
    })


@app.post('/set_model')
async def set_model(request_data: SetModelRequest):
    model_key = request_data.model.strip()

    if not model_key:
        raise HTTPException(status_code=400, detail="Missing model")

    previous_model = rag.current_model_key
    try:
        rag.Load_llm(model_key)
    except ValueError as e:
        logger.warning(f"set_model rejected: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    activity_logger.info(f"model_switched from={previous_model} to={rag.current_model_key}")
    return JSONResponse(content={'model': rag.current_model_key})


@app.get('/tones')
async def list_tones():
    return JSONResponse(content={
        'tones': rag.list_tones(),
        'current': rag.current_tone_key,
    })


@app.post('/set_tone')
async def set_tone(request_data: SetToneRequest):
    tone_key = request_data.tone.strip()

    if not tone_key:
        raise HTTPException(status_code=400, detail="Missing tone")

    previous_tone = rag.current_tone_key
    try:
        rag.set_tone(tone_key)
    except ValueError as e:
        logger.warning(f"set_tone rejected: {e}")
        raise HTTPException(status_code=400, detail=str(e))

    activity_logger.info(f"tone_switched from={previous_tone} to={rag.current_tone_key}")
    return JSONResponse(content={'tone': rag.current_tone_key})


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
