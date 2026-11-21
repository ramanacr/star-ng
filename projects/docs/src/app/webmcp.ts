import { EnvironmentProviders, inject, provideExperimentalWebMcpTools } from '@angular/core';
import { Router } from '@angular/router';
import { DOCS_NAV } from './nav';

/** One docs page as a WebMCP tool returns it. */
export interface DocsPageMatch {
  readonly label: string;
  readonly group: string;
  /** Route path, for example `controls/table`. */
  readonly path: string;
}

/**
 * The docs pages whose label, group, path or keywords contain every word of the query (case
 * insensitive), in navigation order. An empty query returns every page.
 */
export function searchDocsPages(query: string, limit = 20): DocsPageMatch[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches: DocsPageMatch[] = [];
  for (const group of DOCS_NAV) {
    for (const item of group.items) {
      const text = `${item.label} ${group.label} ${item.path} ${item.keywords ?? ''}`.toLowerCase();
      if (words.every((word) => text.includes(word))) {
        matches.push({ label: item.label, group: group.label, path: item.path });
      }
    }
  }
  return matches.slice(0, limit);
}

/** True when the path is a page of the navigation. */
export function isDocsPage(path: string): boolean {
  return DOCS_NAV.some((group) => group.items.some((item) => item.path === path));
}

/**
 * Experimental WebMCP tools of the docs site (Angular `provideExperimentalWebMcpTools`, 22.0).
 * An AI agent in the browser can find a docs page and open it. Angular registers the tools only
 * in a browser that has the WebMCP API (`document.modelContext` or `navigator.modelContext`), and
 * never on the server, so other browsers and the prerender are not affected. The package
 * `@star-ng/mcp` stays the supported way for coding agents.
 */
export function provideDocsWebMcpTools(): EnvironmentProviders {
  return provideExperimentalWebMcpTools([
    {
      name: 'star_ng_search_docs',
      title: 'Search the StarNG docs',
      description:
        'Finds StarNG documentation pages (controls and guides) by words, for example "table filter" or "dark mode". Returns the label, group and path of each page.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Words to look for.' } },
        required: ['query'],
      },
      annotations: { readOnlyHint: true },
      execute: ({ query }) => JSON.stringify(searchDocsPages(String(query ?? ''))),
    },
    {
      name: 'star_ng_open_docs_page',
      title: 'Open a StarNG docs page',
      description:
        'Opens a StarNG documentation page in this tab. Use a path from star_ng_search_docs, for example "controls/table".',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string', description: 'The page path.' } },
        required: ['path'],
      },
      execute: async ({ path }) => {
        const page = String(path ?? '').replace(/^\/+|\/+$/g, '');
        if (!isDocsPage(page)) return `No docs page has the path "${page}".`;
        await inject(Router).navigateByUrl(`/${page}`);
        return `Opened /${page}.`;
      },
    },
  ]);
}
