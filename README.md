# docker-container-laravel

### Example docker-compose.yml

```yml
networks:
   group_public:
      external: false
   group_app:
      external: false
   
   
volumes:
   db_volume:
      driver: local
   redis_volume:
      driver: local

services:

   laravel:
      image: umex/php8.3-laravel-aio:1.0-franken-alpine
      volumes:
         - ./:/app
         - redis_volume:/var/lib/redis
      environment:
         START_REDIS: false
         START_SUPERVISOR: false
         ENABLE_QUEUE_WORKER: false
         ENABLE_HORIZON_WORKER: true
         ENV_DEV: true
         REDIS_PASS: e1nmalh1nallesdr1n
      ports:
         - "8000:8000"

   mysql:
      container_name: ${APP_NAME}_mysql
      image: mariadb:10.11.2
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
         - "3308:3306"
      restart: unless-stopped
      networks:
         - apc_group_app
```
