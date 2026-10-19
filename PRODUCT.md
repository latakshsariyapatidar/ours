# Project Ours — Complete Product & Engineering Specification

## 0. Your Role and Execution Instructions

You are acting as a senior product engineer, system architect, UI/UX designer, DevOps engineer, and security engineer.

Your responsibility is to **design, build, test, document, and deliver an entire production-ready application**, not a prototype or a collection of example implementations.

Do not ask me to make routine implementation decisions. Make technically sound choices independently, document important assumptions, and execute the project end to end.

Only ask questions when an external credential, domain ownership, or another truly unavailable piece of information is absolutely required.

Your deliverable is a complete Git repository which I can clone onto my Oracle Cloud Linux VM and launch using:

```bash
docker compose up -d --build
```

The application must automatically initialize its database, create required directories, initialize first-run setup, start all necessary services, and become operational without manual code modifications.

Do not claim success unless you have actually built, started, and tested the application.

Prioritize correctness, privacy, simplicity, performance, reliability, and a polished user experience.

---

# 1. Product Vision

## 1.1 Product Name

**Ours**

Tagline: "Our memories, our little corner of the internet."

The name should be configurable without requiring source code changes.

## 1.2 The Problem

I have thousands of photographs of my girlfriend, our trips, dates, outings, and shared memories stored on my phone.

She cannot independently access these photographs whenever she wants.

This creates two problems:

1. She depends on me to send photographs.
2. Preparing Instagram posts gets delayed because we rarely find time to review all the photographs together.

However, we genuinely enjoy sitting together, choosing our favorite photographs, deciding their order, choosing captions, and creating Instagram posts.

I do not want to automate away that shared experience.

## 1.3 The Solution

Create a private, elegant, mobile-first web application exclusively for two people.

The application must have two closely integrated experiences:

**Our Memories:** A beautiful, organized, searchable, shared photo library that both users can access independently.

**Our Studio:** A collaborative Instagram post preparation workspace where both users can shortlist photos asynchronously and finalize posts together.

The application should feel like a private digital home rather than an enterprise file manager.

## 1.4 Design Philosophy

The guiding principle is:

"Make memories accessible independently, but preserve the joy of creating something together."

Avoid unnecessary features, complicated screens, excessive controls, and overwhelming dashboards.

The interface must feel fast, intentional, romantic without being childish, and polished.

---

# 2. Deployment Environment and Hard Constraints

Target environment:

| Component | Specification |
|---|---|
| Cloud provider | Oracle Cloud Infrastructure |
| VM shape | VM.Standard.E2.1.Micro |
| CPU | 1/8 OCPU baseline, burstable |
| Physical RAM | 1 GB |
| Boot volume | 180 GB |
| Architecture | x86-64 / AMD |
| Operating system | Oracle Linux or Ubuntu |
| Deployment | Docker Compose |
| Image storage | Local persistent VM filesystem |
| Users | Two initially |

Assume very limited RAM and CPU performance.

The application must run acceptably on this machine without requiring upgrades or paid external services.

Avoid resource-heavy infrastructure such as Kubernetes, Elasticsearch, Redis, Kafka, or heavyweight image-processing systems.

Prefer a small number of lightweight containers.

Do not use cloud object storage by default.

Do not store original image binaries inside the relational database.

Support deployment over HTTP for initial local/private verification, while providing a straightforward HTTPS production configuration.

No hard-coded domain names, IP addresses, usernames, passwords, or absolute machine-specific paths.

---

# 3. Core User Experience

The application must be a responsive, installable Progressive Web App (PWA), accessible through a phone browser and desktop browser.

The two users should have separate accounts but see the same shared memories.

The main navigation should include:

- Home
- Memories
- Albums
- Our Studio
- Favorites
- Settings

On mobile, prefer a minimal bottom navigation bar and use secondary menus for less frequent actions.

On desktop, use a responsive sidebar or similarly intuitive layout.

Avoid unnecessary navigation levels.

## 3.1 Home Page

The home screen is a personalized dashboard.

Possible components:

- Welcome message.
- A featured memory.
- Recently uploaded photographs.
- Recently created albums.
- Pending Studio drafts.
- Drafts ready for joint review.
- On This Day memories.
- Quick upload button.
- Continue where we left off.

The layout must be visually clean and not overcrowded.

If the library is empty, display a beautiful onboarding state instead of blank cards.

## 3.2 Shared Memories

This is the core photo gallery.

Required features:

