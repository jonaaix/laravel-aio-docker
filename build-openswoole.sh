#!/bin/sh

phpVersion=8.4
imageVersion=1.2
imageType=openswoole-alpine
imageTag=umex/php"${phpVersion}"-laravel-aio:"${imageVersion}"-"${imageType}"

echo building image: $imageTag

docker build --build-arg INPUT_PHP="$phpVersion" --tag $imageTag --file ./build/php-openswoole/Dockerfile .
#docker build --platform linux/amd64,linux/arm64 --build-arg INPUT_PHP="$phpVersion" --tag $imageTag --file ./build/php-openswoole/Dockerfile .
