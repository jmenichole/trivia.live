# Show-runner worker image (e.g. a Northflank free service).
# Build from the REPO ROOT so the workspace lockfile and game-engine are in context:
#   docker build -f apps/show-runner/Dockerfile -t trivia-runner .
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/show-runner/package.json apps/show-runner/
COPY apps/web/package.json apps/web/
COPY packages/game-engine/package.json packages/game-engine/
RUN npm ci -w @trivia-live/show-runner --no-audit --no-fund
COPY packages/game-engine packages/game-engine
COPY apps/show-runner apps/show-runner
RUN npm run build -w @trivia-live/show-runner \
 && npm prune --omit=dev -w @trivia-live/show-runner

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/show-runner/dist ./apps/show-runner/dist
COPY --from=build /app/apps/show-runner/package.json ./apps/show-runner/package.json
USER node
CMD ["node", "apps/show-runner/dist/index.js"]
