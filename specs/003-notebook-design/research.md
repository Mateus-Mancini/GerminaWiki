# Research: Notebook Design

Decisions behind [plan.md](./plan.md). Each has the decision, why, and what was rejected.

## R1. Typefaces and how they are served

- **Decision**: Libertinus Serif (400, 400 italic, 700) for headwords and article text, and Public Sans (variable weight) for the interface. Both are bundled from Fontsource npm packages into the build, and only their `latin` subsets load up front. Fallbacks: `"Libertinus Serif", "Linux Libertine", Georgia, "Times New Roman", serif` and `"Public Sans", system-ui, "Segoe UI", Roboto, sans-serif`.
- **Why**: Libertinus continues Linux Libertine, the face of Wikipedia's wordmark and serif headings, which gives the "nostalgic Wikipedia" note without copying Wikipedia's interface. Public Sans is a neutral, highly legible government-grade sans that stays out of the way. Self-hosting through the build keeps the app working on school networks that block third-party font hosts, adds no request to another origin, and costs nothing on Firebase Hosting. Measured `latin` woff2 sizes: 23.4 KB (400), 25.2 KB (italic), 23.4 KB (700) and 26.8 KB (Public Sans variable), about 99 KB in total, within SC-007's 150 KB. Portuguese accents are in the `latin` subset (U+00C0–00FF).
- **Rejected**: the Google Fonts CDN, which the current shell uses (a third-party request, blocked on some school networks); Libertinus 600 (700 is enough for the few bold runs); a serif interface (too bookish in menus).

## R2. The ruling and keeping text on it

