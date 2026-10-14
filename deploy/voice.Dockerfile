# Service de voix (Piper) : synthèse vocale neuronale, joignable seulement par l'API.
FROM python:3.12-slim

RUN pip install --no-cache-dir "piper-tts==1.8.0" "fastapi>=0.115" "uvicorn>=0.32" "lameenc>=1.7"

# Voix téléchargées à la construction (Hugging Face, rhasspy/piper-voices) : l'image démarre
# sans réseau. Licences : CC BY 4.0 (game/assets/LICENSES.md, docs/exploitation.md).
RUN python -m piper.download_voices --download-dir /voix fr_FR-siwis-medium en_GB-alba-medium

WORKDIR /app
COPY voice/app.py .
USER nobody
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/sante')" || exit 1
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
