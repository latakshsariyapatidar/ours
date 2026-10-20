---
version: alpha
colors:
  primary: '#73578f'
  background: '#f6f4fa'
  surface: '#ffffff'
  text: '#302b3b'
  muted: '#706779'
  border: '#ddd6e7'
typography:
  display:
    fontFamily: 'Georgia, serif'
  body:
    fontFamily: 'Arial, sans-serif'
rounded:
  control: '8px'
spacing:
  unit: '8px'
---
# Ours design
## Overview
A private photo album for Puppy and Bear, with existing account names and their own photos. Follow PERSONAL-DIRECTION.md, which supersedes the original promotional copy and formal Studio workflow. Photography and their own words carry the personality. No slogans, sales pitch, generic romance, or explanations of why the product is special. Preserve the existing personal dedication in the sidebar. English interface, mobile first.
## Colors
Lavender, pale lilac and ink replace the former beige and rose scheme at the user's request. Runtime ownership: src/styles.css semantic variables are canonical; frontmatter mirrors light values. Dark mode: background #191822, surface #22212e, text #efedf6, muted #b5afc6, border #3b374d, soft #2e2a3b, primary #c5afe6, on-primary #241d31. Light soft is #ebe5f3 and on-primary is white. Dark remains the initial theme and saved preference is respected. Page, Button, Field, Modal, gallery and sidebar consume the same semantic variables. PWA theme colour and icons mirror the dark palette.
## Typography
Georgia headings and Arial/system body use local fonts. Headings name the page or show the user's own title. No decorative uppercase eyebrows. Preserve actual user-authored descriptions and notes.
## Layout
Desktop: existing sidebar and photo-led journal. Mobile: five-item bottom navigation with settings in the header. Gallery uses bounded pages with content visibility, 2–5 columns. Studio shows selected photos and notes beside caption/comments. Sizing belongs inside the download dialog, not a permanent planning card. Forms use native selects and date inputs, accepting platform-owned popups.
## Elevation & Depth
Flat panels, borders, and restrained dialog shadows. Photos have reserved aspect-ratio boxes.
## Shapes
8px controls, 16px cards, generous open page space. No pill-shaped dashboard tiles.
## Components
Shared Field, ActionForm, NoteField, Modal, Empty, Notice and Page own repeated behavior. Page has no default eyebrow or subtitle. Empty and error states give concise useful instructions. Global scrollbars use muted/border tokens. Motion honors reduced motion.
## Do's and Don'ts
Use short, ordinary labels: Photos, Caption, Notes, Save changes. Their own captions, albums, names and notes make it personal. Do not replace removed slogans with new slogans. No songs, approvals, forced review stages, marketing cards, or deployment guidance inside the app. Account/password endpoints remain available for security and recovery, while the requested password form is removed from Settings.
