# Adding phpMyAdmin

Add a phpMyAdmin service alongside your Laravel container:

```yaml
services:
  pma:
    image: phpmyadmin:latest
    environment:
      PMA_HOST: mysql
      PMA_PORT: 3306
      APACHE_PORT: 8080
      UPLOAD_LIMIT: 1G
    restart: unless-stopped
    depends_on:
      - mysql
    networks:
      - default
      - main-proxy
```

Adjust `PMA_HOST` to match your database service name and the network names to match your project's network setup.
