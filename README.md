# Ours

Our memories, our little corner of the internet.

A private photo library and collaborative Instagram carousel workspace for two people. React + TypeScript, a small Node API with one image worker, PostgreSQL, and Caddy. All photographs live on your own filesystem.

## Quick start

Requires Docker Engine and Docker Compose **2.24.4 or newer**, x86-64 Linux. From this repository:

```sh
docker compose up -d --build
docker compose exec api node scripts/admin.js setup-token
```

Open **http://localhost:8080**. Paste the locally displayed token into the first-run form and create your owner account. The token is never logged or sent by the server to an unauthenticated browser. Create an invitation in Settings; send that private link to your partner. Invitations expire in 48 hours and are single-use. There is no public registration.

On a remote VM, use an SSH tunnel for initial private access:

```sh
ssh -L 8080:127.0.0.1:8080 your-user@your-vm
```

Then open localhost:8080 on your computer. Public access requires your own domain and working DNS. See [DEPLOYMENT.md](DEPLOYMENT.md) for HTTPS. Local HTTP is deliberately loopback-only; do not expose passwords and originals over public HTTP.

## Using your home

- Add memories: choose several photographs or drop them onto the upload window. Uploads run one at a time in resumable 1 MB chunks. Keep the browser open; mobile operating systems can suspend it.
- Originals remain byte-for-byte unchanged. The gallery uses small previews, with private metadata in the intentional details panel. Download original preserves the exact uploaded bytes.
- Albums reference photographs without copying files. Deleting an album leaves photographs intact.
- Favorite independently, or browse favorites shared by both people.
- Add photographs to a Studio shortlist, then accept them into the carousel. Drag to reorder on desktop, or use the earlier/later controls on touch devices and keyboards.
- Save the final selection and caption, choose Final Review, and approve with both accounts. A material edit clears approvals. Prepare a ZIP, copy your caption, then publish manually in Instagram.
- Trash is recoverable for 30 days by default. After retention it is permanently deleted. Back up irreplaceable originals elsewhere.

## Architecture

```text
Browser / installed PWA
    │ same-origin authenticated requests
    ▼
Caddy — prebuilt React assets + reverse proxy
    ▼
Node API + one bounded image/export worker
    ├── PostgreSQL (metadata, sessions, durable jobs)
    └── persistent storage (originals, thumbnails, previews, temporary, exports)
```

An initialization container runs briefly to create permissions and a random database password. Only three services remain running. Database ports are never published. No Redis, object store, remote metadata service, or external font requests.

## Repository

```text
src/                   React screens, reusable UI, API client, theme
public/                PWA manifest, icon, privacy-preserving service worker
server/
  index.js             API startup, middleware, graceful shutdown
  auth.js              setup, invitation, Argon2id, sessions, recovery helpers
  db.js, schema.sql    PostgreSQL connection and idempotent migrations
  uploads.js           chunk protocol, streaming, hash deduplication
  media.js             metadata, HEIC conversion, previews, ZIP exports
  routes.js            library, albums, Studio, approvals, settings
  worker.js            durable jobs, retry, retention, crash reconciliation
  core.js              pure domain validation helpers
deploy/                Caddy HTTP/HTTPS configuration and bootstrap
scripts/               local account admin, consistent backup, fresh restore
tests/                 unit, real-stack integration and browser tests
Dockerfile             multi-stage frontend/API/proxy build
compose.yaml           private HTTP deployment and persistent volumes
compose.https.yaml     optional automatic TLS deployment
.env.example           documented operator configuration
PRODUCT.md             original product specification
DESIGN.md              visual design and token ownership
UX-CONTRACT.md         shared interaction rules
ARCHITECTURE.md         internals and security model
DEPLOYMENT.md           Oracle VM operations
API.md                 REST reference
TESTING.md             verification evidence and limitations
```

## Development and verification

```sh
npm ci
npm run build
npm test
docker compose up -d --build
npm run test:integration
npx playwright install chromium
npm run test:e2e
```

Integration tests claim an empty deployment with **test-only credentials**. Run against a disposable Compose project, never against personal data. Production contains no seeded accounts or sample photographs. See [TESTING.md](TESTING.md) for executed results and test setup.

## Operations

```sh
# Health and logs
docker compose ps
docker compose logs --tail=100 api
# Backup to a NEW absolute directory; writers stop briefly
sh scripts/backup.sh /absolute/path/to/new-backup
# Restore into a fresh deployment; refuses to overwrite existing tables
sh scripts/restore.sh /absolute/path/to/backup
# Update after making a backup
git pull --ff-only
docker compose up -d --build
```

Do not run `docker compose down -v`: it removes Docker-managed database and photo volumes. Ordinary `down`, restart and rebuild preserve data. A backup on the same VM does not protect against VM loss. Copy encrypted backups elsewhere and practice restoration.

## Account recovery

Local shell access to the deployment is required. Read the new password without adding it to shell history:

```sh
read -r -s -p 'New password: ' OURS_NEW_PASSWORD
printf '%s' "$OURS_NEW_PASSWORD" | docker compose exec -T api node scripts/admin.js reset-password your-email@example.com
unset OURS_NEW_PASSWORD
```

All sessions for that account are revoked. Passwords need 12–128 characters.

## Troubleshooting

- First build takes longer than startup: Node dependencies, HEIC libraries and images must download. Build on another x86-64 machine if the VM runs out of memory during compilation.
- Setup token fails: check for whitespace and whether the home was already claimed. The token is removed after successful setup.
- Upload stalls: keep the browser open; retry the failed item. Closing the tab loses the local file queue. Abandoned server chunks expire after 24 hours.
- HEIC or corrupt image fails: the original remains available to download, with a visible failed preview state. Retry after checking codec support. GIF original animation is preserved, but preview/export is a still frame.
- Request-origin error: set `APP_URL` to the exact browser origin, then recreate the API service.
- Storage warning: move verified backups off the VM and review Trash. The server will never delete non-trashed originals to make room.
- Studio conflict: copy local text you want to keep, then reload your partner's version and reconcile. Stale saves are rejected, never silently overwritten.

See the documented constraints in [ARCHITECTURE.md](ARCHITECTURE.md) and [TESTING.md](TESTING.md). This repository is not an independent security certification.
