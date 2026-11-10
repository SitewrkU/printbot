FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# postinstall (prisma generate) вимкнено: схема ще не скопійована.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Міграції застосовуються при старті: безпечно для одного інстансу.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
