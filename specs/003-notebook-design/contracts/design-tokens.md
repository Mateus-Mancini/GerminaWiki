# Contract: Design Tokens

`frontend/src/theme/tokens.css` defines these custom properties on `:root`. The shell, the reader and the editor take colour, type, spacing, radius and motion **only** from them, and so will Clara's and João Pedro's future screens (comments, sign-up). A value may change; renaming or removing a token is a breaking change, so its users must be reviewed with it.

## Paper and ink

| Token | Value | Use | Contrast (WCAG) |
|---|---|---|---|
| `--paper` | `#f8fafc` | sheets, dialogs, menus | reference |
| `--paper-shade` | `#eef3f9` | code, table heads, hovered rows | ink 13.3:1 |
| `--rule-color` | `#c5d7ec` | the ruling, hairlines | decorative |
| `--margin-color` | `#e2878a` | the red margin line | decorative |
| `--ink` | `#1b2741` | body and headwords | 14.2:1 on paper |
| `--ink-soft` | `#46536e` | meta lines, secondary text | 7.4:1 |
| `--ink-faint` | `#5d6a84` | captions, placeholders | 5.2:1 |
| `--link` | `#1d4f9e` | internal and external links, focus ring | 7.5:1 |
| `--link-missing` | `#a3271d` | links to missing pages, errors | 7.0:1 |
| `--cover` | `#1c2742` | binder and sign-in cover board | — |
| `--cover-ink` | `#e9eef7` | text on the cover | 12.7:1 on cover |
| `--cover-ink-soft` | `#a9b6cf` | labels on the cover | 7.3:1 on cover |
| `--focus` | `var(--link)` | 2px focus outline, 2px offset | 7.5:1 on paper |

## Cardstock (subject dividers)

`--divider-0` … `--divider-7`: `#e4572e` tomato, `#f2a541` saffron, `#4a9e63` leaf, `#4d8fd6` sky, `#a77bd0` violet, `#e0609a` rose, `#23a3a8` teal, `#c49a3a` ochre. They are used for edges, tabs and marks next to a subject's name, never as the only cue and never behind text. All reach 3:1 against `--cover`.

## Type

| Token | Value |
|---|---|
| `--font-serif` | `"Libertinus Serif", "Linux Libertine", Georgia, "Times New Roman", serif` |
| `--font-sans` | `"Public Sans", system-ui, "Segoe UI", Roboto, sans-serif` |
| `--font-mono` | `ui-monospace, "Cascadia Mono", Consolas, "Liberation Mono", monospace` |
| `--text-body` | `1.1875rem` (19px); `1.0625rem` (17px) below 600px |
| `--text-headword` | `clamp(2.25rem, 1.6rem + 2.6vw, 3.4rem)` |
| `--text-h2` / `--text-h3` | `1.625rem` / `1.3125rem` |
| `--text-ui` / `--text-ui-small` | `0.9375rem` / `0.8125rem` |
| `--measure` | `66ch` |

## Ruling and space

| Token | Value |
|---|---|
| `--rule` | `32px`; `28px` below 600px. Body line height and the unit of all vertical rhythm on sheets |
| `--rule-offset` | baseline correction for the ruling, measured in Chrome (quickstart §3) |
| `--margin-x` | `88px` from the sheet's left edge to the margin line; `40px` below 600px |
| `--space-1` … `--space-6` | `4, 8, 12, 16, 24, 32` px, for interface spacing |
| `--binder-width` | `288px` |
| `--radius` / `--radius-small` | `6px` / `4px` |

## Motion

| Token | Value |
|---|---|
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` (exponential ease-out) |
| `--duration-turn` | `240ms`, page turn and margin draw |
| `--duration-lift` | `160ms`, tab lift, hover states |
| `--duration-fade` | `120ms`, fades and the reduced-motion replacement |

Under `prefers-reduced-motion: reduce`, `--duration-turn` and `--duration-lift` become `0ms`. Animations that would slide, lift or draw are disabled, and fades keep `--duration-fade` (FR-017).

## BlockNote mapping

`editor.css` maps the tokens onto BlockNote's variables (`--bn-font-family`, `--bn-colors-editor-text`, `--bn-colors-editor-background`, `--bn-colors-menu-*`, `--bn-colors-hovered-*`, `--bn-colors-selected-*`, `--bn-colors-border`, `--bn-colors-side-menu`, `--bn-border-radius*`, `--bn-shadow-*`). It doesn't restyle BlockNote's internal class names except for sizes on the sheet.
