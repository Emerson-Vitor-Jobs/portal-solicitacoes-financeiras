# Binário estático do dbmate, copiado para as imagens que aplicam migrations.
FROM ghcr.io/amacneil/dbmate:2.36.0 AS dbmate

FROM node:24.21.0-alpine AS base
WORKDIR /app
COPY --from=dbmate /usr/local/bin/dbmate /usr/local/bin/dbmate

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit

FROM deps AS build
COPY . .
RUN npm run build

# Alvo do serviço back-test (profile "test"): código-fonte + devDependencies.
FROM deps AS test
COPY . .
CMD ["./docker/test.sh"]

# Alvo de produção: só dependências de runtime + o build.
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-fund --no-audit
COPY --from=build /app/dist ./dist
COPY src/repository/postgres/migrations ./migrations
COPY docker/entrypoint.sh docker/dbmate_url.sh ./
USER node
EXPOSE 3001
ENTRYPOINT ["./entrypoint.sh"]