- Responsive photo grid.
- Masonry-style gallery where appropriate.
- Chronological sorting.
- Infinite scrolling using cursor-based pagination.
- Year and month grouping.
- Albums.
- Favorites.
- Full-screen photo viewer.
- Swipe navigation on mobile.
- Keyboard navigation on desktop.
- Zoom and pan.
- Download original.
- Multiple selection.
- Bulk album assignment.
- Bulk download where reasonably practical.
- Delete and restore operations.
- Photo details panel.
- Original image dimensions.
- Capture date.
- Upload date.
- File size.
- Camera and lens information, when available.
- Location information, when available and permitted.
- Add to Studio.
- Search and filtering.

The gallery must render optimized thumbnails, never load hundreds of original-resolution images simultaneously.

Use appropriate lazy loading, responsive image sizes, and virtualization if needed.

A user should be able to browse thousands of images without significant memory growth or sluggishness.

## 3.3 Albums

Albums should organize memories without duplicating the underlying files.

Examples:

- Birthdays
- Weekend Trips
- College Memories
- Random Dates
- Celebrations
- Vacations

Features:

- Create album.
- Rename album.
- Description.
- Select cover photograph.
- Add and remove photographs.
- Multi-select photographs.
- Album sorting.
- Album photo counts.
- Delete album without deleting the underlying photographs.
- Optional date or location associated with an album.
- Automatically generated date-based groupings separate from manual albums.

Photos may belong to multiple albums.

The same image file should not be duplicated because it appears in multiple albums.

---

# 4. Image Upload System

This is one of the most important parts of the application.

Both users must be able to upload photographs directly from their phones or computers.

## 4.1 Supported Formats

Support commonly encountered formats:

- JPEG
- PNG
- WebP
- HEIC/HEIF, where conversion tooling supports them.
- AVIF, where supported by the image processing stack.

Support GIF where practical, preserving animation rather than silently converting it into a static original.

Unsupported formats should produce clear errors.

Do not pretend all image formats are supported if the runtime lacks the necessary codecs.

Videos are not part of the initial scope.

## 4.2 Upload Experience

Provide:

- Drag-and-drop uploads on desktop.
- Multiple-file selection.
- Mobile gallery selection.
- Upload queue.
- Per-file progress.
- Overall progress.
- Success/failure indicators.
- Cancel pending uploads.
- Retry failed uploads.
- Clear duplicate warnings.
- Optional album selection.
- Background processing indicators.

Uploads should remain safe if a user loses connectivity.

Implement bounded retries and idempotent upload handling.

For large files or unreliable connections, implement resumable uploads using a lightweight, maintainable protocol if feasible within the VM's resource limits.

Avoid claiming uploads continue when the mobile browser or operating system has suspended the website.

Do not allow unbounded parallel uploads.

Set conservative concurrency limits by default, ideally 1–2 files, configurable through environment variables.

## 4.3 Original Image Preservation

**Never modify or overwrite the uploaded original file.**

Store original files separately from generated thumbnails and previews.

Generated previews can be compressed or converted for browser compatibility.

A download of the original must return the exact original file bytes.

Preserve original filename information in the database, but use secure generated identifiers for physical storage.

Never trust a user-supplied filename as a filesystem path.

Use streaming uploads where possible.

Do not buffer entire high-resolution image files in Node.js memory.

Write uploads into a temporary directory, validate them, then atomically move them to permanent storage where possible.

Clean up failed and abandoned temporary uploads safely.

## 4.4 Duplicate Detection

Compute SHA-256 hashes of original files.

When an identical file already exists:

- Detect the duplicate.
- Avoid storing the binary twice.
- Allow the user to reference the existing photograph in additional albums.
- Provide an understandable UI message.

Hashing should be streamed.

Do not treat two visually similar but byte-different images as guaranteed duplicates.

Perceptual duplicate detection may be considered as a later enhancement.

---

# 5. Image Metadata Extraction

Metadata extraction is a major functional requirement, not an optional enhancement.

Read image metadata when photographs are uploaded.

Use a well-maintained metadata extraction library or ExifTool, depending on runtime reliability and resource constraints.

Extract supported fields where present.

## 5.1 Required Metadata Fields

### File information
- Original filename.
- MIME type.
- Detected file type.
- File size.
- Width.
- Height.
- Aspect ratio.
- SHA-256 checksum.
- Upload timestamp.

### Capture information
- EXIF DateTimeOriginal.
- DateTimeDigitized where appropriate.
- EXIF timezone offset if present.
- Subsecond timestamp where present.
- Camera manufacturer.
- Camera model.
- Lens model.
- Focal length.
- Aperture.
- Shutter speed.
- ISO.
- Flash information.
- Orientation.

### Location information
- GPS latitude.
- GPS longitude.
- GPS altitude where present.
- GPS timestamp where present.
- Optional human-readable location if reliably available.

