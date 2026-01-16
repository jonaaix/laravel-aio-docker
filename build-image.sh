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
dockerfilePath="./src/php-${imageType%*-alpine}/Dockerfile"

echo "⚪️ Building image: ${imageTag}"
echo "Using Dockerfile: ${dockerfilePath}"

# Detect current architecture
arch=$(uname -m)
case "$arch" in
  x86_64)
    platform="linux/amd64"
    ;;
  aarch64|arm64)
    platform="linux/arm64"
    ;;
  *)
    echo "⚠️  Unknown architecture: $arch, defaulting to linux/amd64"
    platform="linux/amd64"
    ;;
esac

# Decide whether to push or load (default: build only, no push)
if [ "$push" == "--push" ]; then
  outputFlag="--push"
  echo "📤 Push enabled: Image will be pushed to the registry"
  echo "🏗️  Building for platform: ${platform}"
else
  outputFlag="--load"
  echo "📦 Local build mode: Image will be loaded locally (no push)"
  echo "🏗️  Building for current architecture: ${platform}"
fi

docker buildx build \
  --platform "${platform}" \
  --build-arg INPUT_PHP="${phpVersion}" \
  --tag "${imageTag}" \
  --file "${dockerfilePath}" \
  ${outputFlag} .

echo
echo "✅ Image built successfully: ${imageTag}"
[ "$push" == "--push" ] && echo "🌍 Image pushed to registry"
echo
