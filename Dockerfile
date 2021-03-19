FROM node:current-alpine

WORKDIR /usr/beep-socket

COPY package.json .

RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

CMD [ "node", "build/index.js" ]
