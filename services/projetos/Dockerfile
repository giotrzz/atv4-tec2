# Imagem base exigida pela ATV4
FROM node:18-alpine

# curl é usado pelo healthcheck do docker-compose
RUN apk add --no-cache curl

WORKDIR /usr/src/app

# Copiar só os manifests primeiro aproveita o cache de camadas do Docker
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 3002

CMD ["npm", "start"]