Do not rely on a paid reverse-geocoding API.

Do not automatically send private GPS coordinates to third-party services.

Human-readable location lookup should be optional and privacy-preserving.

### Other metadata
- Color profile.
- Software information.
- Original orientation.
- Relevant image description fields where available.

Store useful normalized metadata in PostgreSQL.

Store additional supported metadata as structured JSONB when appropriate.

Treat extracted metadata as untrusted data.

## 5.2 Capture Date Resolution

Photographs should normally appear according to the time they were taken, not the time they were uploaded.

Use a documented date-resolution strategy:

1. Prefer valid original capture timestamps.
2. Interpret and retain explicit EXIF timezone offsets.
3. If timezone information is missing, preserve the original local wall-clock capture time without inventing a UTC offset.
4. Fall back to other reliable embedded capture timestamps.
5. Use filesystem timestamps only when their provenance is reliable.
6. Otherwise fall back to upload time, clearly marking it as a fallback.

Users must be able to correct an inaccurate photo date without modifying the original file.

Keep the original extracted metadata unchanged for auditability.

## 5.3 Orientation and HEIC

Respect EXIF orientation.

Photos captured in portrait mode must appear correctly oriented.

Support HEIC uploads from iPhones while storing the original HEIC file.

Generate browser-compatible JPEG/WebP previews when supported.

Handle Live Photo image components gracefully, but do not promise full Live Photo playback unless the associated video component is explicitly implemented.

## 5.4 Metadata UI

The photo detail page should present metadata beautifully.

For example:

Taken: 24 December 2025, 6:42 PM

Camera: Apple iPhone

Resolution: 4032 × 3024

Size: 4.8 MB

Location: Coordinates available

Do not display empty rows for metadata that does not exist.

GPS information should be hidden by default in general views and shown only to authenticated users through an intentional details interaction.

Strip sensitive metadata such as GPS from derived images that may be shared or exported publicly, while preserving the original file.

---

# 6. Our Studio — Collaborative Instagram Post Planning

This is the product's defining feature.

Our Studio should not simply be a folder named "Instagram."

It must be a thoughtfully designed collaborative planning experience.

## 6.1 Draft Creation

Either user can create an Instagram post draft.

Each draft contains:

- Title.
- Description or optional notes.
- Creator.
- Creation timestamp.
- Selected photographs.
- Photograph order.
- Caption drafts.
- Song ideas.
- User suggestions and comments.
- Approval states.
- Draft status.
- Last edited timestamp.

Initial supported post type:

**Instagram carousel post.**

Do not build reels or video editing initially.

## 6.2 Draft Statuses

Use a clear workflow:

1. Collecting
2. Ready to Curate
3. Final Review
4. Ready to Post
5. Posted
6. Archived

Statuses must have well-defined behavior.

Users should be able to reopen a draft when appropriate.

Avoid destructive or irreversible operations without confirmation.

## 6.3 Asynchronous Shortlisting

Either user can browse photographs and select "Add to Our Studio."

They may add photographs to an existing draft or create a new draft.

Both users can independently:

- Shortlist photographs.
- Suggest additional photographs.
- Mark their favorites.
- Write comments.
- Suggest captions.
- Suggest songs.
- Remove their own suggestions where appropriate.

Distinguish between suggested photographs and photographs accepted into the final ordered carousel.

This separation is essential.

A suggestion should not silently overwrite the other person's final arrangement.

## 6.4 Collaborative Curation

Provide an elegant carousel-building interface.

Features:

- Photo selection panel.
- Selected photo tray.
- Drag-and-drop ordering.
- Touch-friendly reordering on mobile.
- Cover photo selection.
- Remove photo from draft.
- Preview Instagram carousel.
- Compare candidates.
- Comments on individual photographs.
- Caption editor.
- Song suggestion field.
- Unsaved-change indicators where needed.

The preview should use Instagram-compatible aspect ratio choices.

Preserve the originals; never crop them destructively.

When generating export images, provide explicit fit/crop options and previews.

Validate carousel image count against current Instagram limits and make the limit configurable instead of hard-coding an outdated assumption.

## 6.5 Shared Approval

Both users should explicitly approve a draft before it becomes Ready to Post.

If either user makes a material change to the finalized selection, order, or caption, approvals must be invalidated according to documented rules.

Store approval identity and timestamp.

Both users should clearly see the other's status.

The purpose is to preserve the shared creation experience.

Do not introduce pressure-based reminders that make the process feel like work.

## 6.6 Caption Editor

Support:

- Multiple caption drafts.
- Manual editing.
- Save draft.
- Copy caption.
- Hashtag suggestions entered manually.
- Emoji support.
- Comments.
- Character count where useful.

