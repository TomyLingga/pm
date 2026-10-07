# pm-api — PHP-FPM image (Laravel 8, PHP 8.2). Built from the repository root:
#   docker build -f docker/pm-api/Dockerfile -t pm-api .
FROM composer:2 AS vendor
WORKDIR /app
COPY pm-api/composer.json pm-api/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction
COPY pm-api/ ./
RUN composer dump-autoload --optimize --classmap-authoritative --no-dev

FROM php:8.2-fpm-alpine AS app
RUN apk add --no-cache postgresql-dev libzip-dev libpng-dev libjpeg-turbo-dev freetype-dev icu-dev oniguruma-dev bash tzdata \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql pgsql gd zip intl bcmath opcache pcntl \
    && cp /usr/share/zoneinfo/Asia/Jakarta /etc/localtime && echo "Asia/Jakarta" > /etc/timezone

COPY docker/pm-api/php.ini /usr/local/etc/php/conf.d/zz-pm.ini
COPY docker/pm-api/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /var/www/html
COPY --from=vendor /app ./
RUN mkdir -p storage/framework/{cache,sessions,views} storage/logs storage/app/attachments bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

USER www-data
ENTRYPOINT ["entrypoint.sh"]
CMD ["php-fpm"]
