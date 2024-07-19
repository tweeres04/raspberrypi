FROM node:lts-alpine

WORKDIR /app
COPY cronjobs /etc/crontabs/tweeres

CMD ["crond", "-f", "-d", "8"]