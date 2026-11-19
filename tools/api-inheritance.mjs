// Inherited inputs, models and outputs of the library classes. The API extractor of
// `gen-docs-data.mjs` reads only the members that a class declares; a control such as `StarSelect`
// gets most of its inputs from a base class (`StarOptionListBase`). Both the docs data
// (`gen-docs-data.mjs`) and the agent data (`agent-data.mjs`) use this module.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** `{ Class: BaseClass }` for every library class that extends another class. */
export function readBaseClasses(dir = join(root, 'projects/star-ng')) {
  const bases = {};
  const visit = (path) => {
    for (const name of readdirSync(path)) {
      const child = join(path, name);
      if (statSync(child).isDirectory()) {
        if (name !== 'node_modules') visit(child);
        continue;
      }
      if (!name.endsWith('.ts') || name.endsWith('.spec.ts')) continue;
      const source = ts.createSourceFile(
        child,
        readFileSync(child, 'utf8'),
        ts.ScriptTarget.Latest,
      );
      source.forEachChild((node) => {
        if (!ts.isClassDeclaration(node) || !node.name) return;
        const clause = node.heritageClauses?.find(
          (item) => item.token === ts.SyntaxKind.ExtendsKeyword,
        );
        const base = clause?.types[0]?.expression;
        if (base && ts.isIdentifier(base)) bases[node.name.text] = base.text;
      });
    }
  };
  visit(dir);
  return bases;
}

/**
 * Adds the inherited inputs, models and outputs to every entry of `api`; a member that the class
 * declares again wins. With `markInherited`, an inherited member gets `inheritedFrom`: the name of
 * the class that declares it (for example `StarOptionListBase`).
 */
export function withInheritedMembers(api, bases, { markInherited = false } = {}) {
  const resolved = {};
  const membersOf = (name, kind, seen = new Set()) => {
    if (!api[name] || seen.has(name)) return [];
    seen.add(name);
    const own = api[name][kind];
    const inherited = bases[name] ? membersOf(bases[name], kind, seen) : [];
    const names = new Set(own.map((member) => member.name));
    const fromBase = inherited
      .filter((member) => !names.has(member.name))
      .map((member) =>
        markInherited ? { ...member, inheritedFrom: member.inheritedFrom ?? bases[name] } : member,
      );
    return [...fromBase, ...own];
  };
  for (const [name, entry] of Object.entries(api)) {
    resolved[name] = {
      ...entry,
      inputs: membersOf(name, 'inputs'),
      models: membersOf(name, 'models'),
      outputs: membersOf(name, 'outputs'),
    };
  }
  return resolved;
}
