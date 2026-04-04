FROM node:20-alpine AS deps

WORKDIR /app

COPY packages/spec5/admin-api/package*.json ./
RUN npm ci

FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY packages/spec5/admin-api/package*.json ./
COPY packages/spec5/admin-api/tsconfig.json ./tsconfig.json
COPY tsconfig.base.json /tsconfig.base.json
COPY packages/spec5/admin-api/src ./src

RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY packages/spec5/admin-api/package*.json ./
COPY packages/spec5/admin-api/scripts ./scripts

EXPOSE 3010

CMD ["npm", "run", "start"]
