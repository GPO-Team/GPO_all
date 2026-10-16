FROM node:25-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY scripts/prepare-webots-viewer.mjs ./scripts/prepare-webots-viewer.mjs
COPY docker/webots-viewer-assets.json ./docker/webots-viewer-assets.json
RUN npm run prepare:viewer
COPY index.html vite.config.js tailwind.config.js postcss.config.js ./
COPY src ./src
COPY shared ./shared
COPY public ./public
RUN npm run build

FROM nginx:stable-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
ARG GPO_SOURCE_REVISION=unknown
LABEL org.opencontainers.image.revision=$GPO_SOURCE_REVISION
EXPOSE 80
