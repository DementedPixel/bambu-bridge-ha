ARG BUILD_FROM
FROM ${BUILD_FROM}

# Install Node.js, npm, and jq (for config transformation)
RUN apk add --no-cache nodejs npm jq

# Copy rootfs overlay (S6 scripts + source files)
COPY rootfs /

# Install Node.js dependencies
WORKDIR /usr/bin
RUN npm install --production

# Ensure S6 scripts are executable
RUN chmod a+x /etc/services.d/bambu-bridge/run \
    && chmod a+x /etc/services.d/bambu-bridge/finish
