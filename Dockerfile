# Single container: builds the web app, runs the API and serves the UI.
#   docker build -t sentience .
#   docker run -d --name sentience -p 4477:4477 -v sentience-data:/app/server/data sentience
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY server/package.json server/
COPY web/package.json web/
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/* \
 && npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=4477 HOST=0.0.0.0 SENTIENCE_DATA_DIR=/app/server/data
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/server/package.json ./server/
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/web/dist ./web/dist
VOLUME ["/app/server/data"]
EXPOSE 4477
CMD ["node", "server/dist/index.js"]