Do not require paid AI services.

AI-generated captions are not an MVP requirement.

## 6.7 Songs

Support:

- Song title.
- Artist.
- Optional external music link.
- Notes explaining why the song fits.

Do not download, host, or redistribute copyrighted music.

Songs are suggestions for manually selecting music inside Instagram.

## 6.8 Export for Instagram

When a post is finalized, users can:

- Download ordered carousel images.
- Download a ZIP package with numbered image files.
- Copy final caption.
- Copy hashtags.
- See selected song information.
- Mark the post as posted.
- Record the Instagram post URL, optionally.

Number files sequentially to preserve ordering.

Generate Instagram-compatible exports without altering originals.

Do not require Instagram API authentication.

Do not implement automatic Instagram posting in the initial version.

The final actual publishing process should remain manual.

---

# 7. Additional Personal Features

Implement these only after the core system is stable.

## 7.1 Favorites

Each user can independently favorite photos.

Provide:

- My Favorites.
- Favorites by Both.
- Favorites by Partner.

A favorite should not duplicate an image.

## 7.2 On This Day

Show relevant memories captured on the same month and day in previous years.

Do not create an empty or misleading card when no memories exist.

## 7.3 Photo Comments

Allow users to attach short comments to individual photographs.

Comments should be displayed naturally within the photo detail interface.

## 7.4 Featured Memories

Optionally select photographs to feature on the home page.

## 7.5 New for You

Show recently uploaded photographs that the other user has not yet viewed.

Avoid implementing invasive activity tracking.

## 7.6 Trash and Restore

Deleted images should initially be moved into a soft-delete state.

Implement a configurable retention window, preferably 30 days.

Deleting an album should never delete its underlying photos.

Provide safe permanent deletion with confirmation.

The retention system should use background cleanup and accurately reflect files freed from storage.

---

# 8. Authentication and Privacy

This is a private two-person application.

Security is a fundamental requirement.

## 8.1 Account Model

Support exactly two regular users initially.

Provide a secure first-run setup flow.

The first account becomes the owner.

The owner can generate a one-time invitation link for the second account.

Disable public registration.

Invitation links must be sufficiently random, time-limited, stored hashed where appropriate, and single-use.

After both accounts exist, no additional regular accounts may register unless the owner explicitly enables a supported account replacement or invitation flow.

## 8.2 Authentication

Implement robust password-based authentication using:

- Argon2id password hashing.
- Secure HTTP-only cookies.
- SameSite cookie restrictions.
- CSRF protection wherever necessary.
- Session expiration.
- Login rate limiting.
- Session revocation.
- Secure logout.

Never store credentials in browser localStorage.

Do not generate predictable default passwords.

Provide password reset or account recovery without depending on a paid email provider.

For a private deployment, owner-controlled recovery through a documented CLI command is acceptable.

Protect recovery actions from unauthorized remote access.

## 8.3 Authorization

All photo, album, draft, and metadata endpoints must require authorization.

No unauthenticated direct filesystem links.

Do not expose original images as public static assets.

Use authenticated streaming endpoints or short-lived authorized access mechanisms.

Prevent IDOR vulnerabilities.

Prevent path traversal.

Prevent unauthorized access to deleted resources.

## 8.4 Metadata Privacy

GPS coordinates and potentially sensitive EXIF data should never be exposed publicly.

All exports should have clear metadata-preservation rules.

Normal Instagram exports should remove private GPS metadata.

Original downloads should retain the exact original bytes.

## 8.5 Upload Security

Validate:

- Actual file signatures.
- Allowed formats.
- Maximum individual file size.
- Authentication.
- Content boundaries.
- Filename safety.
- Decompression limits.
- Image decoder errors.

Do not rely only on MIME type supplied by the browser.

Ensure malformed files do not crash the application.

Apply timeouts and resource limits to metadata and image-processing subprocesses.

---

# 9. Modern UI and UX Requirements

The interface must be exceptionally polished.

Do not create a generic admin dashboard.

## 9.1 Visual Direction

Design aesthetic:

- Modern.
- Minimal.
- Warm.
- Personal.
- Editorial.
- Subtle romantic personality.
- Photography-first.
- High-quality typography.
- Responsive whitespace.
- Thoughtful animations.

Suggested palette:

- Warm off-white.
- Soft charcoal.
- Muted rose or terracotta accent.
- Warm gray.
- Subtle beige surfaces.

Support dark mode.

Avoid:

- Excessive gradients.
- Bright saturated backgrounds.
- Glassmorphism everywhere.
- Generic stock photographs.
- Decorative clutter.
- Overly rounded oversized components.
- Emoji-heavy interfaces.
- Complicated enterprise-style tables.

