# Data Model: Notebook Design

No server data changes. The feature adds client-side view models derived from the API's folders and pages.

## Binder (derived, `frontend/src/shell/binder.ts`)

```text
Binder
└── sections: Section[]            one per top-level folder, in API order
    Section { id, name, dividers: Divider[] }
    Divider {
      id            folder id; for a top-level folder's own pages, the top-level folder's id
      name          folder name
      sectionName   the top-level folder's name (the "year")
      colour        0..7, see rule below
      pages         RemotePage[] directly in this folder, by title (pt-BR collation)
      groups        Group[] for deeper folders, depth-first, each { id, name, depth, pages }
      pageCount     pages + all groups' pages
    }
```

Rules:

- A top-level folder with pages of its own gets a first divider with its own id and name. A top-level folder with no pages and no children still appears, as a section with no dividers, and shows an empty state.
- Pages with no folder (`folderId: null`) or an unknown folder go on a final "Sem pasta" section with one divider.
- **Colour**: `(sectionIndex + dividerIndex) mod 8` over the section's dividers in order, so neighbours in a section differ and the first dividers of consecutive sections differ. Recomputed from the same API order on every visit, so it is stable for everyone.
- `dividerForPage(binder, pageId)` and `dividerById(binder, id)` give the pulled-out tab for the current page or subject.

## Excerpt (derived, `frontend/src/reader/excerpt.ts`)

`excerpt(markdown, max = 180)`: the first paragraph-like text of a page, skipping comment anchors, headings, code fences, images, tables, HTML and blank lines. Inline Markdown is reduced to its text, `[[slug]]` shows the slug, and the result is cut at a word boundary with "…". It is used by the contents sheet and by link previews.

## Shell view state (in `main.ts`)

| State | Existing / new | Meaning |
|---|---|---|
| `selectedPage` | existing | the page on the sheet |
| `selectedSubject` | **new** | divider id whose contents sheet is shown (null when a page or home is shown) |
| `binderOpen` | **new** | drawer open below 900px |
| `query`, `selectedFolder` | existing | search text and the home filter (by section) |

Transitions between home, contents sheet and page go through one `navigate()` helper, which applies the page-turn (research R4) and closes the drawer.

## Design tokens

Named values listed in [contracts/design-tokens.md](./contracts/design-tokens.md). They are the only source of colour, type, spacing, radius and duration for the shell, reader and editor.
