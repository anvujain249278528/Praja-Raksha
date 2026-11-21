# ---------- Stage 1: build the React frontend ----------
FROM node:22-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: Python backend + headless Chromium for the browser agents ----------
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PORT=10000 \
    AUTO_TRACK_MINUTES=60

WORKDIR /app
# Playwright's bundled Node driver needs libatomic, which the slim image does not include
RUN apt-get update && apt-get install -y --no-install-recommends libatomic1 && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt \
 && python -m playwright install --with-deps --only-shell chromium

COPY backend/ backend/
COPY --from=frontend /build/dist frontend/dist

# Run as a normal user (not root); it must be able to write the SQLite database.
RUN useradd -m -u 1000 user && chown -R user:user /app
USER user

WORKDIR /app/backend
EXPOSE 10000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1"]
