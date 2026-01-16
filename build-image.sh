#!/bin/bash

# Usage: ./build-image.sh <phpVersion> <imageType> [--push]
# Example: ./build-image.sh 8.4 fpm-alpine
# Example: ./build-image.sh 8.3 openswoole-alpine --push
# Example: ./build-image.sh 8.4 openswoole-alpine --push

imageVersion=1.3

set -e

phpVersion="$1"
imageType="$2"
push="$3"

imageTag="ghcr.io/jonaaix/php${phpVersion}-laravel-aio:${imageVersion}-${imageType}"
dockerfilePath="./build/php-${imageType%*-alpine}/Dockerfile"

echo "⚪️ Building image: ${imageTag}"
echo "Using Dockerfile: ${dockerfilePath}"

# Decide whether to push or load
if [ "$push" == "--push" ]; then
  outputFlag="--push"
  echo "📤 Push enabled: Image will be pushed to the registry"
else
  outputFlag="--load"
  echo "📦 Local load enabled: Image will be loaded locally"
fi

docker buildx build \
  --platform "linux/amd64,linux/arm64" \
  --build-arg INPUT_PHP="${phpVersion}" \
  --tag "${imageTag}" \
  --file "${dockerfilePath}" \
  ${outputFlag} .

echo
echo "✅ Image built successfully: ${imageTag}"
[ "$push" == "--push" ] && echo "🌍 Image pushed to registry"
echo
