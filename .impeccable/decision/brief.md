# Surface brief: GerminaWiki web app (reading, catalog, shell, editor)

Scope: the whole web app. Primary mode Read (the article); the editor and the sidebar are Operate inside the same world.
Audience: Germinare students reading and editing subject notes on school/home desktops and on a classroom projector.
Keep: the sidebar folder tree and the subject catalog home, both rebuilt in this world. Avoid: literal Wikipedia clone, playful, soulless/generic.
Feel: Notion-smooth, animated, direct manipulation; a hint of nostalgic Wikipedia.

## Direction contract

THESIS: The wiki is the class's shared caderno universitário. Each subject is a coloured cardstock divider, each page a ruled sheet; reading sits on the ruling and editing writes on the same sheet. It refuses the category default of a white card on a grey canvas with a sans body and a boxed table of contents.

OWN-WORLD: Cool notebook paper (never cream), pale blue rules at the reading line-height, and one red margin rule. Ballpoint blue-black ink for text, wiki-blue pen-underlined links, and red links for pages that do not exist yet. Divider colours are saturated cardstock: one per subject, used on tabs, edges and the spiral binding's shadow, never as text fields. Libertinus Serif (the Wikipedia heritage face) for headwords and body; Public Sans for the interface. State is a pen mark: filled dot = here, check = saved, strike = missing.

STORY: A student picks a subject's divider, reads the sheet like an encyclopedia entry, follows blue links to other sheets (red ones invite writing them), and taps Editar to write directly on the same ruled page.

FIRST VIEWPORT: On the left, a 288px binder strip whose spiral rings run down its right edge, with years as section labels and subjects as stacked coloured divider tabs; the current subject's tab is pulled out and its sheets listed. On the right, the sheet: blue rules every 32px, the red margin at 88px, a small breadcrumb above, then the headword in Libertinus at 3.4rem sitting on a rule, a pen-mark meta line, and the body at a 66ch measure aligned to the ruling. "Editar" is a pen-shaped control at the sheet's top right; search sits as a slim field on the binder.

FORM: Caderno Universitário, position 1 on the ordered list (taken as IMPECCABLE'S PICK over the roll), seed key d5620702. Signature interaction: the page turn. Navigating slides the next sheet over the current one with a soft curl shadow (240ms exponential ease-out), divider tabs lift on hover, and entering edit mode draws the margin rule down the sheet while the caret lands. Hovering a [[link]] opens a small sheet preview, the Wikipedia page-preview nod.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
