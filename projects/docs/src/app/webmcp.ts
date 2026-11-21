import {
  declareExperimentalWebMcpTool,
  inject,
  Injector,
  isDevMode,
  WebMcpToolDescriptor,
} from '@angular/core';
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

/** Experimental WebMCP tools of the docs site (Angular `declareExperimentalWebMcpTool`, 22.0). */
const DOCS_WEBMCP_TOOLS: WebMcpToolDescriptor[] = [
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
    execute: ({ query }: { query?: unknown }) =>
      JSON.stringify(searchDocsPages(String(query ?? ''))),
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
    execute: async ({ path }: { path?: unknown }) => {
      const page = String(path ?? '').replace(/^\/+|\/+$/g, '');
      if (!isDocsPage(page)) return `No docs page has the path "${page}".`;
      await inject(Router).navigateByUrl(`/${page}`);
      return `Opened /${page}.`;
    },
  },
];

/**
 * Registers the docs WebMCP tools. An AI agent in the browser can find a docs page and open it.
 * The application loads this module with a dynamic `import()` only in a browser that has the
 * WebMCP API (see `app.config.ts`), so the initial bundle does not carry it. The tools stay
 * registered until the injector is destroyed. A rejected registration is ignored when the
 * registration was aborted, and it is a console warning in development mode. The package
 * `@star-ng/mcp` stays the supported way for coding agents.
 */
export function declareDocsWebMcpTools(injector: Injector): void {
  for (const tool of DOCS_WEBMCP_TOOLS) {
    declareExperimentalWebMcpTool(tool, injector).catch((error: unknown) => {
      if ((error as { name?: string } | null)?.name === 'AbortError') return;
      if (isDevMode()) console.warn(`WebMCP tool "${tool.name}" was not registered.`, error);
    });
  }
}
