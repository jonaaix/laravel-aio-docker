# Serving a JavaScript SPA with the integrated nginx

Serve a JavaScript SPA (Vue, React, etc.) from the same container as your Laravel API by mounting a custom `nginx.conf` and the SPA build output.

## Compose mounts

Create a custom `nginx.conf` in your repository, and mount it in place of the default one. Also mount your built SPA into `/js-app`.

```yaml
services:
  php:
    volumes:
      - ./nginx.conf:/etc/nginx/http.d/default.conf
      - ../my-app:/js-app
```

> [!WARNING]
> When you mount your own vhost over `default.conf`, the container detects it and skips
> its own config rendering — so the `HTTP_PORT` env var has **no effect** here. Set the
> `listen` port directly in your config; keeping it in sync with your port mapping is then
> your responsibility.

## nginx config

In the config file, add the following location block (after `/basic_status`) to serve your SPA at `/app/*`:

```nginx
####################################
####### Start serving JS app #######
####################################
location = / {
    return 301 $real_scheme://$http_host/app/;
}

location = /app {
    return 301 $real_scheme://$http_host/app/;
}

# Handle all SPA routes under /app/*
location ^~ /app/ {
    alias /js-app/;
    index index.html;

    # SPA fallback: this ensures /app/* routes always hit the frontend
    try_files $uri $uri/ /app/index.html;

    location ~* \.(?:manifest|appcache|html?|xml|json)$ {
        expires -1;
    }

    location ~* \.(jpg|jpeg|png|gif|ico|woff2?|otf|ttf|js|svg|css|txt|wav|mp3|aff|dic)$ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }
}
####################################
####### End serving JS app #########
####################################
```

The Laravel API continues to be served from the same container; only `/app/*` routes are rewritten to the SPA build directory.
