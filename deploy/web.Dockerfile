# Image du service `web` : export web Godot servi par nginx.
# Contexte de build : racine du dépôt, après export dans build/web/ et post-traitement.
FROM nginx:1.29-alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY deploy/nginx/web.conf /etc/nginx/conf.d/web.conf
COPY build/web/ /usr/share/nginx/html/

HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://127.0.0.1/ || exit 1
