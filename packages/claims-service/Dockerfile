FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json .eslintrc.cjs .prettierrc ./
COPY packages ./packages

RUN npm install

ENV SERVICE_NAME=claims-service

CMD ["npm", "run", "-w", "@kawaachai/claims-service", "dev"]
