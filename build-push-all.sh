#!/bin/sh

set -e

# Usage: ./build-push-all.sh <arch>
# Example: ./build-push-all.sh arm64

arch="$1"

if [ -z "$arch" ]; then
  echo "❌ Architecture missing!"
  echo "Usage: $0 <arch>"
  exit 1
fi

phpVersions=("8.4" "8.3")
imageTypes=("fpm-alpine" "franken-alpine" "roadrunner-alpine" "openswoole-alpine")

for phpVersion in "${phpVersions[@]}"; do
  for imageType in "${imageTypes[@]}"; do
    ./build-image.sh "$phpVersion" "$imageType" "$arch"
  done

  # After building all image types for one PHP version, push the tag family
  docker image push "umex/php${phpVersion}-laravel-aio" -a
done
