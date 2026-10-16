FROM node:25-bookworm-slim AS native-build
RUN apt-get update && apt-get install --yes --no-install-recommends cmake g++ make && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY native ./native
RUN cmake -S native -B native/build -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=OFF && cmake --build native/build --parallel

FROM node:25-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:25-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=native-build /app/native/build/gpo_route_solver ./native/build/gpo_route_solver
COPY bridge ./bridge
COPY shared ./shared
COPY docker/healthcheck.cjs ./docker/healthcheck.cjs
COPY docker/gateway-healthcheck.cjs ./docker/gateway-healthcheck.cjs
COPY docker/init-container-secret.cjs ./docker/init-container-secret.cjs
COPY package.json ./
RUN mkdir -p /data/missions /data/webots /data/webots/gateway-journal && chown -R node:node /data
USER node
ARG GPO_SOURCE_REVISION=unknown
LABEL org.opencontainers.image.revision=$GPO_SOURCE_REVISION
CMD ["node", "bridge/processes/run-planning-service.cjs"]
