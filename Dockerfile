# Build en varias etapas: la imagen final no lleva el compilador ni las
# dependencias de desarrollo.
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# Las migraciones son .sql y tsc no las copia.
RUN cp src/infrastructure/persistence/migrations/*.sql \
       dist/infrastructure/persistence/migrations/

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Solo dependencias de producción.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Usuario sin privilegios: un proceso comprometido no debe ser root.
USER node

EXPOSE 3000

# dumb-init no está disponible, pero Node responde a SIGTERM y el servicio
# cierra el pool ordenadamente gracias a enableShutdownHooks().
CMD ["node", "dist/main.js"]