## 9.2 Preferred Frontend Stack

Use:

- React.
- TypeScript.
- Vite.
- Tailwind CSS.
- Accessible reusable UI components, optionally shadcn/ui or Radix primitives.
- TanStack Query for server state.
- React Router where appropriate.
- React Hook Form and Zod for forms.
- A maintained drag-and-drop solution suitable for desktop and touch.

Do not add libraries without purpose.

The frontend must be compiled into static production assets and served efficiently by the reverse proxy.

Do not run a resource-heavy frontend development server in production.

## 9.3 Essential UI Screens

Build complete, responsive versions of:

1. First-run setup.
2. Login.
3. Home dashboard.
4. Main photo library.
5. Album list.
6. Album detail.
7. Full-screen photo viewer.
8. Photo metadata panel.
9. Favorites.
10. Upload manager.
11. Studio drafts list.
12. Studio draft editor.
13. Carousel preview.
14. Export screen.
15. Trash.
16. Account settings.
17. Storage and system status.

Include polished empty states, loading states, error states, skeletons, confirmations, and useful feedback.

## 9.4 Mobile Experience

Mobile usability is crucial because most photographs will be uploaded and viewed from phones.

Required:

- Thumb-friendly controls.
- Responsive bottom navigation.
- Touch gestures.
- Swipe photo navigation.
- Touch drag-and-drop.
- Correct handling of mobile safe areas.
- Avoid horizontal overflow.
- Accessible tap targets.
- Efficient images.
- Fast initial load.
- PWA installability.

Support modern Chrome, Safari, Firefox, and Edge where practical.

Test iOS Safari upload and HEIC-related flows to the extent the test environment allows.

---

# 10. Backend Architecture

Preferred stack:

- Node.js LTS.
- TypeScript.
- Fastify, or another similarly lightweight and well-supported HTTP framework.
- PostgreSQL.
- Prisma or Drizzle ORM, choosing a stable approach with reliable migrations.
- Zod for validation.
- A lightweight background job mechanism.
- Sharp/libvips or similarly efficient image tooling.
- ExifTool or equivalent for metadata extraction.
- Nginx or Caddy as reverse proxy.

Use a monorepo if appropriate, but keep the structure understandable.

Example:

```text
ours/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   └── shared/
├── infrastructure/
│   ├── docker/
│   └── scripts/
├── docs/
├── tests/
├── compose.yaml
├── compose.dev.yaml
├── .env.example
├── .gitignore
└── README.md
```

You may improve this structure if necessary.

## 10.1 Background Processing

Image processing must not block request handling.

Use a lightweight, database-backed job queue rather than introducing Redis.

Jobs include:

- Metadata extraction.
- Thumbnail generation.
- Preview generation.
- Storage cleanup.
- ZIP export preparation.
- Optional backup-related maintenance.

Implement bounded concurrency.

For the E2 Micro, processing one image at a time is an acceptable default.

Job states should include pending, processing, completed, failed, and retrying.

Support crash recovery and stale-job handling.

Avoid busy polling.

Preserve failed-job diagnostics without exposing sensitive file information to users.

## 10.2 Image Pipeline

Recommended flow:

```text
Authenticated upload
        |
        v
Stream to temporary file
        |
        v
Validate actual file type
        |
        v
Compute SHA-256 checksum
        |
        v
Check duplicate
        |
        v
Atomically store original
        |
        v
Create DB record and processing job
        |
        v
Extract EXIF metadata
        |
        v
Generate thumbnails and previews
        |
        v
Mark photo ready
        |
        v
Display in shared gallery
```

Design for safe recovery if the process crashes between filesystem and database operations.

Thumbnails should include a small gallery version and a larger viewer preview.

Avoid unnecessary resolutions.

Do not decode or resize multiple enormous images simultaneously.

## 10.3 PostgreSQL Data Model

Design normalized tables for at least:

- users
- sessions
- invitations
- photos
- photo_metadata
- albums
- album_photos
- favorites
- photo_comments
- studio_drafts
- studio_draft_photos
- studio_photo_suggestions
- draft_comments
- caption_versions
- song_suggestions
- draft_approvals
- upload_sessions
- processing_jobs
- export_jobs
- application_settings
- audit_events

Add only necessary tables and fields.

Use foreign keys, uniqueness constraints, useful indexes, timestamps, and transactions appropriately.

Ensure the data model supports two users editing the same draft.

Use optimistic concurrency control or an equivalent conflict mechanism for destructive ordering/editing operations.

Do not silently lose edits.

Real-time WebSockets are optional for MVP.

Reliable autosave, polling, and clear stale-data conflict handling are sufficient.

---