- **Decision**: one rule unit `--rule` (32px on desktop, 28px below 600px). The sheet draws a 1px pale-blue line at the bottom of every rule band with a repeating linear background, offset so the line sits just under the body text's baseline. Body text uses `line-height: var(--rule)`, and every block's vertical margin is a whole number of rules. Headings use the rule line height: h2 has one empty rule above it, and the headword uses two rules per line. Blocks whose height can't be known from CSS (images, figures, code blocks, tables, embedded HTML) are padded after layout to the next whole rule by a small `snapToRule(root)` helper, driven by a `ResizeObserver` and by image `load` events.
- **Why**: rules that drift away from the text look broken, and fixing text and margin metrics covers paragraphs, lists and quotes with no script. Only blocks with intrinsic heights need measuring, and padding them leaves their content untouched. The baseline offset is measured in Chrome (quickstart §3) rather than guessed from font metrics.
- **Rejected**: CSS `round()` on heights (it can't round an `auto` height); fixed image heights (they distort images); `text-box-trim` and `cap` units (not yet supported in all target browsers).

## R3. Subject colours

- **Decision**: a palette of 8 cardstock colours. A subject's colour is its position among its section's dividers, plus the section's position, modulo 8, computed from folders in their API order. Neighbouring tabs therefore never share a colour, and the result is the same for every student because the API order is stable (by creation). Colours are used for the tab edge, the pulled-out tab, the contents sheet's margin mark and the spiral's shadow, never as a text background.
- **Why**: there is no colour field in the API (out of scope), and hashing folder ids can give two neighbours the same colour.
- **Rejected**: hashing the id (neighbour collisions); storing colours in `localStorage` (different for each student and machine).

## R4. Page-turn and other transitions

- **Decision**: the View Transitions API (`document.startViewTransition`) wraps the shell's `render()` when the visible sheet changes (home ↔ subject ↔ page), with `view-transition-name: sheet` on the sheet. The new sheet slides 24px from the right and fades in over the old one, with a soft shadow on its leading edge, in 240ms `cubic-bezier(0.16, 1, 0.3, 1)`. Without API support, or under `prefers-reduced-motion`, `render()` runs directly (instant). Tab lift is a 2px translate with a 160ms transition. When editing starts, the margin rule draws with a `scaleY` 0→1 over 240ms.
- **Why**: the shell re-renders with `innerHTML`, so a snapshot-based transition is the only way to animate between old and new markup without restructuring Clara's renderer. The API is in Chrome and Edge (the school machines) and in Safari; other browsers simply get no animation.
- **Rejected**: animating with Web Animations by keeping two DOM copies (it would rewrite the shell's rendering); a page-curl effect (too playful, per the owner's "not playful").

## R5. Link previews

- **Decision**: event delegation on the document for `a.wikilink[data-page]`. After 350ms of hover or on keyboard focus, show a small paper card (`role="tooltip"`, linked with `aria-describedby`) with the target page's title and opening text, taken from the page list the shell already holds. It hides on leave, on blur and on Esc. The opening text is the first paragraph of the page's Markdown with syntax removed, at most 180 characters (`excerpt()`, shared with the contents sheet).
- **Why**: the page list already contains every page's content, so previews need no request (FR-016). It is the Wikipedia page-preview nod named in the direction.
- **Rejected**: fetching `/api/pages/{id}` on hover (a Lambda request per hover); native `title` tooltips (unstyled, and not shown on keyboard focus).

## R6. Where the CSS lives, and the shell files

- **Decision**: new `frontend/src/theme/` with `fonts.ts`, `tokens.css` (the token contract), `base.css` (paper, type, controls, dialogs, notices, focus, print) and `notebook.css` (binder, sheet, home, contents sheet, login, motion, responsive). The shell's five old stylesheets (`styles.css`, `course.css`, `login.css`, `auth.css`, `workspace.css`) are deleted, and `main.ts` imports the theme instead. `reader/article.css` and `editor/editor.css` are rewritten on the tokens. BlockNote is themed through its `--bn-*` variables, so no BlockNote internals are overridden.
- **Why**: "replace the visual world" means one coherent system, and the old sheets are minified one-line files whose rules would fight the new ones. Deleting them, rather than leaving dead files, makes the change explicit to Clara. When her PR #8 (comments, sign-up) merges, it will conflict on `login.css` and `workspace.css`, which shows exactly where its styles need porting. Styles for the class names PR #8 introduces (`comment-thread`, `comment-card`, `commentable-block`…) are included in advance.
- **Rejected**: overriding the old CSS with higher specificity (two systems fighting); converting the shell to React (Clara's call, per the team decision).

## R7. Shell markup changes

- **Decision**: restructure the markup in `main.ts` functions (`render`, `renderLogin`, `renderCatalog`, `renderPage`, dialogs) while keeping its rendering model, state variables, handlers and every id that tests, the editor mount and the e2e scripts use (`#login-form`, `#login-email`, `#login-password`, `#search`, `#edit-page`, `#go-home`, `#open-profile`, `#logout`, `#folder-select`, `#open-contribution`, `data-page`). New state: `selectedSubject` (the contents sheet) and `binderOpen` (the drawer). The binder model is built by a pure, unit-tested `buildBinder()` in a new module, so `main.ts` only renders it. Generic copy is rewritten: "PÁGINA DO BACKEND", "Conteúdo carregado diretamente do workspace", "Conteúdos do backend", "Instituto Germinare · Ambiente de aprendizagem".
- **Why**: the visible structure (binder, dividers, contents sheet, sheet layout) needs new markup, but behaviour must not change (FR-020). Putting the logic in a pure module keeps Clara's file mostly declarative and easy to review.

## R8. Search from the binder

- **Decision**: the search field moves into the binder (same `#search` id and filtering). Typing while a page or subject is open returns to the home sheet, which shows the results. Otherwise the field would filter a list that isn't on screen.
- **Why**: the current field filters only the home list, so on a page it appears to do nothing. This is the one behavioural nuance in the feature, and it is recorded in the PR for Clara.

## R9. Accessibility checks

- **Decision**: contrast pairs are verified in a unit test over the token values (WCAG relative luminance): body ink and links ≥ 7:1 on paper, all other text ≥ 4.5:1, focus ring ≥ 3:1. vitest-axe runs on the binder, home, contents sheet and page markup rendered from fixtures. The binder drawer is a disclosure (`aria-expanded`, `aria-controls`) that traps no focus on desktop, and closes on Esc on mobile.
- **Why**: projector legibility (SC-002) and constitution principle V.

## R10. Verification in a real browser

- **Decision**: extend the headless-Chrome scripts used for 002 (`~/.cache/germinawiki-spike`, outside the repo since they use the shared test account) with a design pass. It takes screenshots at 360, 768, 1280 and 1440 widths for home, subject, page, editor, sign-in and dialogs; measures rule alignment (SC-003), horizontal overflow (SC-005) and transition durations with and without reduced motion (SC-004); and runs `impeccable detect` on the built output (SC-006).
- **Why**: jsdom has no layout, so alignment, overflow and motion can only be measured in a browser (lesson from 002, where jsdom-green UI was broken in Chrome).
