# Stage 1: Build stage
FROM python:3.11-slim AS builder

WORKDIR /app

# Install compilation dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install requirements to a separate target folder for easy copying
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Final runner stage
FROM python:3.11-slim AS runner

WORKDIR /app

# Install PostgreSQL runtime dependencies, the Tesseract OCR engine, and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Copy installed libraries from builder
COPY --from=builder /install /usr/local
COPY . .

# Set container optimization variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Run under a non-privileged user for hardening
RUN groupadd -g 10001 dataforge && \
    useradd -u 10001 -g dataforge -m -d /home/dataforge dataforge && \
    chmod +x /app/entrypoint.sh && \
    chown -R dataforge:dataforge /app

USER dataforge

EXPOSE 8000

# Apply migrations (when RUN_MIGRATIONS=true) then run the given command.
ENTRYPOINT ["/app/entrypoint.sh"]

# Run API Server
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
