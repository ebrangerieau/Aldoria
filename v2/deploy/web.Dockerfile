# Image du service `web` de la v2 : client Babylon.js (build Vite) et espace parent (React),
# servis par nginx selon l'hôte. Contexte de build : le dossier v2/ (le client importe content/).
#   docker build -f deploy/web.Dockerfile --build-arg GIT_SHA=$(git rev-parse HEAD) .

FROM node:22-alpine AS client
WORKDIR /v2/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY content/ /v2/content/
COPY client/ ./
ARG GIT_SHA=dev
ENV VITE_VERSION=${GIT_SHA}
RUN npm run build

FROM node:22-alpine AS admin
WORKDIR /admin
COPY admin/package.json admin/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY admin/ ./
RUN npm run build

FROM nginx:1.29-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY deploy/nginx/web.conf /etc/nginx/conf.d/web.conf
COPY --from=client /v2/client/dist/ /usr/share/nginx/html/
# Voix enregistrées (ElevenLabs) et musique, reprises de la v1 (servies à côté du jeu).
COPY deploy/voix/ /usr/share/nginx/html/voix/
COPY deploy/musique/ /usr/share/nginx/html/musique/
COPY --from=admin /admin/dist/ /usr/share/nginx/admin/
ARG GIT_SHA=dev
RUN echo "${GIT_SHA}" > /usr/share/nginx/html/version.txt

HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://127.0.0.1/ || exit 1
