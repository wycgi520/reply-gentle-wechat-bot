FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache ca-certificates && update-ca-certificates

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 80

CMD ["npm", "start"]
