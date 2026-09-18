import traceback
import re
from urllib.parse import urlparse, unquote

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from typing import List

from RAG_QnA import RAG_Model

app = FastAPI()

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
        print("Is PDF:", is_doc)
        return is_doc
    except requests.RequestException as e:
        print(f"PDF check request failed: {e}")
        return False


def is_youtube_url(url: str) -> bool:
    """Return True if the URL is a YouTube link."""
    pattern = re.compile(
        r'(https?://)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)/.+',
        re.IGNORECASE
    )
    return bool(re.match(pattern, url))


# ── Startup: initialise heavy models once ────────────────────────────────────
rag  = RAG_Model()


# ── Routes ────────────────────────────────────────────────────────────────────
@app.post('/process_page')
async def process_page(request_data: ProcessPageRequest):
    url  = request_data.url.strip()
    text = request_data.text.strip()

    if not url:
        raise HTTPException(status_code=400, detail="Missing URL")
    if not text:
        raise HTTPException(status_code=400, detail="Missing text")

    print(f"URL: {url}")

    try:
        if is_pdf_url(url):
            parse_url = get_file_url(url)
            print("Parse URL:", parse_url)
            rag.load_Database(is_pdf=True, pdf_url=parse_url)

        elif is_youtube_url(url):
            print("URL Type: YouTube Video")
            rag.load_Database(is_youtube_url=True, youtube_url=url)

        else:
            print("This is Website URL")
            rag.load_Database(text=text, is_raw_text=True)

        history = [turn.model_dump() for turn in request_data.history]
        if history:
            rag.seed_memory(history)
        else:
            rag.reset_memory()

        return JSONResponse(content={'message': 'Page processed successfully'})

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/generate_response')
async def generate_response(request_data: GenerateResponseRequest):
    user_input = request_data.message.strip()

    if not user_input:
        raise HTTPException(status_code=400, detail="Missing message")

    # Guard: database must be loaded before answering
    if not hasattr(rag, 'database') or rag.database is None:
        raise HTTPException(
            status_code=400,
            detail="No page loaded yet. Please open a webpage first."
        )

    try:
        response = rag.generateResponse(user_input)
        print(response)
        return JSONResponse(content={'response': response})

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)