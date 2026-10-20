# REST API

Base `/api`, JSON requests/responses except media, upload chunks and ZIP. Errors are `{error, requestId?}` with 400 validation, 401 unauthenticated, 403 permission/CSRF, 404 missing, 409 conflict, 413 oversized chunk, 415 unsupported signature, 429 rate limit and 507 storage reserve. No public API explorer. Every endpoint below except health and auth entry points requires the `ours` HttpOnly cookie. Mutations additionally require `X-CSRF-Token` from the authenticated session state. Exact same-origin browser requests only.

| Method / path | Body or query | Result |
|---|---|---|
| GET /health | — | DB-backed health |
| GET /auth/state | — | setup flag, user+CSRF, name, limit |
| POST /auth/setup | token, name, email, password | owner session, first-run only |
| POST /auth/join | token, name, email, password | invited second session |
| POST /auth/login | email, password | session |
| POST /auth/logout | — | revoke current session |
| POST /auth/password | current, password | update, revoke all own sessions |
| POST /invitations | — | owner-only one-time raw token, 48 hours |
| GET /users | — | shared household names/IDs |
| GET /photos | q, cursor, album, favorite=mine/partner/both, trash=true, new=true, onThisDay=true, date=YYYY-MM-DD | items (48), next cursor |
| GET /moments | — | smart spatio-temporal clusters (moments/outings grouped by date, time window & GPS proximity) |
| GET /photos/:id | — | photo + private metadata + comments, mark viewed |
| PATCH /photos/:id | capture_local?, featured? | normalized correction |
| PUT /photos/:id/favorite | favorite:boolean | idempotent favorite state |
| POST /photos/:id/comments | body | comment |
| DELETE /photos/:id | — | soft delete and invalidate stale draft downloads |
| POST /photos/:id/restore | — | restore |
| DELETE /photos/:id/permanent | — | permanent deletion, Trash only |
| POST /photos/bulk-trash | ids | soft delete multiple photos |
| POST /photos/bulk-restore | ids | restore multiple photos |
| POST /photos/bulk-permanent | ids | permanently delete multiple photos from Trash |
| POST /photos/:id/retry | — | retry failed processing |
| GET /media/:id/original | — | exact private bytes, attachment |
| GET /media/:id/thumbnail | trash=true only for Trash thumbnail | 480px WebP |
| GET /media/:id/preview | — | 1800px JPEG |
| POST /uploads | filename, size | id, offset |
| GET /uploads/:id | — | acknowledged offset/state, creator only |
| PATCH /uploads/:id | raw bytes, Content-Length, Upload-Offset | offset; max 2 MB |
| POST /uploads/:id/complete | — | photoId, duplicate; idempotent |
| DELETE /uploads/:id | — | cancel incomplete upload |
| GET /albums | — | albums, counts, cover_id |
| POST /albums | title, description?, location?, date? | album |
| PATCH /albums/:id | title, description?, location?, date?, cover? | album |
| PUT /albums/:id/photos | ids, remove? | idempotent membership |
| DELETE /albums/:id | — | remove album only |
| GET /drafts | — | drafts, counts, cover |
| POST /drafts | title, notes? | draft |
| GET /drafts/:id | — | all draft components + version |
| PUT /drafts/:id | version, title, notes, caption, hashtags, ratio, fit, photos:ID[], status, post_url | expected-version atomic save |
| POST /drafts/:id/suggestions | ids | distinct from final order |
| DELETE /drafts/:id/suggestions/:photo | — | remove own suggestion |
| POST /drafts/:id/comments | body, photo_id? | note |
| POST /drafts/:id/captions | body | caption idea |
| POST /drafts/:id/exports | — | queued job, reuses active same-version job |
| GET /exports/:id | — | job state |
| GET /exports/:id/download | — | current-version ZIP |
| GET /system | — | storage, jobs, limits |
| PUT /settings | name | owner-only application name |

Capture values are ISO local wall-clock strings. Ratios: `1:1`, `4:5`, `3:4`, `1.91:1`; fit: `contain` or `cover`. Final photo IDs must be unique and under configured limit. IDs are UUIDs. Search applies to original filename; manual human-readable location is album-level. Invitation raw tokens appear only on explicit owner generation, never in stored database values. Invitation URLs use a fragment and remove it from history on the join screen.
