# docker-container-laravel

### Example docker-compose.yml

```yml
networks:
   public:
      external: false
   app:
      external: false
   
   
volumes:
   db_volume:
      driver: local
   redis_volume:
      driver: local

services:

   php:
      container_name: ${APP_NAME}_php
      image: umex/php8.3-laravel-aio:1.0-fpm-alpine
      stop_grace_period: 60s
      volumes:
         - ./:/app
         - redis_volume:/var/lib/redis
      environment:
         START_REDIS: false
         START_SUPERVISOR: false
         ENABLE_QUEUE_WORKER: false
         ENABLE_HORIZON_WORKER: true
         ENABLE_NPM_RUN_DEV: true
         ENV_DEV: true
         REDIS_PASS: ${REDIS_PASSWORD}
      ports:
         - "8000:8000" # php
         - "5173:5173" # vite
         - "6379:6379" # redis
      restart: unless-stopped
      networks:
         - app
         - public

   mysql:
      container_name: ${APP_NAME}_mysql
      image: mariadb:lts
      command:
         - '--character-set-server=utf8mb4'
         - '--collation-server=utf8mb4_unicode_ci'
         - '--skip-name-resolve'
      volumes:
         - db_volume:/var/lib/mysql/:delegated
      cap_add:
         - SYS_NICE # CAP_SYS_NICE
      environment:
         MYSQL_INITDB_SKIP_TZINFO: '1'
         MYSQL_ALLOW_EMPTY_PASSWORD: 'false'
         ### Database initialization config:
         MYSQL_ROOT_PASSWORD: ${DOCKER_MYSQL_INIT_ROOT_PASSWORD}
         MYSQL_USER: ${DB_USERNAME}
         MYSQL_PASSWORD: ${DB_PASSWORD}
         MYSQL_DATABASE: ${DB_DATABASE}
      ports:
         - "3306:3306"
      restart: unless-stopped
      networks:
         - app
```
