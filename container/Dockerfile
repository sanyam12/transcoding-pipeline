FROM node:18-alpine

RUN apk update
RUN apk upgrade
RUN apk add --no-cache ffmpeg

WORKDIR /app
COPY package.json .
COPY package-lock.json .
COPY index.js .
COPY .env .

RUN npm install

CMD [ "npm", "start" ]
