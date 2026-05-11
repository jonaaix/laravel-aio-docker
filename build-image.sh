#!/bin/bash

# Usage: ./build-image.sh <phpVersion> <imageType> [--push] [--platform=<platform>]
# Example: ./build-image.sh 8.4 fpm
# Example: ./build-image.sh 8.3 openswoole --push
# Example: ./build-image.sh 8.4 openswoole --platform=linux/arm64
# Example: ./build-image.sh 8.4 fpm --push --platform=linux/amd64

imageVersion=1.3

set -e

# Validate required arguments
if [ $# -lt 2 ]; then
  echo "❌ Error: Missing required arguments"
  echo "Usage: $0 <phpVersion> <imageType> [--push] [--platform=<platform>]"
  echo "Example: $0 8.4 fpm"
  echo "Example: $0 8.4 fpm --push --platform=linux/arm64"
  exit 1
fi

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

imageTag="ghcr.io/jonaaix/laravel-aio:${imageVersion}-php${phpVersion}-${imageType}"
dockerfilePath="./src/php-${imageType}/Dockerfile"

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
  --build-arg CACHEBUST_NPM_GLOBAL="$(date +%s)" \
  --tag "${imageTag}" \
  --file "${dockerfilePath}" \
  ${outputFlag} .

echo
echo "✅ Image built successfully: ${imageTag}"
[ "$push" == "--push" ] && echo "🌍 Image pushed to registry"
echo
