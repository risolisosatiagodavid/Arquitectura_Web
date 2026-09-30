# syntax=docker/dockerfile:1
ARG NODE_VERSION=22

## Build stage
FROM node:${NODE_VERSION}-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN mkdir -p /app/data
RUN cp -a node_modules node_modules-development
RUN npm prune --omit=dev

## Development stage
FROM node:${NODE_VERSION}-bookworm-slim AS development

ENV NODE_ENV=development
WORKDIR /app

COPY --from=builder --chown=node:node /app/node_modules-development ./node_modules
COPY --from=builder --chown=node:node /app/data ./data
COPY --chown=node:node package*.json tsconfig.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node tests ./tests

USER node
EXPOSE 8080
CMD ["npm", "run", "dev"]

## Production stage
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS production

ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder --chown=nonroot:nonroot /app/package*.json ./
COPY --from=builder --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist
COPY --from=builder --chown=nonroot:nonroot /app/data ./data

USER nonroot
EXPOSE 8080
CMD ["dist/server.js"]