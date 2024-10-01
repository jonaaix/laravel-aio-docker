#!/usr/bin/env bash

./build-fpm.sh
./build-franken.sh
./build-roadrunner.sh

docker image push umex/php8.3-laravel-aio -a
