FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends chromium xvfb xauth ca-certificates fonts-liberation tini procps && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY bank-api/package.json bank-api/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY bank-api/ ./
RUN useradd --create-home --uid 10001 clara && chown -R clara:clara /app
USER clara
ENV NODE_ENV=production CHROME_PATH=/usr/bin/chromium XDG_CACHE_HOME=/tmp/clara-cache XDG_CONFIG_HOME=/tmp/clara-config
EXPOSE 10000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["xvfb-run", "-a", "node", "server.mjs"]
