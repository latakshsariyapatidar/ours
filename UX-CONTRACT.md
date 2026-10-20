# Ours interaction contract
Business authority: PERSONAL-DIRECTION.md (latest explicit user request), then PRODUCT.md for unchanged capabilities. Backend invariants are in server/routes.js and server/schema.sql.

## Canonical UI Map
| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Table Selection | Gallery selected IDs | current page only | checkbox | E2E |
| Select/Listbox | native select | platform popup | native | E2E |
| Date | Field | local capture wall clock | native | integration |
| Form | Form and Field | server Zod schema | create/edit | E2E |
| Scrollbar | styles.css | DESIGN.md | global | browser |
| Toast | Feedback | live status | success/error | E2E |
| CRUD | api and Query client | server REST | pessimistic | integration |

## Navigation and state
React Router owns list/detail navigation. Search is URL-based, explicit submit with clear; only submitted queries reach server. Native dialog owns focus trap, inert backdrop, Escape and focus restoration. Destructive actions use named confirmation. Empty screens include next action. Fetch failure includes retry; writes preserve values. Loading and images reserve geometry.

## Async and recovery
Pessimistic mutations, disabled submit while pending. Studio edits retain local state until saved; version conflicts preserve the editor and require reload/reconciliation. Warn on unload with unsaved edits. Uploads are serialized, chunked, retryable, and resumable while the page lives. Browser closure requires reselecting files; bytes already acknowledged stay server-side for 24 hours. Sessions and private content are never cached in localStorage or service worker. Theme preference alone may persist.

## Security and lifecycle
Two accounts, owner token and hashed invitation. Both users share media. GPS only inside intentional details. Soft deletion offers restore; permanent deletion requires confirmation. Photo deletion advances affected draft versions, invalidating stale downloads. Either user may download a saved nonempty carousel with ready, undeleted photos. No approval or review gate, and no songs in the app, API, or newly generated ZIPs. Existing legacy tables remain intact during upgrade to preserve data. Caption, ordering, notes and conflict protection remain. Posted is an optional marker, not a prerequisite to download. Size and borders are native selects in the download dialog. Settings shows names and storage; invitation is shown only when the second account is absent. The password-change form and deployment advice are removed as requested, while recovery/security endpoints remain. English copy; dates preserve capture wall time, locale display en-IN. WCAG AA target, 44px targets, keyboard alternative to drag ordering, reduced motion.

## Verification
Unit, integration and browser tests in tests/. Desktop and 390px mobile, light/dark, empty and failure states. Report actual execution in TESTING.md.
