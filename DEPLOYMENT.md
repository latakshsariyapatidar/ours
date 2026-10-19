# Oracle Cloud deployment

Target: x86-64 Oracle Linux/Ubuntu, E2.1.Micro, 1 GB RAM, local disk. Install Docker Engine and Compose 2.24.4+ using Docker's maintained OS instructions. Docker access is equivalent to host administration; restrict SSH keys and docker-group membership.

## First private launch

```sh
git clone YOUR_REPOSITORY_URL ours
cd ours
docker compose up -d --build
docker compose ps
docker compose exec api node scripts/admin.js setup-token
```

The repository URL is supplied by your own Git hosting; this task does not publish a remote repository. No manual migrations, directory creation, fixed passwords or source edits. Default endpoint binds only `127.0.0.1:8080`. Use the SSH tunnel in README for remote first setup. The protected setup token is generated at first API initialization and removed after owner claim.

Persistent named volumes: database, photos, secrets, caddy_data, caddy_config (prefixed with Compose project name). To use `/srv/ours`, set `STORAGE_VOLUME=/srv/ours` in `.env` before first launch. Compose and bootstrap create and permission the path. Never change the storage volume on an existing deployment without a backup/migration.

## Public HTTPS

You need domain ownership and DNS A record resolving to the VM's public IPv4. If publishing AAAA, ensure IPv6 is actually reachable. Allow TCP 80/443 in OCI network security groups/security lists and host firewall; optionally UDP 443 for HTTP/3. Do not open PostgreSQL or the API port. Keep SSH restricted to trusted source addresses.

```sh
cp .env.example .env
# Edit DOMAIN in .env to your actual domain, e.g. photos.your-domain
docker compose -f compose.yaml -f compose.https.yaml up -d --build
```

Caddy obtains and renews real certificates when DNS and port reachability work. The override sets APP_URL and Secure cookies. It replaces the private HTTP port mapping with 80/443. Use the same `-f` pair for later Compose commands, or export `COMPOSE_FILE=compose.yaml:compose.https.yaml` in your Linux shell. Failure to obtain a certificate is an operational failure, not HTTPS readiness.

For LAN-only HTTP verification set HOST_BIND to the desired private interface and APP_URL to its exact origin. HTTP offers no transit privacy and phone install features vary. Never use that as public production access.

## Memory and CPU

Runtime ceilings: DB 192 MB, API+worker 384 MB, proxy 64 MB. One decoder and one export at a time; native threads bounded. Baseline CPU is tiny, so large imports will take time. A 2–4 GB host swap file may reduce transient build failures, but is an operator action outside the containers. Prefer building on a stronger x86-64 host and transferring images when possible. Do not claim build-time fits the runtime budget.

```sh
docker stats --no-stream
docker compose logs --tail=100 api db web
df -h
```

Test realistic phone photographs, including HEIC, before importing your entire library. If a decoder hits the memory ceiling, the API may restart and recover jobs; lower MAX_IMAGE_PIXELS or convert a working copy for upload while preserving your external original. Never delete the sole original on a phone until verified off-VM backups exist.

## Backups

```sh
sh scripts/backup.sh /mnt/backup/ours-2026-10-19
cd /mnt/backup/ours-2026-10-19
sha256sum -c SHA256SUMS
```

The script stops writers and proxy briefly, exports pg_dump custom format, archives originals/derived/config and secrets, then restarts writers on exit. Filesystem archive remains readable only by the local owner. Backups contain private images, GPS, password hashes, sessions and configuration. Encrypt before external transfer (e.g. age with your own recipient key), then copy to a separate machine. Keep your encryption key separately. A backup on the 180 GB boot disk does not protect against VM loss. Backup disk capacity is not pre-reserved; choose a destination with sufficient free space.

Example optional cron, after configuring destination and logging:

```cron
0 3 * * 0 cd /srv/ours-app && sh scripts/backup.sh /mnt/external/ours-$(date +\%Y\%m\%d) >> /var/log/ours-backup.log 2>&1
```

No cron or deletion policy is enabled automatically. Monitor failures and periodically test restore.

## Restore drill

Use an isolated fresh Compose project or new VM. Build images, review configuration and keep networking private.

```sh
docker compose build
sh scripts/restore.sh /absolute/verified-backup
docker compose ps
```

The script refuses a nonempty database. It keeps freshly generated DB credentials, restores storage and the SQL dump, then starts the app. Restore .env settings deliberately for the new domain/storage layout; do not blindly overwrite machine-specific paths. Verify both logins, several original SHA-256 hashes, thumbnails, album membership, draft ordering and export. The one-time setup page should not appear for a restored home. Clear stale browser cookies if testing a separate restored deployment.

## Update and rollback

1. Make a verified backup; note current Git revision/image IDs.
2. `git pull --ff-only` and `docker compose up -d --build` (with HTTPS override when applicable).
3. Check health, login and one original download. Review migration logs.
4. On failure, preserve current volumes. Restore the previous backup into a separate fresh project with the previous code revision. Do not run destructive database downgrades against the only copy.

`docker compose down` preserves volumes. **`docker compose down -v` deletes them.** VM reboot uses restart policies. Never move Docker data manually while containers are running.
