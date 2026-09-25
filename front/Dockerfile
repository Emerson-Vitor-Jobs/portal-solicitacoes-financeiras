FROM node:24.21.0-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit

FROM deps AS build
COPY . .
RUN npm run build

FROM deps AS test
COPY . .
CMD ["npm", "test"]

FROM nginx:1.30.5-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
