#!/bin/sh
# Stops writers for a consistent database + media snapshot. Destination is a new directory.
set -eu
dest=${1:?Usage: sh scripts/backup.sh /absolute/new-backup-directory}
case "$dest" in /*) ;; *) echo 'Use an absolute destination path'; exit 1;; esac
[ ! -e "$dest" ] || { echo 'Destination already exists'; exit 1; }
umask 077
mkdir -p "$dest"
docker compose stop api web
trap 'docker compose start api web >/dev/null' EXIT INT TERM
docker compose exec -T db pg_dump -U ours -d ours -Fc > "$dest/database.dump"
docker compose run --rm --no-deps -T --user 1000:1000 --entrypoint tar api -C /storage -czf - . > "$dest/photos.tar.gz"
docker compose run --rm --no-deps -T --user 1000:1000 --entrypoint tar api -C /secrets -czf - . > "$dest/secrets.tar.gz"
if [ -f .env ]; then cp .env "$dest/environment.env"; fi
(cd "$dest" && sha256sum database.dump photos.tar.gz secrets.tar.gz > SHA256SUMS && sha256sum -c SHA256SUMS)
echo "Verified backup: $dest. Encrypt and copy it off this machine."
