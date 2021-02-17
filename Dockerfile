FROM alpine:3.12

RUN apk update && \
    apk upgrade && \
    apk add --update --no-cache \
    curl wget bash apache2 nodejs-current nodejs-npm git \
    openssh-client ruby ruby-ffi zlib-dev \
    autoconf automake gcc make g++ optipng \
    nasm curl python3 xdg-utils openjdk8

COPY . /var/www/localhost/htdocs/

RUN cd /var/www/localhost/htdocs/ && \
    npm install -g bower && \
    npm install && \
    bower install --allow-root && \
    cd ./build && \
    ./build.sh

RUN printf "<Directory /var/www/localhost/htdocs>\nDirectoryIndex DCAT.html\n</Directory>" > \
    /etc/apache2/conf.d/creator.conf

RUN chmod 755 /var/www/localhost/htdocs/start.sh 

CMD ["/var/www/localhost/htdocs/start.sh"]