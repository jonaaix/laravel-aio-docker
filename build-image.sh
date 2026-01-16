#!/bin/bash

# Usage: ./build-image.sh <phpVersion> <imageType> [--push] [--platform=<platform>]
# Example: ./build-image.sh 8.4 fpm-alpine
# Example: ./build-image.sh 8.3 openswoole-alpine --push
# Example: ./build-image.sh 8.4 openswoole-alpine --platform=linux/arm64
# Example: ./build-image.sh 8.4 fpm-alpine --push --platform=linux/amd64

imageVersion=1.3

set -e

phpVersion="$1"
imageType="$2"
shift 2

# Parse optional flags
push=""
platform=""

for arg in "$@"; do
  case "$arg" in
    --push)
      push="--push"
      ;;
    --platform=*)
      platform="${arg#*=}"
      ;;
    *)
      echo "⚠️  Unknown argument: $arg"
      exit 1
      ;;
  esac
done

imageTag="ghcr.io/jonaaix/php${phpVersion}-laravel-aio:${imageVersion}-${imageType}"
dockerfilePath="./src/php-${imageType%*-alpine}/Dockerfile"

echo "⚪️ Building image: ${imageTag}"
echo "Using Dockerfile: ${dockerfilePath}"

# Detect current architecture if platform not specified
if [ -z "$platform" ]; then
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
  echo "🔍 Auto-detected platform: ${platform}"
else
  echo "🎯 Using specified platform: ${platform}"
fi

# Decide whether to push or load (default: build only, no push)
if [ "$push" == "--push" ]; then
  outputFlag="--push"
  echo "📤 Push enabled: Image will be pushed to the registry"
else
  outputFlag="--load"
  echo "📦 Local build mode: Image will be loaded locally (no push)"
fi
echo "🏗️  Building for platform: ${platform}"

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
