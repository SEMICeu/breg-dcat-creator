FROM alpine:3.12

# Install base packages
RUN apk update 
RUN apk upgrade 
RUN apk add curl wget bash

# Install NodeJS and Ruby
RUN apk add --update --no-cache apache2 nodejs-current nodejs-npm git openssh-client ruby ruby-ffi zlib-dev autoconf automake gcc make g++ optipng nasm curl python3 xdg-utils

# Copy app files and set working dir
COPY . /var/www/localhost/htdocs/


# Install dependencies
RUN cd /var/www/localhost/htdocs/ && npm install -g bower && npm install && bower install --allow-root

#Usuario node para ejecutar el renderer
# RUN addgroup -S node && adduser -S -G node node
# USER node

RUN chmod 755 /var/www/localhost/htdocs/start.sh 
ENTRYPOINT ["/var/www/localhost/htdocs/start.sh"]