# Image du service `api` (FastAPI). Contexte de build : racine du dépôt.
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
COPY api/pyproject.toml api/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY api/app ./app
COPY api/alembic ./alembic
COPY api/alembic.ini ./alembic.ini
COPY content/seed ./content/seed

# /cache/voix : sons de la voix du serveur (volume nommé, qui hérite de ce propriétaire).
RUN useradd --system --uid 10001 aldoria \
    && mkdir -p /cache/voix && chown aldoria /cache/voix
USER aldoria

# Commit du code (posé par la CI), renvoyé par /health pour vérifier une mise en ligne.
ARG GIT_SHA=dev
ENV ALDORIA_VERSION=${GIT_SHA}

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health').status == 200 else 1)"

# Migrations puis programme (idempotent) au démarrage (TRD §10.4), puis le serveur.
CMD ["sh", "-c", "alembic upgrade head && python -m app.cli seed && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 --proxy-headers --forwarded-allow-ips '*'"]
