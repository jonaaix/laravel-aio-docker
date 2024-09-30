#!/bin/sh

phpVersion=8.3
imageVersion=1.1
imageType=roadrunner-alpine
imageTag=umex/php"${phpVersion}"-laravel-aio:"${imageVersion}"-"${imageType}"

echo building image: $imageTag

docker build --build-arg INPUT_PHP="$phpVersion" --tag $imageTag --file ./build/php-roadrunner/Dockerfile .
#docker build --platform linux/amd64,linux/arm64 --build-arg INPUT_PHP="$phpVersion" --tag $imageTag --file ./build/php-roadrunner/Dockerfile .
