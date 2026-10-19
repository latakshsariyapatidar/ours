#!/bin/sh
# Intended for a FRESH deployment only. Refuses to overwrite an existing database.
set -eu
src=${1:?Usage: sh scripts/restore.sh /absolute/backup-directory}
case "$src" in /*) ;; *) echo 'Use an absolute source path'; exit 1;; esac
(cd "$src" && sha256sum -c SHA256SUMS)
docker compose up -d db
until docker compose exec -T db pg_isready -U ours -d ours >/dev/null 2>&1; do sleep 2; done
count=$(docker compose exec -T db psql -U ours -d ours -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
[ "$count" = 0 ] || { echo 'Restore requires an empty database. Existing data was not changed.'; exit 1; }
# The fresh deployment keeps its newly generated database password. The archived
# secret is retained for disaster recovery but must not overwrite a live DB credential.
docker compose run --rm --no-deps -T --user 1000:1000 --entrypoint tar api -C /storage -xzf - < "$src/photos.tar.gz"
docker compose exec -T db pg_restore -U ours -d ours --no-owner --exit-on-error < "$src/database.dump"
docker compose up -d
echo 'Restored. Validate login, original checksums, albums and Studio before retiring the backup.'
