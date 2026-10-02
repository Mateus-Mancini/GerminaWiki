# Contract: Binder Model

The shell's binder, home and contents sheet render from one pure module, so the folder-tree rules live in one tested place.

```ts
// frontend/src/shell/binder.ts
export type BinderPage = Pick<RemotePage, 'id' | 'title' | 'slug' | 'content' | 'folderId' | 'updatedAt'>;
export type Group = { id: string; name: string; depth: number; pages: BinderPage[] };
export type Divider = {
  id: string; name: string; sectionId: string; sectionName: string;
  colour: number;            // 0..7, index into --divider-N
  pages: BinderPage[];       // directly in this folder, sorted by title (pt-BR)
  groups: Group[];           // deeper folders, depth-first
  pageCount: number;         // pages + all groups' pages
};
export type Section = { id: string; name: string; dividers: Divider[] };
export type Binder = { sections: Section[] };

export function buildBinder(folders: FolderNode[], pages: BinderPage[]): Binder;
export function dividerForPage(binder: Binder, pageId: string): Divider | undefined;
export function dividerById(binder: Binder, id: string): Divider | undefined;
export function allPages(divider: Divider): BinderPage[];   // pages, then each group's pages
```

Guarantees (unit-tested):

1. Sections follow top-level folders in API order. Dividers follow child folders in API order, with a top-level folder's own pages on a first divider that carries the top-level folder's id and name.
2. Every page appears exactly once. Pages with no folder or an unknown folder go to a final section `{ id: 'sem-pasta', name: 'Sem pasta' }`.
3. `colour = (sectionIndex + dividerIndex) mod 8`, so neighbouring dividers in a section never share a colour.
4. It's deterministic: the same input always gives the same output, with no randomness or clock.
5. Folder `children` and flat `parentFolderId` lists are both accepted, since the API returns a tree.

The shell renders `data-divider="<id>"`, `data-colour="<n>"` and `aria-current="page"` (current page) or `aria-current="true"` (current subject) from this model.
