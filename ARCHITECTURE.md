# Architecture and decisions

## Components

React 19 + TypeScript + Vite produce static assets. React Router owns navigation; TanStack Query owns fetching, invalidation and bounded cursor pages. CSS uses shared semantic tokens without a utility dependency; shared native controls and native modal dialogs keep the runtime small. Forms use shared client constraints and authoritative server Zod schemas. Explicit save is chosen over hidden autosave for collaborative final arrangements.

Express 5, PostgreSQL 17, Sharp, exifr and system libheif implement the backend. Three persistent services: Caddy, API/worker, PostgreSQL. The bootstrap container exits successfully before DB startup, using Compose dependency conditions. [Docker startup-order reference](https://docs.docker.com/compose/how-tos/startup-order/).

## Data model

`server/schema.sql` is the first transactional migration, serialized by a PostgreSQL advisory lock. Future migrations must append numbered scripts rather than edit the meaning of previously deployed columns. Relationships use foreign keys and cascading join cleanup. Photos have globally unique SHA-256, secure UUID file identifiers and ordered `(capture_local,id)` pagination. Manual albums and favorites are many-to-many references. Each Studio draft has a monotonically increasing version, final ordered photos, separate suggestions, caption history and comments. Legacy song and approval tables are retained during upgrades but are no longer used by the application.

Sessions and invitations store SHA-256 hashes of random 256-bit bearer tokens. Only two users may register, protected by an advisory lock. Setup claims are also serialized. All media and metadata routes require a live database session. Cookie: HttpOnly, SameSite=Strict, Secure in HTTPS mode. Mutations enforce a session-bound CSRF token and exact origin. The app never sends GPS coordinates to third-party services. Password hashing uses Argon2id, 19 MiB, two iterations, one lane. Login/setup/join/password attempts are rate limited. Local CLI password recovery is audited and revokes sessions.

## Storage and upload protocol

`/storage/{originals,thumbnails,previews,temporary,exports,config}` is a persistent volume or configured host path. Originals are immutable generated UUID paths; human filenames only appear in metadata and safe attachment headers. Supported signatures are detected from bytes, not client MIME.

Create an authenticated upload session with filename and expected length; stream sequential chunks (max 2 MB) at an exact offset. The browser uses 1 MB and at most three attempts per chunk. A row lock serializes a session's chunks. On uncertain completion, GET the session offset before replay. Truncate bytes beyond the acknowledged offset after interrupted writes. Completion streams SHA-256; a hash advisory lock prevents simultaneous duplicate binaries. The staging file stays until the DB commit, so a failed commit can retry. A one-day reconciler removes only unreferenced crash remnants. Permanent-file copy may leave an unreferenced original on failed commit; it never removes a committed original.

Browser queue state lives in memory. Closing the tab requires reselecting files; server-side sessions are discoverable only by their authenticated creator and expire in 24 hours. The client does not currently reconnect a new tab to an old file session. Existing duplicate originals can be added to other albums without another binary. Exact duplicate photos in Trash must be restored.

## Metadata and image processing

One worker processes one photograph or one export at a time, with Sharp concurrency 1 and a 16 MB cache. Native decoding caps normal images at 60 million pixels. HEIC uses `heif-convert` with a 60-second subprocess timeout and the API container's memory/PID constraints; unsupported codecs fail clearly. [Sharp HEIC requirements](https://sharp.pixelplumbing.com/api-output/). GIF originals preserve animation; thumbnails and Instagram exports intentionally use the first frame.

The worker extracts structured exifr metadata, including supported capture/camera/lens/exposure/orientation/GPS/ICC fields, to private JSONB. Width, height, file type, checksum, size, uploader and capture resolution are normalized. Capture preference: DateTimeOriginal, CreateDate, DateTimeDigitized, upload timestamp. `reviveValues:false` prevents inventing a timezone for local EXIF wall times. Explicit offsets and original JSON remain available; correction changes the normalized capture field only. Sorting uses the local capture wall clock, intentionally not a guessed UTC instant across travel locations. Upload fallback is labelled. Filesystem dates are not trusted.

Auto-oriented 480px WebP thumbnails and 1800px JPEG previews strip original metadata. Images are atomically renamed from `.part` outputs before ready state. Normal original downloads return exact bytes. All exports regenerate auto-oriented JPEGs with explicit centre-crop or contain options and no copied metadata. GPS never goes to a third-party geocoder. A supported format's corrupted bytes can be stored as an original with failed processing; they never become a ready gallery image.

Jobs persist pending, processing, retrying, completed and failed states. API restart requeues processing jobs. Three failures leave a visible diagnostic and manual retry control. Only one API instance is supported; do not scale replicas without adding cross-process worker leader election. Worker polls every two seconds and backs off retrying images for 20 seconds.

## Studio invariants

The latest workflow is defined in PERSONAL-DIRECTION.md. Posts are drafts or optionally marked Posted. Either authenticated household member can download a saved, nonempty carousel of ready, undeleted photos. Suggestions stay separate from selected photos. Expected-version saves prevent lost edits. Photo deletion advances the draft version; stale ZIP downloads are rejected. Size and border choices live in the download dialog. There are no approval or song endpoints.

ZIP exports are disk-backed and processed serially. Numbered JPEGs preserve order and caption.txt accompanies them. Packages expire after 24 hours. Old song and approval records are retained without being returned or exported. No Instagram authentication or automatic posting.

## Resource target

Budget estimates, not measured guarantees:

| Component | Expected working memory | Container ceiling |
|---|---:|---:|
| OS + Docker | 180–260 MB | host |
| PostgreSQL | 70–140 MB | 192 MB |
| Node API + native image worker | 120–330 MB | 384 MB |
| Caddy | 15–40 MB | 64 MB |
| Initialization | transient <10 MB | 32 MB |

Four DB connections, 20 DB max connections, 32 MB shared buffers, one upload at a time per browser, one decoder, and sequential exports. Avoid decoding pathological images; high-resolution HEIC can still exceed the container limit. A worker OOM may restart the combined API, but durable originals/jobs survive. Processing is not a separate sandbox process for normal Sharp decoding. Measure on the actual VM before trusting a large import. Build memory can exceed runtime; build off-VM or use modest swap for compilation. Never treat swap as equivalent RAM.

Gallery keeps at most five 48-item query pages, uses lazy images/content visibility, and never loads originals for grids. Earlier pages leave the bounded window; returning to the start re-fetches them. Preview zoom uses the browser-compatible preview; full original detail is downloadable.

## Backups and limitations

Backup stops API/worker and proxy, dumps DB and storage, and restarts writers via a trap. SHA-256 manifests check archive transfer integrity; restoration also needs actual application checks. Fresh restore keeps the newly initialized DB password instead of replacing it underneath a live DB. The original secret archive is preserved for forensic recovery. .env is backed up but requires operator review on another host.

Secondary limitations: no perceptual duplicate detection, reverse geocoding, Live Photo video, videos, direct Instagram integration, automatic AI captions, individual export-image download UI, or original multi-photo ZIP action. No offline private-media cache by design. SVG manifest icons may not satisfy every phone's install prompt; browser Add to Home Screen remains available where supported. Accessibility target is AA, but independent audit and physical iPhone testing are outside automated desktop verification.
