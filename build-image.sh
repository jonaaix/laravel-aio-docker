#!/bin/sh

# Usage: ./build-image.sh <phpVersion> <imageType> <arch>
# Example: ./build-image.sh 8.4 fpm-alpine arm64
# Example: ./build-image.sh 8.3 openswoole-alpine amd64

imageVersion=1.3

set -e

phpVersion="$1"
imageType="$2"
arch="${3:-amd64}" # default to amd64 if not specified

imageTag="umex/php${phpVersion}-laravel-aio:${imageVersion}-${imageType}"
dockerfilePath="./build/php-${imageType%*-alpine}/Dockerfile"

echo "Building image: ${imageTag} for architecture: ${arch}"
echo "Using Dockerfile: ${dockerfilePath}"

docker buildx build \
  --platform "linux/${arch}" \
  --build-arg INPUT_PHP="${phpVersion}" \
  --tag "${imageTag}" \
  --file "${dockerfilePath}" \
  --load .

echo
echo "✅ Image built successfully: ${imageTag} [${arch}]"
echo
