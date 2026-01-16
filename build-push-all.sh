#!/bin/bash

set -e

# Usage: ./build-push-all.sh <arch>
# Example: ./build-push-all.sh

phpVersions=("8.4" "8.3")
imageTypes=("fpm-alpine" "franken-alpine" "roadrunner-alpine" "openswoole-alpine")

for phpVersion in "${phpVersions[@]}"; do
  for imageType in "${imageTypes[@]}"; do
     echo
     echo "--------------------------------------------------"
     echo "️⚽️ Building and pushing ghcr.io/jonaaix/php${phpVersion}-laravel-aio:${imageType}..."
     echo "--------------------------------------------------"
    ./build-image.sh "$phpVersion" "$imageType"
  done

  # After building all image types for one PHP version, push the tag family
  docker image push "ghcr.io/jonaaix/php${phpVersion}-laravel-aio" -a
done
