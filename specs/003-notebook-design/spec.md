# Feature Specification: Notebook Design (Caderno Universitário)

**Feature Branch**: `003-notebook-design`

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "Replace the web app's visual world. Students found the current look generic ('AI slop, no soul, personality or taste'). Keep the sidebar folder tree and the subject catalog home, rebuilt and largely improved. Feel: as smooth, animated and interactive as Notion, with a slight nostalgic Wikipedia vibe; not a literal Wikipedia clone, not playful. Chosen direction: Caderno Universitário, the class's shared spiral notebook: subjects as coloured cardstock dividers, pages as ruled sheets, reading and editing on the same sheet."

## Context

GerminaWiki is read far more than it is written. Students open a subject, read a page like an encyclopedia entry, follow links, and sometimes edit. They use school and home desktops, often shared, and teachers sometimes put a page on the classroom projector. The direction was chosen by the product owner from three candidates (`.impeccable/decision/`) and is recorded in `PRODUCT.md` and the surface brief (`.impeccable/surfaces/frontend-src-main-ts.md`). This feature changes how every screen looks and moves. It does not change what the screens do: data, permissions and flows stay as they are.

## Clarifications

### Session 2026-10-02

The product owner was away and had asked not to be stopped for questions, so the recommended option was taken for each point below. They are recorded here to be confirmed or changed in review.

- Q: How does a folder tree of any shape map onto the binder, given that production's top-level folders are areas such as "Desenvolvimento" and "Arquitetura", not years? → A: Top-level folders are the binder's section labels (years in the intended use, any grouping today). Their child folders are the divider tabs. Pages placed directly in a top-level folder go on a first divider named after that folder. Deeper folders become sub-headings inside their divider's page list.
- Q: What does choosing a subject on the home screen open? → A: The subject's contents sheet: a ruled sheet listing its pages (and sub-headings) with each page's opening line, like an encyclopedia's index page. It also opens that divider in the binder. Opening the first page directly would hide the subject's other pages.
- Q: How does the binder behave on narrow screens? → A: Below 900px it becomes an off-canvas drawer, opened by a "Matérias" toggle in the top bar, closed with Esc or by choosing a page, and it returns focus to the toggle.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read a page on a ruled sheet (Priority: P1)

A student opens a page and reads it as a well-set sheet of their class notebook: the title as a large serif headword, a short line saying where the page lives and when it changed, and the text on a comfortable measure that sits on pale ruling, with a red margin line. Internal links are blue and underlined like pen strokes; links to pages that don't exist yet are red. Headings, quotes, code, tables and images are clearly distinguished. The same page stays legible on a classroom projector.

**Why this priority**: Reading is the main use of the wiki and the first impression of every page. On its own, a readable, distinctive page view already delivers most of the value.

**Independent Test**: Open any existing page at 1440×900 and at 1280×720 projector size; check that the headword, meta line, body, headings, quote, code block, table, image, blue link and red link are all styled as described, and that the body text stays aligned to the ruling.

**Acceptance Scenarios**:

1. **Given** a page with headings, a quote, code, a table, an image and links, **When** a student opens it, **Then** the title appears as a serif headword on the ruled sheet, the body sits on the rules, and each kind of content is visually distinct.
2. **Given** a page that links to an existing page and to a missing one, **When** it is shown, **Then** the first link is blue and opens the page, and the second is red and marked as not existing yet.
3. **Given** a page with several sections, **When** it is shown, **Then** the sections are listed beside or above the text (depending on width), and choosing one scrolls to it.
4. **Given** the page is shown on a 1280×720 projector, **When** viewed from the back of a classroom, **Then** body text is at least 18px with contrast of at least 7:1 against the paper.

---

### User Story 2 - Find a subject in the binder (Priority: P1)

The left side of the app is a binder. Years are section labels, and each subject is a coloured divider tab. The current subject's tab is pulled out and lists its pages, and the current page carries a "you are here" mark. The home screen shows all subjects as dividers to pick from. Search is a slim field on the binder.