# 11. Performance and Memory Optimization

The production server has only 1 GB physical RAM.

Design with this limitation from the beginning.

## 11.1 Application Performance

- Use multi-stage Docker builds.
- Keep production images small.
- Install production dependencies only.
- Avoid expensive runtime compilation.
- Serve a prebuilt frontend.
- Use lightweight database connection pooling.
- Restrict image processing concurrency.
- Avoid unbounded in-memory caches.
- Stream uploads and downloads.
- Stream ZIP exports or use disk-backed temporary files.
- Use database pagination.
- Enforce upload limits.
- Bound request and subprocess concurrency.

Do not spawn a separate Node.js process for every image-processing task.

## 11.2 Memory Budget

Create a realistic documented RAM budget for:

- Operating system.
- Database.
- API.
- Reverse proxy.
- Image processor.
- Other necessary services.

Do not assume swap behaves like RAM.

The application should remain functional without requiring 30 GB of swap.

A 2–4 GB swap file may be recommended as an operational safety measure, but do not automatically manipulate host swap from inside application containers.

Expose tunable limits through environment variables.

## 11.3 Storage Management

The VM has a 180 GB boot volume.

Allow configurable storage directories.

A recommended arrangement:

```text
/srv/ours/
├── originals/
├── thumbnails/
├── previews/
├── temporary/
└── exports/
```

Keep PostgreSQL data on a persistent Docker volume.

Provide storage reporting:

- Total filesystem capacity.
- Available storage.
- Original photo storage.
- Thumbnails and previews.
- Temporary files.
- Pending export files.
- Database usage where measurable.

Do not assume the entire 180 GB is available to the application.

Implement low-disk-space warnings and reject new uploads safely when insufficient storage remains.

Use temporary cleanup policies.

Do not delete original photos automatically to recover storage.

---

# 12. Docker and Deployment — Critical Requirement

The entire project must be Dockerized.

The finished application must support:

```bash
git clone <repository-url>
cd ours
docker compose up -d --build
```

And then be accessible through the configured host port.

Do not require manual database schema creation.

Do not require manually running migrations.

Do not require manually creating application folders.

Do not require manually installing Node.js, PostgreSQL, or image-processing packages on the VM.

Only Docker Engine and Docker Compose should be required on the host.

## 12.1 Docker Compose Services

Prefer a minimal production topology:

1. Reverse proxy serving static frontend and forwarding API requests.
2. API and bounded background worker, combined if that reduces RAM safely.
3. PostgreSQL.

Additional services require a clear justification.

Use persistent volumes for all data.

Use health checks.

Use restart policies.

Use internal Docker networking.

Do not publish the PostgreSQL port to the public host.

## 12.2 Automatic Initialization

Implement a safe first-run bootstrap mechanism.

On first startup:

1. Validate non-secret configuration.
2. Generate required application secrets securely when absent.
3. Persist generated secrets in a protected local configuration location.
4. Create storage directories.
5. Set correct permissions.
6. Start PostgreSQL.
7. Wait for database readiness.
8. Run migrations automatically.
9. Initialize application settings.
10. Start the API and background worker.
11. Start the reverse proxy.
12. Present the authenticated first-run account setup page.

The bootstrap process must be idempotent.

Restarting containers must not regenerate secrets, delete files, reset users, or overwrite database data.

Handle partially completed initialization safely.

For the first-run owner setup, implement a secure claim mechanism using a one-time setup token written to protected host-local configuration or displayed only through a deliberate local administrative command.

Do not expose an indefinitely open public owner-registration endpoint.

If a production HTTPS certificate requires a domain and working DNS, document this honestly.

Do not fake HTTPS readiness or ship an insecure public default.

Provide a working private/local HTTP mode and a straightforward HTTPS mode.

## 12.3 Environment Configuration

Provide a complete `.env.example`.

Use sensible defaults where safe.

Any generated database credentials and session secrets must be strong and persisted.

No production secrets should be committed into Git.

Provide clear configuration for:

- Application URL.
- Host binding.
- Exposed port.
- Storage path.
- Database credentials or bootstrap-generated credentials.
- Session settings.
- Upload size.
- Image processing concurrency.
- Storage thresholds.
- Public HTTPS configuration.

Use a production-grade secrets initialization approach that is compatible with one-command Docker Compose startup.

## 12.4 Container Security

- Prefer non-root containers.
- Apply least privilege.
- Use read-only mounts where possible.
- Avoid privileged containers.
- Avoid mounting the Docker socket.
- Restrict exposed ports.
- Apply bounded logging and log rotation.
- Add resource constraints where appropriate.
- Handle graceful shutdown.
- Support automatic restarts.

