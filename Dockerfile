FROM node:18.16.0-alpine3.17
WORKDIR /usr/src/app
RUN apk update && \
    apk add --no-cache ffmpeg
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "bot.js"]