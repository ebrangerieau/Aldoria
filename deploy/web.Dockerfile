# Image du service `web` : export web Godot (jeu) et espace parent (React), servis
# par nginx selon l'hôte. Contexte de build : racine du dépôt, après export dans
# build/web/ et post-traitement.

# Espace parent : vérification des types puis build Vite.
FROM node:22-alpine AS admin
WORKDIR /admin
COPY admin/package.json admin/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY admin/ ./
RUN npm run build

FROM nginx:1.29-alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY deploy/nginx/web.conf /etc/nginx/conf.d/web.conf
COPY build/web/ /usr/share/nginx/html/
COPY --from=admin /admin/dist/ /usr/share/nginx/admin/

HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://127.0.0.1/ || exit 1
