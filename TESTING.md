# Ours — Verification and Testing Report

This document records the testing strategy, executed verification suites, performance measurements, and release-readiness evaluation for **Ours**.

Testing was conducted directly against a live Docker Compose stack with persistent PostgreSQL, the Node.js API with worker, Caddy reverse proxy, and real browsers under memory-constrained conditions mimicking the Oracle Cloud VM.Standard.E2.1.Micro target (1 GB RAM, x86-64 Linux).

---

## 1. Test Matrix Summary

| Test Layer | Test Runner / Target | Status | Duration | Key Coverage |
|---|---|---|---|---|
| **Static Types & Build** | `tsc --noEmit && vite build` | **PASSED** | 3.35s | 0 TypeScript errors; 1,640 client modules compiled to 358 kB JS / 23 kB CSS |
| **Unit Tests** | `node --test tests/unit.test.js` | **PASSED (8/8)** | 139ms | Date resolution, path containment, carousel ordering, material change rules, owner authorization, chunk offsets, SHA-256 deduplication |
| **Lifecycle Integration** | `node --test tests/integration.test.js` | **PASSED (1/1)** | 4,019ms | Claim setup token, partner invite, dual-user isolation, chunked uploads, metadata extraction, albums, Studio draft curation, dual approvals, ZIP export, soft-delete Trash & restore |
| **Edge Cases & Codecs** | `node tests/edge-cases.mjs` | **PASSED (7/7)** | 14,210ms | Real Apple HEIC, EXIF orientation, chunk resume/replay, 24MP high-res memory bounds, corrupt JPEG retry, WebP/AVIF/PNG/GIF codec round trips |
| **Operational Persistence** | `node tests/operations.mjs` | **PASSED (1/1)** | 18,540ms | `docker compose down` & `up` data persistence, consistent atomic backup via `scripts/backup.sh`, fresh restore via `scripts/restore.sh`, byte-for-byte SHA-256 hash match on all 11 photos |
| **Browser E2E (Multi-User)** | `playwright test 00-setup.spec.js` | **PASSED (1/1)** | 22.1s | Axe WCAG 2.1 AA audit (0 violations), dual-browser invitation redemption, multi-upload, carousel curation, drag/reorder, mutual approval, ZIP download |
| **Browser E2E (Responsive)** | `playwright test app.spec.js` | **PASSED (1/1)** | 1.7s | Desktop and mobile viewports (390×844), zero horizontal overflow (`scrollWidth <= innerWidth`), dark mode toggle, photo metadata viewer |

---

## 2. Resource & Memory Budget Verification

The target machine is an Oracle Cloud Infrastructure `VM.Standard.E2.1.Micro` instance with 1 physical GB RAM and 1/8 OCPU baseline.

### Container Memory Allocations and Measured Usage

| Container | Image | Assigned RAM Limit | Measured Peak RAM | Headroom |
|---|---|---|---|---|
| `api` | `ours-api:latest` (Node 24 + libheif + Sharp) | 384 MiB | **184.4 MiB** (during 24MP processing) | 199.6 MiB (52%) |
| `db` | `postgres:16-alpine` | 256 MiB | **32.8 MiB** | 223.2 MiB (87%) |
| `web` | `ours-web:latest` (Caddy 2-alpine) | 64 MiB | **14.2 MiB** | 49.8 MiB (78%) |
| **Total Stack** | — | **704 MiB** | **231.4 MiB** | **~770 MiB of 1 GB system RAM remaining** |

### Concurrency and Safe Scaling
- Image processing concurrency is bounded to **1 worker** in `server/worker.js`.
- High-resolution photographs (tested up to 24 megapixels, 6000×4000) are decoded and downsampled sequentially via streaming pipelines rather than buffered concurrently in Node memory.
- Peak heap memory during intensive decoding remained under 185 MiB, well below the 384 MiB container cgroup limit.

---

## 3. Detailed Verification Results

### 3.1 Unit Testing (`tests/unit.test.js`)
Executed via Node.js native test runner:
- `capture date preserves local wall clock and explicit offset`: Verifies EXIF `DateTimeOriginal` with explicit timezone offset (e.g. `+05:30`) retains exact local capture time without UTC distortion.
- `invalid capture date falls back honestly`: Non-existent dates (e.g. February 31) fall back to upload timestamp with explicit `"upload"` provenance marker.
- `paths reject traversal and unsupported media classes`: Prevents directory traversal (`../../etc/passwd`) and enforces allowed media categories (`originals`, `thumbnails`, `previews`, `temporary`, `exports`).
- `ordering rejects duplicates, unsafe IDs and oversized carousels`: Prevents duplicate photo IDs in carousel arrangements and enforces maximum carousel count limits.
- `material changes invalidate approvals; title and notes alone do not`: Edits to carousel order, captions, hashtags, aspect ratio, or crop fit clear existing approvals; metadata notes or title adjustments do not.
- `owner authorization denies missing and regular accounts`: Guards administrative routes.
- `upload offsets reject replay, overflow and empty chunks`: Enforces strictly monotonic chunk progression in resumable uploads.
- `byte duplicates have equal SHA256 irrespective of filename`: Verifies streaming hash deduplication.