Do not rely on unspecified Docker Compose behaviors.

Document supported Compose versions.

## 12.5 Data Persistence

All user data must survive:

```bash
docker compose down
docker compose up -d
docker compose pull
docker compose up -d
```

Never store irreplaceable images in writable container layers.

Provide documentation warning that:

```bash
docker compose down -v
```

may delete Docker-managed data volumes.

Ensure migrations are safe across application upgrades.

## 12.6 Backup and Recovery

Implement an operationally sound backup strategy.

At minimum, provide scripts that can:

- Export PostgreSQL backups.
- Back up original files.
- Preserve necessary configuration and secrets.
- Restore the application to a fresh deployment.
- Verify backup integrity.

Backups must be consistent enough to restore database references and image files together.

Do not assume that a backup stored on the same VM protects against VM loss.

Document how to copy encrypted backups to a separate machine or external storage.

Provide an example scheduling mechanism without enabling destructive or costly operations by default.

Include a real backup-and-restore test.

---

# 13. API Requirements

Create well-structured REST endpoints with consistent response formats.

Areas:

- Authentication.
- Invitations.
- Users.
- Photos.
- Upload sessions.
- Albums.
- Favorites.
- Comments.
- Studio drafts.
- Suggestions.
- Captions.
- Approvals.
- Exports.
- Storage status.
- Application settings.

Use consistent:

- HTTP status codes.
- Validation errors.
- Pagination.
- Authorization.
- Idempotency handling where required.
- Rate limits.
- Structured logging.
- Request IDs.

Generate OpenAPI documentation or a similarly maintainable API specification.

Disable or protect sensitive API documentation appropriately in production.

---

# 14. Edge Cases

Explicitly design and test behavior for:

- Two users uploading the same image simultaneously.
- Upload interrupted midway.
- Browser closed during upload.
- Corrupted JPEG.
- Invalid HEIC.
- Large high-resolution photograph.
- Photograph without metadata.
- Photograph with inaccurate EXIF date.
- Incorrect EXIF orientation.
- GPS metadata absent.
- GPS metadata present.
- Identical images with different filenames.
- Same image added to multiple albums.
- Deleted album containing shared photographs.
- Photo deleted while referenced in a Studio draft.
- Concurrent draft editing.
- Approval invalidated by edits.
- Disk nearly full.
- Database temporarily unavailable.
- Container restart during processing.
- VM reboot.
- Background job failure.
- Browser refreshing during draft editing.
- Phone losing connectivity.
- Expired sessions.
- Invalid invitation links.
- Download of a deleted or unauthorized photo.
- Failed export generation.
- A user attempting to access private media without authentication.

The application must handle failures gracefully.

No silent data loss.

---

# 15. Testing and Quality Assurance

Do not stop at writing code.

Actually execute tests and inspect failures.

Required testing:

## 15.1 Unit Tests
Test:

- Metadata date resolution.
- File validation.
- Duplicate detection.
- Photo ordering.
- Approval invalidation.
- Storage path safety.
- Authorization helpers.
- Upload state transitions.

## 15.2 Integration Tests
Test:

- Authentication flows.
- Secure setup and invitation.
- Upload to filesystem.
- Database persistence.
- Metadata extraction.
- Thumbnail generation.
- Album management.
- Studio draft creation.
- Draft approval.
- ZIP export.
- Soft delete and restore.

## 15.3 Browser E2E Tests
Use Playwright or a suitable equivalent.

Test:

- First-run owner setup.
- Second-user invitation and registration.
- Login.
- Photo upload.
- Gallery browsing.
- Album creation.
- Photo viewing.
- Studio shortlisting.
- Photo reordering.
- Both users approving a draft.
- Export flow.

## 15.4 Deployment Tests

Build and run the complete stack:

