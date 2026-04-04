FROM node:20-alpine AS build

WORKDIR /app

COPY packages/spec5/admin-dashboard/package*.json ./
RUN npm ci

COPY packages/spec5/admin-dashboard ./
COPY tsconfig.base.json /tsconfig.base.json

ARG VITE_ADMIN_API_BASE_URL=http://localhost:3010
ARG VITE_ADMIN_BEARER_TOKEN=change-me
ARG VITE_ADMIN_USER=spec5-admin-ui

ENV VITE_ADMIN_API_BASE_URL=${VITE_ADMIN_API_BASE_URL}
ENV VITE_ADMIN_BEARER_TOKEN=${VITE_ADMIN_BEARER_TOKEN}
ENV VITE_ADMIN_USER=${VITE_ADMIN_USER}

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
