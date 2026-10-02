import { describe, expect, test } from 'vitest';
import { allPages, buildBinder, dividerById, dividerForPage, type BinderPage } from '../../../src/shell/binder';
import type { FolderNode } from '../../../src/services/backend-api';

// contracts/binder-model.md, guarantees 1–5.
const folder = (id: string, name: string, parentFolderId: string | null = null, children: FolderNode[] = []): FolderNode =>
  ({ id, name, parentFolderId, children });
const page = (id: string, title: string, folderId: string | null): BinderPage =>
  ({ id, title, slug: id, content: '', folderId });

// The shape production returns from /api/folders/tree: areas with subjects, pages at several depths.
const tree = [
  folder('dev', 'Desenvolvimento', null, [folder('back', 'Backend', 'dev'), folder('front', 'Frontend', 'dev')]),
  folder('arq', 'Arquitetura', null, [folder('apis', 'APIs', 'arq', [folder('rest', 'REST', 'apis')]), folder('db', 'Banco de Dados', 'arq')]),
  folder('proj', 'Projetos')
];
const pages = [
  page('intro', 'Introdução ao Projeto', 'dev'),
  page('n122', '122', 'dev'),
  page('auth', 'Autenticação com Spring Boot', 'back'),
  page('users', 'API de Usuários', 'apis'),
  page('verbs', 'Verbos HTTP', 'rest'),
  page('pg', 'Banco de Dados PostgreSQL', 'db'),
  page('lost', 'Sem lugar', null),
  page('ghost', 'Pasta apagada', 'gone')
];

describe('buildBinder', () => {
  test('top-level folders are sections and their children dividers, in API order', () => {
    const { sections } = buildBinder(tree, pages);
    expect(sections.map(s => s.name)).toEqual(['Desenvolvimento', 'Arquitetura', 'Projetos', 'Sem pasta']);
    expect(sections[1].dividers.map(d => d.name)).toEqual(['APIs', 'Banco de Dados']);
    expect(sections[2].dividers).toEqual([]);
  });

  test("a top-level folder's own pages go on a first divider named after it", () => {
    const [dev] = buildBinder(tree, pages).sections;
    expect(dev.dividers.map(d => [d.id, d.name])).toEqual([['dev', 'Desenvolvimento'], ['back', 'Backend'], ['front', 'Frontend']]);
    expect(dev.dividers[0].pages.map(p => p.title)).toEqual(['122', 'Introdução ao Projeto']);
    expect(dev.dividers[0].sectionName).toBe('Desenvolvimento');
  });

  test('deeper folders become groups inside their divider, and count towards it', () => {
    const apis = dividerById(buildBinder(tree, pages), 'apis')!;
    expect(apis.pages.map(p => p.id)).toEqual(['users']);
    expect(apis.groups).toEqual([{ id: 'rest', name: 'REST', depth: 1, pages: [expect.objectContaining({ id: 'verbs' })] }]);
    expect(apis.pageCount).toBe(2);
    expect(allPages(apis).map(p => p.id)).toEqual(['users', 'verbs']);
  });

  test('every page appears exactly once; pages without a known folder go to "Sem pasta"', () => {
    const binder = buildBinder(tree, pages);
    const placed = binder.sections.flatMap(s => s.dividers.flatMap(d => allPages(d).map(p => p.id)));
    expect(placed.sort()).toEqual(pages.map(p => p.id).sort());
    const loose = binder.sections.at(-1)!;
    expect(loose).toMatchObject({ id: 'sem-pasta', name: 'Sem pasta' });
    expect(allPages(loose.dividers[0]).map(p => p.id).sort()).toEqual(['ghost', 'lost']);
  });

  test('no "Sem pasta" section when every page has a folder', () => {
    const sections = buildBinder(tree, pages.slice(0, 6)).sections;
    expect(sections.map(s => s.id)).not.toContain('sem-pasta');
  });

  test('colours follow (section + divider) mod 8, so neighbours differ', () => {
    const many = [folder('y', 'Ano', null, Array.from({ length: 10 }, (_, i) => folder(`s${i}`, `Matéria ${i}`, 'y')))];
    const [section] = buildBinder(many, []).sections;
    const colours = section.dividers.map(d => d.colour);
    expect(colours).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0, 1]);
    colours.slice(1).forEach((colour, i) => expect(colour).not.toBe(colours[i]));
    const [dev, arq] = buildBinder(tree, pages).sections;
    expect(dev.dividers[0].colour).toBe(0);
    expect(arq.dividers[0].colour).toBe(1);
  });

  test('is deterministic', () => {
    expect(buildBinder(tree, pages)).toEqual(buildBinder(tree, pages));
  });

  test('accepts a flat list with parentFolderId as well as a tree', () => {
    const flat = [folder('dev', 'Desenvolvimento'), folder('arq', 'Arquitetura'), folder('back', 'Backend', 'dev'), folder('apis', 'APIs', 'arq'), folder('rest', 'REST', 'apis')];
    const binder = buildBinder(flat, pages.slice(0, 5));
    expect(binder.sections.map(s => s.dividers.map(d => d.id))).toEqual([['dev', 'back'], ['apis']]);
    expect(dividerById(binder, 'apis')!.groups.map(g => g.id)).toEqual(['rest']);
  });

  test('sorts pages by title with Portuguese collation', () => {
    const binder = buildBinder([folder('a', 'A')], [page('1', 'Óptica', 'a'), page('2', 'Ondas', 'a'), page('3', 'Átomo', 'a')]);
    expect(binder.sections[0].dividers[0].pages.map(p => p.title)).toEqual(['Átomo', 'Ondas', 'Óptica']);
  });
});

describe('lookups', () => {
  test('dividerForPage finds the divider holding a page, including in groups', () => {
    const binder = buildBinder(tree, pages);
    expect(dividerForPage(binder, 'verbs')?.id).toBe('apis');
    expect(dividerForPage(binder, 'intro')?.id).toBe('dev');
    expect(dividerForPage(binder, 'nope')).toBeUndefined();
  });
});