```bash
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

Verify health checks.

Inspect logs.

Test restart persistence.

Verify that database migrations run on a fresh deployment.

Verify that user files persist after rebuilding containers.

Run backup/restore tests.

## 15.5 Security Tests

Test authentication boundaries, unauthorized photo access, invalid file types, path traversal attempts, malicious filenames, oversized uploads, login rate limits, CSRF protection, session handling, and malicious metadata.

Do not claim independent security certification.

## 15.6 Resource Testing

Where possible, test the application using realistic 1 GB RAM constraints.

Run sample uploads and thumbnail generation while the database and API are active.

Measure peak memory consumption.

If something fails under realistic resource limits, fix the issue or clearly document the unresolved limitation.

---

# 16. Documentation

Deliver:

### README.md
- Product overview.
- Screenshots or UI examples.
- Architecture overview.
- Prerequisites.
- Quick-start deployment.
- First-run setup.
- Login/invitation instructions.
- HTTPS configuration.
- Update instructions.
- Backup instructions.
- Restore instructions.
- Troubleshooting.

### ARCHITECTURE.md
- Major components.
- Database structure.
- Storage layout.
- Upload pipeline.
- Metadata pipeline.
- Image processing.
- Security model.
- Resource considerations.

### DEPLOYMENT.md
- Oracle Cloud E2 Micro deployment.
- Docker installation prerequisites.
- Firewall/networking guidance.
- Volume management.
- Docker commands.
- TLS configuration.
- Backup and disaster recovery.
- Upgrade strategy.

### API Documentation
Maintain an API reference.

### .env.example
Document every environment variable.

Do not leave undocumented production configuration requirements.

---

# 17. Implementation Workflow

Follow this process without requiring routine approvals.

## Phase 1 — Repository and Architecture

Inspect the repository.

If empty, initialize the project.

Create an architecture and implementation plan.

Choose dependency versions based on compatibility and stability.

Explain major architectural decisions in documentation.

## Phase 2 — Backend Foundation

Implement:

- Database schema.
- Migrations.
- Authentication.
- Authorization.
- Secure initialization.
- Media storage.
- Photo metadata extraction.
- Image processing.
- Albums.
- Search.
- Favorites.

## Phase 3 — Frontend Foundation

Implement the design system and all major screens.

Ensure responsive behavior.

Integrate with real backend APIs, not mock endpoints.

## Phase 4 — Collaborative Studio

Implement:

- Draft creation.
- Shortlisting.
- Suggestions.
- Ordering.
- Caption editing.
- Song suggestions.
- Comments.
- Approval workflow.
- Export.

## Phase 5 — Production Deployment

Implement Dockerfiles, Docker Compose, initialization, reverse proxy, health checks, persistent volumes, and deployment scripts.

## Phase 6 — Testing and Optimization

Execute automated tests.

Fix defects.

Review the UI across screen sizes.

Optimize memory.

Test deployment from a clean state.

Test restarts and data persistence.

## Phase 7 — Final Verification

Do not report completion until the application has been built and exercised.

If your execution environment prevents Docker from running, clearly distinguish static verification from successful runtime testing.

Do not fabricate test results.

---

# 18. Definition of Done

The application is complete when:

- [ ] Fresh Docker Compose deployment initializes successfully.
- [ ] Secure owner setup works.
- [ ] Second user can join with an invitation.
- [ ] Both users can log in independently.
- [ ] Both users can upload photographs.
- [ ] Original quality is preserved.
- [ ] Image metadata is extracted and visible.
- [ ] Images display correctly with proper orientation.
- [ ] HEIC upload and preview work for supported images.
- [ ] Duplicate detection works.
- [ ] Albums work.
- [ ] Gallery pagination works with large libraries.
- [ ] Favorites work.
- [ ] Photo downloads work securely.
- [ ] Both users can create and edit Studio drafts.
- [ ] Photo shortlisting works.
- [ ] Carousel ordering works on mobile and desktop.
- [ ] Caption and song suggestions work.
- [ ] Both users can approve drafts.
- [ ] Material changes invalidate approvals properly.
- [ ] Instagram export works.
- [ ] No media is exposed publicly without authorization.
- [ ] Persistent storage survives restarts.
- [ ] Backups and restoration have been tested.
- [ ] Docker services have health checks.
- [ ] The application works under realistic VM memory limits.
- [ ] README and deployment documentation are complete.
- [ ] There are no known critical security or data-loss defects.

Do not leave placeholders, TODO-only features, simulated API implementations, hard-coded sample users, or fake functionality in the production application.

Where a secondary feature is genuinely infeasible, document its limitation clearly rather than claiming it works.

---

# 19. Final Deliverables

Deliver a complete, maintainable repository.

At completion, provide:

1. A concise architecture summary.
2. The complete repository structure.
3. The exact commands needed to deploy to Oracle Cloud.
4. Any unavoidable external setup requirements.
5. First-run setup instructions.
6. How to invite the second user.
7. How to back up and restore the application.
8. How to update the deployment.
9. Tests actually executed and their results.
10. Known limitations, if any.

The desired deployment experience is:

```bash
git clone <repository-url>
cd ours
docker compose up -d --build
```

Then open the server address, securely claim the initial owner account, invite the second user, and begin uploading photographs.

The user should never need to inspect or modify application source code to complete deployment.

**Most importantly: Build something that feels like our own private space for memories, not a generic Google Photos clone. Make the gallery delightful, the Studio collaborative, and the overall system dependable enough to trust with irreplaceable photographs.**

Proceed with implementation now. Do not stop after drafting a plan.