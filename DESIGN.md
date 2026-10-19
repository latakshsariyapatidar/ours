---
version: alpha
colors:
  primary: '#934f55'
  background: '#f7f4ef'
  surface: '#ffffff'
  text: '#302d2a'
  muted: '#756e66'
  border: '#ddd6cc'
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
A private photographic journal for two people. Product register, English interface, mobile first. The signature is a paired-frame empty-library illustration and a quiet editorial photo wall, resembling a personal print collection. Real photographs only; no invented memories, counters, or stock content.
## Colors
Warm paper, charcoal, faded rose. The supplied brief explicitly requests this palette. Runtime ownership: src/styles.css semantic variables are canonical; frontmatter mirrors their light values. Dark mode remaps these same roles. All components consume variables.
## Typography
Georgia display headings evoke handwritten album titles without a script font. Arial/system body stays legible on phones and uses local fonts without remote requests.
## Layout
Desktop: 224px sidebar and spacious journal. Mobile: five-item bottom navigation with settings in header. Gallery uses bounded pages with content visibility, 2–5 columns. Forms use native selects and date inputs, accepting platform-owned popups.
## Elevation & Depth
Flat panels, borders, and restrained dialog shadows. Photos have reserved aspect-ratio boxes.
## Shapes
8px controls, 16px cards, generous open page space. No pill-shaped dashboard tiles.
## Components
Shared Field, Form, Modal, Empty, Feedback and Page components own repeated behavior. Global scrollbars use muted/border tokens. Motion is limited to hover opacity and honors reduced motion.
## Do's and Don'ts
Use plain personal copy. Do not use fake statistics, pressure reminders, gradients, stock photos, or enterprise tables.
