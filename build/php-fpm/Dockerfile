ARG INPUT_PHP
ARG IMAGENAME=php:${INPUT_PHP}-fpm-alpine

FROM $IMAGENAME

############################################################
###############  GENERAL DEPENDENCIES ######################
############################################################

# Basic
RUN apk update
RUN apk add bash
RUN apk add curl
RUN apk add git
RUN apk add zip
RUN apk add imagemagick
RUN apk add mysql-client
RUN apk add nano
RUN apk add nodejs
RUN apk add npm

ADD https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/

RUN chmod +x /usr/local/bin/install-php-extensions
RUN install-php-extensions @composer
RUN install-php-extensions gd
RUN install-php-extensions bcmath
RUN install-php-extensions bz2
RUN install-php-extensions calendar
RUN install-php-extensions iconv
RUN install-php-extensions intl
RUN install-php-extensions mbstring
RUN install-php-extensions mysqli
RUN install-php-extensions opcache
RUN install-php-extensions pdo_mysql
RUN install-php-extensions pdo_pgsql
RUN install-php-extensions soap
RUN install-php-extensions zip
RUN install-php-extensions gd
RUN install-php-extensions gmp
RUN install-php-extensions ldap
RUN install-php-extensions exif
RUN install-php-extensions memcached
RUN install-php-extensions redis
RUN install-php-extensions imap
RUN install-php-extensions imagick
RUN install-php-extensions pcntl

############################################################
############ END GENERAL DEPENDENCIES ######################
############################################################

RUN rm -f /var/cache/apk/*

WORKDIR /var/www/html/site
