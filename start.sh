#!/bin/bash
/usr/sbin/httpd -D FOREGROUND
node /usr/local/apache2/htdocs/bin/server.js