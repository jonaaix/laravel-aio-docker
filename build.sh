#!/bin/sh

docker build --build-arg INPUT_PHP="8.2" --tag "1.0" --file ./build/php-fpm/Dockerfile .
