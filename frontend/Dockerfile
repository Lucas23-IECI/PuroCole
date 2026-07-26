# ── Etapa 1: Build de Vite ────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Configuración de producto e institución integrada en el build de Vite.
ARG VITE_API_URL=/api
ARG VITE_INSTITUTION_NAME="Establecimiento educativo"
ARG VITE_INSTITUTION_SHORT_NAME=""
ARG VITE_INSTITUTION_RBD=""
ARG VITE_INSTITUTION_LOCATION=""
ARG VITE_INSTITUTION_LOGO_URL="/brand/purocole-mark.svg"
ARG VITE_BRAND_PRIMARY="28618c"
ARG VITE_BRAND_ACCENT="d8a447"
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_INSTITUTION_NAME=$VITE_INSTITUTION_NAME
ENV VITE_INSTITUTION_SHORT_NAME=$VITE_INSTITUTION_SHORT_NAME
ENV VITE_INSTITUTION_RBD=$VITE_INSTITUTION_RBD
ENV VITE_INSTITUTION_LOCATION=$VITE_INSTITUTION_LOCATION
ENV VITE_INSTITUTION_LOGO_URL=$VITE_INSTITUTION_LOGO_URL
ENV VITE_BRAND_PRIMARY=$VITE_BRAND_PRIMARY
ENV VITE_BRAND_ACCENT=$VITE_BRAND_ACCENT

RUN npm run build

# ── Etapa 2: Servir archivos estáticos ────────────────────────────────────────
FROM nginxinc/nginx-unprivileged:stable-alpine

COPY --from=builder --chown=101:101 /app/dist /usr/share/nginx/html
COPY --chown=101:101 frontend.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