**Why this priority**: Navigation is used on every visit, and the folder tree and catalog are the two structures the owner asked to keep and improve.

**Independent Test**: From the home screen, reach a page in another subject in at most two clicks, and identify the current subject and page from the binder alone.

**Acceptance Scenarios**:

1. **Given** folders for years and subjects, **When** the app opens, **Then** the binder shows each year as a label and each subject as a divider tab in its own colour, the same colour on every visit.
2. **Given** a student on a page, **When** they look at the binder, **Then** the page's subject tab is pulled out, its pages are listed, and the current page is marked.
3. **Given** the home screen, **When** it loads, **Then** every subject appears as a divider with its name, its year and its number of pages, and choosing one opens its contents sheet, which lists its pages with their opening lines.
4. **Given** a window narrower than 900px, **When** the app is shown, **Then** the binder becomes a drawer behind a "Matérias" toggle so the sheet keeps the full width; Esc or choosing a page closes it.
5. **Given** the search field, **When** the student types, **Then** results filter as before (search behaviour does not change).

---

### User Story 3 - Edit on the same sheet (Priority: P2)

When a student chooses Editar, the sheet doesn't jump to a different-looking screen. The same paper, ruling and headword stay, the margin line is drawn down the sheet, and the caret lands in the text. Saving shows a pen-mark style confirmation. The editor's menus, toolbars, dialogs and conflict screen use the same paper, ink and typefaces.

**Why this priority**: Editing in place is the product's second principle. A jarring switch between reading and editing breaks the "same notebook" idea, but reading and navigation come first.

**Independent Test**: Open a page, choose Editar, type, save; compare reading and editing screenshots, which should show the same headword size, body face, ruling and margin.

**Acceptance Scenarios**:

1. **Given** a page in the reading view, **When** the student chooses Editar, **Then** the edit view keeps the paper, the ruling, the headword and the body typeface, and the change between them is a short, smooth transition.
2. **Given** the edit view, **When** the slash menu, formatting toolbar, link picker or a dialog opens, **Then** it uses the notebook's colours and typefaces, not a default look.
3. **Given** a successful save, **When** the student returns to reading, **Then** a short confirmation is shown and announced to assistive technology.

---

### User Story 4 - Move through the notebook smoothly (Priority: P3)

Moving between pages feels like turning a sheet: the next sheet slides over the current one. Divider tabs lift slightly under the pointer. Hovering a blue internal link shows a small preview of the target page's opening lines, the nod to Wikipedia's page previews.

**Why this priority**: Motion and previews give the app its Notion-like smoothness and character, but the app is complete and usable without them.

**Independent Test**: Navigate between three pages, hover tabs and links with motion enabled and then with reduced motion requested; check the transitions, tab lift and preview, and their absence or reduction under reduced motion.

**Acceptance Scenarios**:

1. **Given** a student on a page, **When** they open another page, **Then** the new sheet slides in over the old one in at most 300ms.
2. **Given** the pointer rests on an internal link for a moment, **When** the target page is known, **Then** a small preview with its title and first lines appears near the link, and disappears when the pointer leaves; keyboard focus on the link shows the same preview.
3. **Given** the system asks for reduced motion, **When** the student navigates or hovers, **Then** no sliding, lifting or drawing animation plays; changes happen instantly or with a simple fade.

---

### User Story 5 - Sign in and manage the account in the same world (Priority: P3)

The sign-in screen, profile dialog, contribution dialog, notices and empty or loading states all belong to the notebook, with the same paper, ink, typefaces and controls, instead of a separate generic style.

**Why this priority**: These screens are seen less often than pages, but a generic sign-in screen is the first thing every student sees.