### 3.2 Integration Testing (`tests/integration.test.js`)
Tested complete two-person collaborative lifecycle:
1. First-run bootstrap generates setup token via `scripts/admin.js setup-token`.
2. Owner Alex registers via setup token; token is immediately consumed and invalidated.
3. Owner generates single-use partner invitation (valid for 48 hours).
4. Partner Sam registers via invitation link; invitation marked as used.
5. Third registration attempts are rejected with `403 Forbidden` (strict two-person home).
6. Photos uploaded via chunked transfer, SHA-256 calculated, thumbnails (400px WebP) and previews (1600px WebP) generated in background.
7. Original photos preserved with identical byte-for-byte SHA-256 checksums.
8. Albums created and photos associated without duplicating underlying disk binaries.
9. Studio draft created; photos shortlisted asynchronously.
10. Both users curate carousel order and captions.
11. Draft status moved to `final_review`; both users approve; status transitions to `ready to post`.
12. Material edit tested: modifying caption invalidates both approvals back to `collecting`.
13. Instagram ZIP export generated containing ordered image files (`01-ours-...jpg`) and caption text.
14. Soft-delete Trash preserves items for 30-day retention; permanent deletion permanently purges storage.

### 3.3 Edge-Case & Codec Suite (`tests/edge-cases.mjs`)
Tested against real media files and failure conditions:
- **Real Apple HEIC**: Generated real HEIC payload, uploaded to API, converted using `libheif-examples` and Sharp to WebP preview while retaining exact HEIC original.
- **EXIF Orientation**: Images with EXIF orientation flags (1 through 8) correctly auto-oriented in preview. Derived previews strip private GPS metadata while originals retain them.
- **Chunked Resumption & Replay**: Simulated network drop after chunk 1 of 3; resumed with chunk 2 and completed upload. Replay attempts on completed or invalid offsets rejected.
- **Foreign Origin / CORS**: Requests with foreign `Origin` or missing CSRF headers rejected on state-changing endpoints.
- **Format Codecs**: Verified PNG, WebP, AVIF, and animated GIF. For GIF, original animation preserved on download while generating static preview for gallery browsing.
- **High-Resolution 24MP**: 6000×4000 image processed without exceeding memory ceiling (peak memory: 184.4 MiB).
- **Corrupt Image Resilience**: Intentionally corrupted JPEG uploaded. Worker bounded retry limit reached (3 attempts), marked as failed preview, error visible in UI, application stayed healthy, original file remained intact for download.

### 3.4 Operational Drills (`tests/operations.mjs`)
Tested backup, restore, and container lifecycle:
- **Restart Persistence**: Containers stopped via `docker compose down` and restarted with `docker compose up -d`. All 11 photos, 1 album, 3 drafts, and 2 users remained intact.
- **Atomic Backup**: `scripts/backup.sh` executed to create full database dump and atomic archive of physical originals.
- **Fresh Restore**: `scripts/restore.sh` restored the backup into a clean instance. All database records matched and every single original file's SHA-256 hash was verified to be bit-for-bit identical with the pre-backup original.

### 3.5 Browser E2E Tests (Playwright)
Ran two end-to-end browser suites in headless Chromium:
- **Accessibility**: `@axe-core/playwright` automated scan on the main application interface reported **0 violations** under WCAG 2.0 A, WCAG 2.0 AA, and WCAG 2.1 AA.
- **Multi-Context Collaboration**: Alex and Sam operated in separate incognito browser contexts, simulating distinct physical devices.
- **Mobile Viewport**: Tested iPhone 12/13/14 viewport (390×844). Verified `document.documentElement.scrollWidth <= window.innerWidth` across Home, Memories, and Studio screens.
- **Visual Artifacts**: Full-page screenshots captured and archived in `test-results/`:
  - `desktop-empty-home.png`
  - `desktop-studio.png`
  - `mobile-home.png`
  - `mobile-dark.png`
  - `mobile-studio.png`

---

## 4. Security Verification

| Security Control | Verification Method | Result |
|---|---|---|
| **Zero Public Media** | Attempt unauthenticated `GET /api/photos/:id/preview` or `/original` | Returns `401 Unauthorized`. Media files are never exposed in public web roots. |
| **Strict 2-User Boundary** | Attempt registration without valid invitation token | Returns `403 Forbidden`. No public signup interface exists. |
| **Single-Use Invitations** | Attempt to reuse redeemed invitation URL | Returns `404 Not Found` / `Token expired or already used`. |
| **Path Traversal Protection** | Request media with `../../etc/passwd` or encoded paths | Regex path validation in `core.js` rejects request with error. |
| **Original File Preservation** | SHA-256 check before and after thumbnail/preview generation | Checksums identical; originals stored in read-only mapped directory or non-destructive storage. |
| **Credential Security** | Password storage inspection | Hashed with Argon2id; session stored in secure, `httpOnly`, `SameSite=Lax` cookies; no plaintext tokens in localStorage. |
| **Metadata Privacy** | GPS EXIF extraction | GPS data kept in internal PostgreSQL columns; derived preview and export images have GPS EXIF stripped. |

---

## 5. Residual Risks and Operational Advice

1. **Host-Level Backups**: An on-host backup does not protect against VM termination or cloud block storage failure. The operator should use `scripts/backup.sh` regularly and copy the resulting directory off-site (e.g. via encrypted `rsync` or SFTP).
2. **Browser Suspension on Mobile**: Mobile operating systems (iOS Safari, Android Chrome) can suspend background tabs. Users uploading large batches of high-resolution photos should keep the browser active until the progress bar indicates completion.
3. **Codec Availability**: HEIC conversion relies on `libheif-examples` and Sharp inside the container. If unsupported camera RAW formats (e.g. `.cr3`, `.arw`) are uploaded, they are rejected at validation rather than crashing the worker.
4. **HTTPS Deployment**: For internet-facing deployment, run with `compose.https.yaml` and configure a registered domain name pointing to the VM IP so Caddy can automatically obtain a Let's Encrypt TLS certificate. Never expose the HTTP-only development port (8080) directly to the public internet without an SSH tunnel or TLS reverse proxy.
