# PrevenTech backend (pm-api): Laravel 8 on PHP 8.2, nginx + php-fpm in one container, HTTP on port 8080.
# Built by ../docker-compose.yml (context ./pm-api). Code and vendor/ are baked into the image, so a deploy is
# `git pull && docker compose up -d --build`. The same image runs pm-worker and pm-scheduler.
FROM serversideup/php:8.2-fpm-nginx

USER root

# pdo_pgsql, redis, zip, pcntl and opcache ship with the image; dompdf/Excel need gd, plus intl and bcmath.
RUN install-php-extensions gd intl bcmath \
    && chown www-data:www-data /var/www/html

# PHP settings of serversideup/php (also apply to the worker and scheduler containers)
ENV PHP_DATE_TIMEZONE=Asia/Jakarta \
    PHP_OPCACHE_ENABLE=1 \
    PHP_MEMORY_LIMIT=512M \
    PHP_MAX_EXECUTION_TIME=120 \
    PHP_UPLOAD_MAX_FILE_SIZE=12M \
    PHP_POST_MAX_SIZE=64M \
    NGINX_CLIENT_MAX_BODY_SIZE=64M

USER www-data
WORKDIR /var/www/html

# Dependencies first, so this layer is reused until composer.lock changes
COPY --chown=www-data:www-data composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction --no-progress

COPY --chown=www-data:www-data . .
# The post-autoload-dump hook runs `artisan package:discover`, which writes bootstrap/cache.
RUN mkdir -p storage/app/attachments storage/app/public storage/logs \
        storage/framework/cache/data storage/framework/sessions storage/framework/views bootstrap/cache \
    && composer dump-autoload --optimize --no-dev --no-interaction
