# Stage 1: Build React frontend
FROM node:22-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npx vite build

# Stage 2: HA add-on runtime
ARG BUILD_FROM
FROM ${BUILD_FROM}

# Install Node.js, npm, and jq (for config transformation)
RUN apk add --no-cache nodejs npm jq

# Copy rootfs overlay (S6 scripts + bridge source + dashboard server)
COPY rootfs /

# Copy built frontend into dashboard serving directory
COPY --from=frontend /app/dist /usr/bin/dist

# Install Node.js dependencies (bridge + dashboard share one package.json)
WORKDIR /usr/bin
RUN npm install --production

# Ensure S6 scripts are executable
RUN chmod a+x /etc/services.d/bambu-bridge/run \
    && chmod a+x /etc/services.d/bambu-bridge/finish \
    && chmod a+x /etc/services.d/bambu-dashboard/run \
    && chmod a+x /etc/services.d/bambu-dashboard/finish
