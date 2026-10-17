FROM python:3.12-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY Backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-compile --only-binary=:all: -r /tmp/requirements.txt \
 && find /opt/venv/lib -depth -type d \( -name "tests" -o -name "__pycache__" \) -not -path "*/torch/*" -exec rm -rf {} + \
 && pip uninstall -y pip


FROM python:3.12-slim

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/app/.cache/huggingface \
    TOKENIZERS_PARALLELISM=false \
    OMP_NUM_THREADS=1 \
    MALLOC_ARENA_MAX=2 \
    HOST=0.0.0.0 \
    PORT=8000

RUN useradd --system --uid 1000 --home-dir /app --shell /usr/sbin/nologin app

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app/Backend
COPY --chown=app:app Backend/app ./app
RUN mkdir -p logs /app/.cache \
 && chown -R app:app /app

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import os, urllib.request as u; u.urlopen('http://127.0.0.1:%s/health' % os.environ['PORT'], timeout=4)"

CMD ["python", "-m", "app"]
