FROM node:16.3.0-alpine3.13

# Update all packages for improved security
RUN apk update && apk upgrade
# Install supervisord
RUN apk add --no-cache supervisor

WORKDIR /app

COPY . .

# Setup supervisord config
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Install dependencies
RUN npm install

CMD ["/usr/bin/supervisord"]
