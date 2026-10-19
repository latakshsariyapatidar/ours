#!/bin/sh
set -eu
umask 077
mkdir -p /secrets /storage/originals /storage/thumbnails /storage/previews /storage/temporary /storage/exports /storage/config
if [ ! -s /secrets/db-password ]; then
  head -c 48 /dev/urandom | od -An -tx1 | tr -d ' \n' > /secrets/db-password.tmp
  mv /secrets/db-password.tmp /secrets/db-password
fi
chmod 700 /secrets
chmod 600 /secrets/db-password
chown -R 1000:1000 /secrets
chown 1000:1000 /storage /storage/originals /storage/thumbnails /storage/previews /storage/temporary /storage/exports /storage/config
chmod 700 /storage /storage/originals /storage/thumbnails /storage/previews /storage/temporary /storage/exports /storage/config
