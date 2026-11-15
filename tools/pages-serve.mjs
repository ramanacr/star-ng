// Static server that mimics GitHub Pages for a project site: `node tools/pages-serve.mjs`.
//
//   --dir  <folder>  built site (default `dist/docs/browser`)
//   --base </path/>  sub-path of the site (default `/star-ng/`, and `/` with --spa)
//   --port <number>  default 4300, or the PORT environment variable
//   --spa            single-page-application mode for the test jobs: see below
//
// Like GitHub Pages:
// - files are served only under the base path; `/star-ng` redirects to `/star-ng/`;
// - a folder answers with its `index.html` (the prerendered page of a route), and a folder
//   address without the final `/` redirects (301) to the address with it;
// - any other path answers with the content of `404.html` and the status 404 (no rewrite);
// - no other header than the content type is set (so a Content-Security-Policy must come
//   from the `<meta>` element of the page, as it must on GitHub Pages).
//
// With --spa the server is a plain static server for the end-to-end tests (CI serves the
// production build of the docs under `/`, see `playwright.server.ts`):
// - a folder answers with its `index.html` at once, without the redirect (the prerendered
//   page of a route, status 200);
// - a path without a file extension that has no file answers with the client-rendered shell
//   `index.csr.html` (`index.html` when the build has none) and the status 200 (deep links of
//   the router); no `404.html` is needed. The shell has no page content, so a page that was
//   not prerendered cannot pass for a prerendered one;
// - a missing path that has a file extension (a script, a style, an image) still answers 404,
//   so a broken asset URL is not hidden by the HTML fallback;
// - the other rules (content type only, no extra header) stay the same.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    dir: { type: 'string', default: 'dist/docs/browser' },
    base: { type: 'string' },
    port: { type: 'string', default: process.env.PORT ?? '4300' },
    spa: { type: 'boolean', default: false },
  },
});
const root = resolve(values.dir);
const spa = values.spa;
const base = values.base ?? (spa ? '/' : '/star-ng/');
const port = Number(values.port);
if (!base.startsWith('/') || !base.endsWith('/')) {
  console.error('pages-serve: --base must start and end with "/"');
  process.exit(1);
}
if (spa) {
  if (!existsSync(join(root, 'index.html'))) {
    console.error(`pages-serve: ${join(root, 'index.html')} is missing. Build the docs first.`);
    process.exit(1);
  }
} else if (!existsSync(join(root, '404.html'))) {
  console.error(`pages-serve: ${join(root, '404.html')} is missing. Run "pnpm build:pages" first.`);
  process.exit(1);
}

// The shell for an address that is no page: the client-rendered one when the build has it.
const shell = join(
  root,
  existsSync(join(root, 'index.csr.html')) ? 'index.csr.html' : 'index.html',
);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function send(response, status, file) {
  response.writeHead(status, {
    'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': statSync(file).size,
  });
  createReadStream(file).pipe(response);
}

/** The file for a path below the base, or null (no such file, or outside the folder). */
function resolveFile(relative) {
  let decoded;
  try {
    decoded = decodeURIComponent(relative);
  } catch {
    return null;
  }
  const file = normalize(join(root, decoded));
  if (file !== root && !file.startsWith(root + sep)) return null;
  if (!existsSync(file)) return null;
  if (statSync(file).isDirectory()) {
    const index = join(file, 'index.html');
    return existsSync(index) ? index : null;
  }
  return file;
}

const server = createServer((request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  if (pathname === base.slice(0, -1)) {
    response.writeHead(301, { location: base });
    response.end();
    return;
  }
  if (!pathname.startsWith(base)) {
    // GitHub shows its own page here; the site's 404.html is only for paths below the base.
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('404 Not Found (outside the site path)');
    return;
  }
  const relative = pathname.slice(base.length);
  const file = resolveFile(relative);
  if (file && !spa && !pathname.endsWith('/') && extname(pathname) === '') {
    // GitHub Pages sends a folder address without the final "/" to the one with it.
    response.writeHead(301, {
      location: pathname + '/' + new URL(request.url ?? '/', 'http://localhost').search,
    });
    response.end();
  } else if (file) send(response, 200, file);
  else if (spa && extname(pathname) === '') send(response, 200, shell);
  else send(response, 404, spa ? shell : join(root, '404.html'));
});

server.listen(port, () => {
  console.log(`pages-serve: http://localhost:${port}${base} (folder ${root}${spa ? ', spa' : ''})`);
});
