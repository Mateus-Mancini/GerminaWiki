# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Current students of Germinare (Instituto J&F) who write and read study material for their school subjects: class notes, summaries and exam tips, organised by year and subject (matéria). Reading happens far more often than writing. A minority of members are admins, who can answer comments. Use happens on school and home desktop computers, often shared machines, and pages are sometimes shown on a projector in class.

## Product Purpose

A shared, student-written wiki of the school's subjects. Students find a subject's page, read it like an encyclopedia article, follow links between related pages, comment on specific passages and improve the page themselves. Success means students review from it before classes and exams, and keep it current by editing rather than starting new documents.

## Positioning

Written by the students who take the subjects, for the students who come next, inside the school's own structure of years and subjects. It is neither a generic notes app nor the school's official material.

## Operating Context

- Students sign in with accounts created for them, or through self sign-up; sessions last 15 minutes.
- Pages live in folders: year, then subject, then topic. Content is Markdown, with `[[slug]]` wikilinks between pages, comments anchored to blocks, and images.
- Editing happens in place, in a block editor. Concurrent edits are caught by version checks, and a conflict screen resolves them.
- Shared computers: drafts are cleared on logout. Projector use: pages must stay legible at a distance.

## Capabilities and Constraints

- Static single-page app on Firebase Hosting; data from the GerminaWiki API (Spring Boot on AWS Lambda), which may be cold for a few seconds after idle. Everything must stay at $0 hosting cost.
- Stack: Vite, React 19 and TypeScript. The app shell (Clara) is plain TypeScript rendering HTML strings; the editor (Mancini) is React with BlockNote.
- UI language: Brazilian Portuguese.
- Team-owned areas: shell, sidebar and search (Clara); page view and comments (João Pedro); login/profile (Clara); editor (Mancini). Changes across areas need the owner's review.
- Undecided: per-page edit permissions (any member can edit today); how search filters by group.

## Brand Commitments

- Name: **GerminaWiki**, its own identity as a student project. Germinare and Instituto J&F may be mentioned as context in text only. No school logo, official colours or claims of endorsement.
- Direction set by the team: Notion-like direct editing combined with Wikipedia-like reading (article typography, clear internal links, article structure). It must not look AI-generated or template-like: no decorative gradients, glassmorphism, icon grids or gratuitous animation.

## Evidence on Hand

- Real content is whatever students have written in the production database; there is no seeded curriculum. Do not invent subject content, statistics, testimonials or usage claims.
- Assets: `frontend/public/wiki-globe.svg` (Clara's login art) and `favicon.ico`.

## Product Principles

1. Reading comes first: every page should read like a good encyclopedia article, at a desk and on a projector.
2. Editing is direct and safe: change the page in place, never lose text, never overwrite someone else silently.
3. Pages connect: links, backlinks and anchored comments make the wiki more than a pile of notes.
4. It belongs to the students: honest and plainly worded, with no pretend officialness.

## Accessibility & Inclusion

Keyboard operation and visible focus throughout, and status changes announced to assistive technology (team constitution, principle V). Text must stay legible at projector distance, with generous size and contrast on reading surfaces, and respect `prefers-reduced-motion`.
