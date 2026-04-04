FROM python:3.14-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (cache layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY . .

# Non-root user
RUN useradd -r -u 1001 inverum && chown -R inverum:inverum /app
USER inverum

EXPOSE 8000
