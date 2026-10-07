# Edge nginx: TLS termination, /api + /sanctum → php-fpm (pm-api), everything else → pm-web.
# Needs pm-api's public/ directory for fastcgi (index.php) and static assets, copied from the pm-api image.
ARG PM_API_IMAGE=pm-api:latest
FROM ${PM_API_IMAGE} AS api
FROM nginx:1.27-alpine
RUN apk add --no-cache tzdata && cp /usr/share/zoneinfo/Asia/Jakarta /etc/localtime
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/pm.conf.template /etc/nginx/templates/pm.conf.template
COPY --from=api /var/www/html/public /var/www/html/public