**Independent Test**: Sign out, check the sign-in screen; sign in, open the profile and contribution dialogs, trigger a notice; each uses the notebook's tokens and controls.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor, **When** the app opens, **Then** the sign-in screen presents GerminaWiki as the class notebook, with no school logo or official colours.
2. **Given** the profile or contribution dialog, **When** it opens, **Then** it looks like a sheet or card from the same notebook, with labelled fields, visible focus and the same buttons as the rest of the app.
3. **Given** data is loading or a list is empty, **When** the screen is shown, **Then** a state written in plain Portuguese explains it, styled in the notebook's world.

### Edge Cases

- **Many subjects**: there are more subjects than colours in the palette. Colours repeat in a fixed order, and two neighbouring tabs never share one.
- **Long titles and names**: a very long page title wraps on the sheet without overflowing, and a long subject or page name truncates in the binder with its full name available on hover and to assistive technology.
- **No folders, or no pages in a subject**: the binder and home screen show an explanatory empty state, not an empty space.
- **Slow API (cold start)**: loading states keep the layout's shape so nothing jumps when data arrives.
- **Page without headings**: no table of contents is shown.
- **Small screens (360px wide)**: no horizontal scrolling. The margin and ruling scale down, and the binder becomes a toggle.
- **Images wider than the sheet**: scaled to the text column. Wide tables and code scroll inside their own box.
- **Fonts fail to load**: text falls back to system serif and sans faces with similar metrics, and stays readable.
- **Printing a page**: the sheet prints without the binder, rules or controls.
- **Comments UI (web app PR #8)**: comment threads under blocks must also fit the sheet when that work lands.

## Requirements *(mandatory)*

### Functional Requirements

**World and tokens**

- **FR-001**: The app MUST use one shared set of design tokens (paper, ink, rules, margin, link, missing-link, divider palette, type scale, spacing, radii, motion durations) that every screen, including the editor, takes its colours, type and motion from.
- **FR-002**: The paper MUST be a cool, near-white notebook paper (never cream or beige) with pale blue horizontal rules at the reading line height and one red margin line; text MUST be a blue-black "ballpoint" ink.
- **FR-003**: Headwords and article text MUST use a serif face of Wikipedia heritage; interface text (binder, buttons, labels, menus) MUST use a sober sans face. Both MUST be served by the app itself, not by a third-party font host, and MUST fall back to similar system faces.
- **FR-004**: Each subject MUST have a divider colour from a fixed palette, assigned the same way on every visit and for every student, and used only on tabs, edges and small marks, never as the background of text.
- **FR-005**: The app MUST NOT use decorative gradients, glassmorphism, decorative icon grids, emoji as icons, or any school logo or official school colour.

**Reading (US1)**

- **FR-006**: The page view MUST show the title as a serif headword, a meta line (subject, year and last change when known), the article, and a list of sections when the page has headings.
- **FR-007**: Article text MUST sit on the ruling: paragraph line height MUST equal the rule spacing, and block spacing MUST be a whole multiple of it, so lines stay on the rules after headings, lists, quotes and images.
- **FR-008**: Internal links MUST be blue with a pen-stroke underline; links to missing pages MUST be red and distinguishable without colour (e.g. dashed underline and an accessible description).
- **FR-009**: Body text MUST be at least 18px at desktop widths with a measure of about 60–72 characters, and contrast of at least 7:1 against the paper; all other text MUST reach at least 4.5:1.

**Binder and home (US2)**

- **FR-010**: The left binder MUST show top-level folders (years) as labels and their child folders (subjects) as divider tabs, with pages placed directly in a top-level folder on a first divider named after it and deeper folders as sub-headings in their divider's page list; the current subject's tab MUST be visibly pulled out with its pages listed, and the current page MUST carry a "here" mark that is also exposed to assistive technology (e.g. `aria-current`).
- **FR-011**: The home screen MUST present subjects as dividers with name, year and page count, replacing the current card grid, and MUST keep the existing folder filter and search behaviour. Choosing a subject MUST open its contents sheet and its divider in the binder.
- **FR-011a**: A subject's contents sheet MUST list its pages, grouped under sub-headings for deeper folders, each with its title and opening line, and MUST state when the subject has no pages yet.
- **FR-012**: Below 900px wide, the binder MUST become an off-canvas drawer opened by a "Matérias" toggle that announces its state; Esc or choosing a page closes it and returns focus to the toggle.

**Editing (US3)**

- **FR-013**: The edit view MUST keep the reading view's paper, ruling, headword size and body typeface, so switching between them changes controls, not the page's look.
- **FR-014**: The editor's own menus, toolbars, pickers, banners, dialogs and conflict screen MUST use the shared tokens.

**Motion (US4)**

- **FR-015**: Page changes MUST use a sheet-turn transition of at most 300ms; divider tabs MUST lift on hover and focus; entering edit mode MUST draw the margin line down the sheet.
- **FR-016**: Hovering or focusing an internal link to a known page MUST show a preview with its title and opening lines after a short delay, without a request per hover when the page is already loaded.
- **FR-017**: When reduced motion is requested, sliding, lifting and drawing animations MUST be replaced by instant changes or simple fades of at most 150ms.

**Other screens (US5)**

- **FR-018**: The sign-in screen, profile dialog, contribution dialog, notices, loading, empty and error states MUST use the shared tokens and controls.

**Cross-cutting**

- **FR-019**: Every interactive element MUST be keyboard-operable with a visible focus indicator of at least 3:1 contrast, and status changes MUST still be announced as before.
- **FR-020**: Behaviour MUST NOT change: the same data, flows, permissions, element identifiers relied on by tests and the editor mount, and pt-BR copy (copy may be rewritten only where it is generic or wrong, such as "Conteúdo carregado diretamente do workspace").
- **FR-021**: No screen MUST scroll horizontally at widths from 360px to 1920px.
- **FR-022**: Printing a page MUST produce the sheet only (headword, meta line and article) without the binder, ruling or controls.

### Key Entities

- **Design tokens**: the named values every screen uses (colours, typefaces, sizes, spacing, radii, durations).
- **Subject divider**: a subject (a second-level folder, or a top-level folder's own pages) shown as a tab with its stable colour, its year and its pages.
- **Contents sheet**: a subject's index page, listing its pages and sub-headings.
- **Sheet**: one page shown or edited on ruled paper: headword, meta line, sections and article.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From the home screen, any page can be reached in at most 2 clicks or 2 key presses after search.
- **SC-002**: Body text measures at least 18px and reaches at least 7:1 contrast on every reading surface; an automated accessibility scan of the reading view, home, binder, sign-in and edit view reports no violations.
- **SC-003**: Article lines stay on the ruling: in a page mixing headings, paragraphs, lists, a quote and an image, the baseline of every paragraph line is within 2px of a rule.
- **SC-004**: Every transition lasts 300ms or less, and none slides, lifts or draws when reduced motion is requested.
- **SC-005**: No horizontal scrolling on any screen at 360px, 768px, 1280px and 1440px wide.
- **SC-006**: The design detector (`impeccable detect`) reports no findings on the shipped screens, and the finish review gives the build a passing verdict.
- **SC-007**: Opening a page is not slower than before the redesign: the time from choosing a page to readable text grows by less than 100ms, and fonts add less than 150 KB to the first load.

## Assumptions

- The app stays light-only: a notebook page is light by nature, and no dark mode is in scope.
- Colour per subject is derived from the folder, not stored: there is no field for it in the API, and the API is out of scope.
- The structure of years and subjects is the existing folder tree, mapped as in Clarifications: top-level folders are labels, their children are dividers. Today's production folders are areas rather than years; the mapping works for both.
- The shell keeps its current architecture (plain TypeScript rendering HTML strings, owned by Clara); this feature restyles and restructures its markup but does not convert it to React. Clara reviews every change to her files.
- The comments UI (Clara's PR #8) and the sign-up screen will land separately; this feature styles the hooks they need (block wrappers, form controls) but does not implement comments.
- The warm-up screen for cold starts is a separate feature and is not designed here.
- Link previews use pages the app has already loaded (the page list), and show their opening text; no new API is needed.
