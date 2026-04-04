FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json .eslintrc.cjs .prettierrc ./
COPY packages ./packages

RUN npm install

ENV SERVICE_NAME=trigger-monitor

CMD ["npm", "run", "-w", "@kawaachai/trigger-monitor", "dev"]
