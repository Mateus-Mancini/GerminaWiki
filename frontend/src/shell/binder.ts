import type { FolderNode, RemotePage } from '../services/backend-api';

/**
 * The binder: the folder tree as the notebook shows it (contracts/binder-model.md). Top-level folders are
 * section labels (years, in the intended use), their children are subject dividers, and deeper folders
 * are groups inside a divider. Pure and deterministic, so the shell only renders it.
 */
export type BinderPage = Pick<RemotePage, 'id' | 'title' | 'slug' | 'content' | 'folderId' | 'updatedAt'>;
export type Group = { id: string; name: string; depth: number; pages: BinderPage[] };
export type Divider = {
  id: string;
  name: string;
  sectionId: string;
  sectionName: string;
  /** 0..7, an index into the --divider-N cardstock tokens. */
  colour: number;
  pages: BinderPage[];
  groups: Group[];
  pageCount: number;
};
export type Section = { id: string; name: string; dividers: Divider[] };
export type Binder = { sections: Section[] };

export const UNFILED = { id: 'sem-pasta', name: 'Sem pasta' } as const;
const PALETTE = 8;
const byTitle = (a: BinderPage, b: BinderPage) => a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' });

/** Folders from /api/folders/tree (nested) or a flat list with parentFolderId, as one tree in API order. */
function asTree(folders: FolderNode[]): FolderNode[] {
  const all = new Map<string, FolderNode>();
  const visit = (node: FolderNode) => { if (!all.has(node.id)) all.set(node.id, node); (node.children ?? []).forEach(visit); };
  folders.forEach(visit);
  const children = new Map<string, FolderNode[]>();
  const roots: FolderNode[] = [];
  for (const node of all.values()) {
    const parent = node.parentFolderId && all.has(node.parentFolderId) ? node.parentFolderId : null;
    if (parent) children.set(parent, [...(children.get(parent) ?? []), node]);
    else roots.push(node);
  }
  const build = (node: FolderNode): FolderNode => ({ ...node, children: (children.get(node.id) ?? []).map(build) });
  return roots.map(build);
}

export function buildBinder(folders: FolderNode[], pages: BinderPage[]): Binder {
  const tree = asTree(folders);
  const known = new Set<string>();
  const collect = (node: FolderNode) => { known.add(node.id); node.children.forEach(collect); };
  tree.forEach(collect);

  const pagesIn = new Map<string, BinderPage[]>();
  const unfiled: BinderPage[] = [];
  for (const page of pages) {
    if (page.folderId && known.has(page.folderId)) pagesIn.set(page.folderId, [...(pagesIn.get(page.folderId) ?? []), page]);
    else unfiled.push(page);
  }
  const own = (id: string) => [...(pagesIn.get(id) ?? [])].sort(byTitle);

  const groupsUnder = (node: FolderNode, depth: number): Group[] =>
    node.children.flatMap(child => [{ id: child.id, name: child.name, depth, pages: own(child.id) }, ...groupsUnder(child, depth + 1)]);

  const divider = (node: FolderNode, section: FolderNode, colour: number, withGroups: boolean): Divider => {
    const groups = withGroups ? groupsUnder(node, 1) : [];
    const ownPages = own(node.id);
    return {
      id: node.id, name: node.name, sectionId: section.id, sectionName: section.name, colour,
      pages: ownPages, groups, pageCount: ownPages.length + groups.reduce((sum, group) => sum + group.pages.length, 0)
    };
  };

  const sections: Section[] = tree.map((top, sectionIndex) => {
    const entries: { node: FolderNode; withGroups: boolean }[] = [
      ...(pagesIn.get(top.id)?.length ? [{ node: { ...top, children: [] }, withGroups: false }] : []),
      ...top.children.map(child => ({ node: child, withGroups: true }))
    ];
    return {
      id: top.id,
      name: top.name,
      dividers: entries.map(({ node, withGroups }, index) => divider(node, top, (sectionIndex + index) % PALETTE, withGroups))
    };
  });

  if (unfiled.length) {
    const sectionIndex = sections.length;
    sections.push({
      ...UNFILED,
      dividers: [{
        ...UNFILED, sectionId: UNFILED.id, sectionName: UNFILED.name, colour: sectionIndex % PALETTE,
        pages: [...unfiled].sort(byTitle), groups: [], pageCount: unfiled.length
      }]
    });
  }
  return { sections };
}

/** The divider's pages in reading order: its own, then each group's. */
export function allPages(divider: Divider): BinderPage[] {
  return [...divider.pages, ...divider.groups.flatMap(group => group.pages)];
}

export function dividerById(binder: Binder, id: string): Divider | undefined {
  return binder.sections.flatMap(section => section.dividers).find(divider => divider.id === id);
}

export function dividerForPage(binder: Binder, pageId: string): Divider | undefined {
  return binder.sections.flatMap(section => section.dividers).find(divider => allPages(divider).some(page => page.id === pageId));
}
