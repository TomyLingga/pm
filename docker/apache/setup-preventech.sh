#!/bin/bash
# Pasang domain preventech.inl.co.id untuk PrevenTech (container preventech_fe, port 8099) di server 192.168.1.223,
# sama seperti docserter.inl.co.id dan new.inl.co.id. Aman dijalankan ulang.
# Jalankan dengan sudo dari folder proyek (setelah docker compose up -d --build):
#   sudo bash docker/apache/setup-preventech.sh
set -e
cd "$(dirname "$0")"

DOMAIN=preventech.inl.co.id
PUBLIC_IP=103.193.145.61
APP_PORT=8099

[ "$(id -u)" -eq 0 ] || { echo "Jalankan dengan sudo: sudo bash docker/apache/setup-preventech.sh"; exit 1; }

echo "== Cek aplikasi di port $APP_PORT"
code=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $DOMAIN" "http://127.0.0.1:$APP_PORT/" || true)
echo "GET / -> $code"
[ "$code" = "307" ] || { echo "PrevenTech belum menjawab di port $APP_PORT: jalankan dulu 'docker compose up -d --build'."; exit 1; }

echo "== Cek DNS"
# Let's Encrypt memvalidasi dari beberapa lokasi; cache DNS lama (TTL 4 jam) bisa masih tersisa di sebagian tempat,
# jadi nameserver resmi dan resolver publik harus sudah sepakat. Validasi gagal dibatasi 5x/jam oleh Let's Encrypt.
# Lewat 8.8.8.8: resolver utama server (Tailscale MagicDNS 100.100.100.100) menjawab SERVFAIL untuk query NS.
NS=$(dig +short NS "${DOMAIN#*.}" @8.8.8.8 | head -1)
stale=0
for resolver in "$NS" 8.8.8.8 1.1.1.1; do
    ip=$(dig +short A "$DOMAIN" @"$resolver" | tail -1)
    echo "$resolver: $DOMAIN -> ${ip:-(kosong)}"
    [ "$ip" = "$PUBLIC_IP" ] || stale=1
done
[ "$stale" = 0 ] || { echo "DNS $DOMAIN belum mengarah ke $PUBLIC_IP di semua resolver (cache lama, maks. 4 jam): coba lagi nanti."; exit 1; }

echo "== Pasang vhost Apache"
install -m 644 -o root -g root preventech.conf /etc/httpd/conf.d/preventech.conf
httpd -t
systemctl reload httpd

echo "== Minta sertifikat Let's Encrypt + redirect HTTP -> HTTPS"
certbot --apache -d "$DOMAIN" --non-interactive --agree-tos --redirect --keep-until-expiring

echo "== Reload Apache"
systemctl reload httpd

echo "== Hasil"
certbot certificates -d "$DOMAIN"
ls -la /etc/httpd/conf.d/preventech*.conf
# Langsung ke Apache server ini (resolver lokal mungkin masih menyimpan IP lama)
curl -sI --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/" | grep -iE "^HTTP|^location" || true
curl -sI --resolve "$DOMAIN:80:127.0.0.1" "http://$DOMAIN/" | grep -iE "^HTTP|^location" || true
echo "== Timer auto-renew"
systemctl list-timers 'certbot*' --no-pager || crontab -l | grep -i certbot || true

echo
echo "Selesai. Pastikan URL aplikasi PrevenTech di admin Portal = https://$DOMAIN/"
