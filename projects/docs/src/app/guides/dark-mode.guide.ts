import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StarButton } from '@star-ng/ui/button';
import {
  STAR_THEME_FIRST_PAINT_HASH,
  StarThemeService,
  starThemeFirstPaintScript,
} from '@star-ng/ui/theme';
import { StarThemeSwitch } from '@star-ng/ui/theme-switch';
import { DOCS } from '../shared/docs';

@Component({
  selector: 'docs-dark-mode-guide',
  imports: [DOCS, StarButton, StarThemeSwitch, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Dark mode"
      lead="The tokens have light and dark values. The data-theme attribute on the html element selects them. The theme service and the first-paint script are optional helpers."
      importFrom="import { StarThemeService, starThemeFirstPaintScript } from '@star-ng/ui/theme';"
    >
      <h2>How the theme is selected</h2>
      <ul>
        <li><code>&lt;html data-theme="light"&gt;</code> or no attribute: light values.</li>
        <li><code>&lt;html data-theme="dark"&gt;</code>: dark values.</li>
      </ul>
      <p>
        An application with one fixed theme sets the attribute in <code>index.html</code> and needs
        nothing else.
      </p>

      <h2>StarThemeService</h2>
      <p>
        The service keeps the user's choice (<code>system</code>, <code>light</code> or
        <code>dark</code>) in <code>localStorage</code>, follows the operating system setting when
        the choice is <code>system</code>, and sets <code>data-theme</code>. Inject it in the root
        component so that it runs on every page.
      </p>
      <docs-code [code]="service" label="Theme service use" />

      <docs-example heading="Try it" source="dark-mode/try">
        <star-button variant="secondary" (pressed)="theme.setMode('system')">System</star-button>
        <star-button variant="secondary" (pressed)="theme.setMode('light')">Light</star-button>
        <star-button variant="secondary" (pressed)="theme.setMode('dark')">Dark</star-button>
        <p class="docs-output" role="status">
          Choice: {{ theme.mode() }}. Theme in use: {{ theme.theme() }}.
        </p>
      </docs-example>

      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            StarThemeService
          </caption>
          <thead>
            <tr>
              <th scope="col">Member</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row"><code>mode: Signal&lt;StarThemeMode&gt;</code></th>
              <td>The user's choice: <code>'system' | 'light' | 'dark'</code>.</td>
            </tr>
            <tr>
              <th scope="row"><code>theme: Signal&lt;'light' | 'dark'&gt;</code></th>
              <td>The theme in use now.</td>
            </tr>
            <tr>
              <th scope="row"><code>setMode(mode)</code></th>
              <td>Applies and saves a choice.</td>
            </tr>
            <tr>
              <th scope="row"><code>STAR_THEME_STORAGE_KEY</code></th>
              <td>
                Injection token of the <code>localStorage</code> key. Default:
                <code>'star-theme'</code>.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Theme switch control</h2>
      <p>
        <code>StarThemeSwitch</code> is a ready control for the choice: a small speed dial with
        System, Light and Dark. Its button shows the icon of the current choice and has the name
        "Theme: Dark" (or Light, or System). It calls <code>StarThemeService.setMode</code>, so the
        choice is applied and saved. It lives in its own entry point,
        <code>@star-ng/ui/theme-switch</code>, because it needs the menu and utility code that
        <code>@star-ng/ui/theme</code> does not use.
      </p>
      <docs-example
        heading="Theme switch"
        source="dark-mode/switch"
        note="The four texts (Theme, System, Light, Dark) come from STAR_UI_TEXT, so they follow the language settings of the application. The control is not positioned: the host places it."
      >
        <div class="docs-row" style="min-height: 11rem; align-items: flex-start">
          <star-theme-switch />
        </div>
      </docs-example>
      <p>To fix it in a corner of the page, give the element a position in your stylesheet:</p>
      <docs-code [code]="switchCss" label="Fixed corner" />
      <p>
        The page <a routerLink="/controls/theme-switch">Theme switch</a> shows the API and the keys.
      </p>

      <h2>First-paint script</h2>
      <p>
        The service starts with the application. Before that, the browser has already painted the
        page. A user with a dark choice would see a light frame first. To prevent this, put this
        small script in the <code>&lt;head&gt;</code> of <code>index.html</code>, before the
        stylesheets. It uses the same rule and the same storage key as the service.
      </p>
      <docs-code [code]="script" label="First-paint script" />
      <p>
        <code>starThemeFirstPaintScript(storageKey?)</code> returns the same script as a string, for
        a build step or a server-side template that writes <code>index.html</code>.
      </p>
      <p>
        This inline form does not run under a strict Content Security Policy. See the next section
        for three forms that do.
      </p>

      <h2 id="csp">Content Security Policy</h2>
      <p>
        A strict policy (<code>script-src 'self'</code> with no <code>'unsafe-inline'</code>) blocks
        the inline script above. There are three ways to run the first-paint script under such a
        policy. All three give the same result. The docs application you read now uses the first
        one.
      </p>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            Forms of the first-paint script under a policy
          </caption>
          <thead>
            <tr>
              <th scope="col">Form</th>
              <th scope="col">Choose it when</th>
              <th scope="col">Policy line</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">1. External file</th>
              <td>
                Most applications. The page is a static <code>index.html</code> from the build. It
                needs one extra request, which the browser caches.
              </td>
              <td><code>script-src 'self'</code></td>
            </tr>
            <tr>
              <th scope="row">2. Hash</th>
              <td>
                The page is static and you want no extra request, or you cannot add a file. The
                policy must change when the script text changes.
              </td>
              <td><code>script-src 'self' 'sha256-...'</code></td>
            </tr>
            <tr>
              <th scope="row">3. Nonce</th>
              <td>
                A server renders the page and makes a new random value for each response. A static
                file cannot use a nonce.
              </td>
              <td><code>script-src 'self' 'nonce-...'</code></td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3>1. External file</h3>
      <p>
        The package ships the script as the file
        <code>@star-ng/ui/theme/star-theme-first-paint.js</code>. Copy it into the build with an
        <code>assets</code> entry in <code>angular.json</code> (in the <code>assets</code> list of
        the <code>build</code> options), then load it in the <code>&lt;head&gt;</code>. Use a
        classic script: no <code>defer</code>, no <code>async</code>, no <code>type="module"</code>.
        The browser must run it before the first paint, so put it before the stylesheets.
      </p>
      <docs-code [code]="cspAssets" label="angular.json assets entry" />
      <docs-code [code]="cspFile" label="Script element of the file form" />
      <p>
        The file reads the storage key from the <code>data-storage-key</code> attribute of its own
        element (default <code>star-theme</code>), so a custom key needs no inline code. Use the
        same value as <code>STAR_THEME_STORAGE_KEY</code>. The text of the file is the same as
        <code>starThemeFirstPaintScript()</code>, except for the way it finds the key. A unit test
        keeps the two in step.
      </p>

      <h3>2. Hash</h3>
      <p>
        The browser hashes the exact bytes (UTF-8) between <code>&lt;script&gt;</code> and
        <code>&lt;/script&gt;</code>: no space and no line break before or after the text. The hash
        of <code>starThemeFirstPaintScript()</code> with the default key is the constant
        <code>STAR_THEME_FIRST_PAINT_HASH</code>, with the quotes.
      </p>
      <docs-code [code]="cspHash" label="Hash form" />
      <p>For a custom storage key, compute the hash for that key. In code:</p>
      <docs-code [code]="cspHashCustom" label="Hash of a custom key" />
      <p>
        Or in a shell, from the exact text. Write it with <code>printf '%s'</code>, because
        <code>echo</code> adds a line break and so it changes the hash:
      </p>
      <docs-code [code]="cspHashShell" label="Hash in a shell" />
      <p>
        If anything changes the text, for example a formatter or a minifier, the browser blocks the
        script and shows the expected hash in the console.
      </p>

      <h3>3. Nonce</h3>
      <p>
        The server makes a new random nonce for each response and puts it in the
        <code>Content-Security-Policy</code> header and in the script element.
        <code>starThemeFirstPaintElement(nonce, storageKey?)</code> returns the full element text.
        It throws an error when the nonce is not base64 or base64url text, so a nonce can not add
        markup to the page.
      </p>
      <docs-code [code]="cspNonce" label="Nonce form (server)" />
      <p>
        A <code>&lt;meta&gt;</code> policy in a static <code>index.html</code> can not use a nonce:
        the value would be the same for every user, and then it gives no protection.
      </p>

      <h3>Styles</h3>
      <p>
        Angular adds the styles of each component to the page as inline <code>&lt;style&gt;</code>
        elements when the component is first used, and the docs examples also use
        <code>style</code> attributes. So <code>style-src</code> needs <code>'unsafe-inline'</code>,
        or a nonce on the style elements: set <code>ngCspNonce="..."</code> on the root element and
        provide <code>CSP_NONCE</code> (server-rendered pages). The global stylesheet is a file and
        <code>'self'</code> allows it. <code>script-src</code> stays strict in both cases.
      </p>
      <p>
        In a production build, set
        <code>"optimization": &#123; "styles": &#123; "inlineCritical": false &#125; &#125;</code>.
        The default inlines the critical styles and adds a small inline script that switches the
        main stylesheet on. A strict policy blocks that script and the page then loses its styles.
      </p>
      <h3>Untrusted HTML and the editor</h3>
      <p>
        When the Angular sanitizer parses HTML that has an event handler attribute, such as
        <code>onclick="alert(1)"</code>, a strict policy reports a violation in the console. The
        handler is blocked and the sanitizer removes it, so the page stays safe. The only report in
        the docs application comes from the sanitizer example of the Editor page. The policy below
        allows the hash of that one text (<code>script-src-attr</code>), so the console stays clean.
        Your application does not need this line.
      </p>
      <docs-code [code]="cspPolicy" label="Policy of the docs application" />
    </docs-page>
  `,
})
export class DarkModeGuide {
  protected readonly theme = inject(StarThemeService);

  protected readonly service = `import { Component, inject } from '@angular/core';
import { StarThemeService } from '@star-ng/ui/theme';

@Component({ selector: 'app-root', template: '<router-outlet />' })
export class App {
  // Injecting the service is enough: it applies the saved choice.
  private readonly theme = inject(StarThemeService);

  useDark(): void {
    this.theme.setMode('dark'); // 'system' | 'light' | 'dark'
  }
}`;

  protected readonly switchCss = `star-theme-switch {
  position: fixed;
  top: var(--star-space-3);
  inset-inline-end: var(--star-space-4);
  z-index: 40;
}`;

  protected readonly cspAssets = `{
  "glob": "star-theme-first-paint.js",
  "input": "node_modules/@star-ng/ui/theme",
  "output": "."
}`;

  protected readonly cspFile = `<head>
  <meta charset="utf-8" />
  <base href="/" />
  <!-- Classic script in the head: no defer, no async, no type="module". -->
  <script src="star-theme-first-paint.js"></script>
  <!-- With a custom storage key: -->
  <!-- <script src="star-theme-first-paint.js" data-storage-key="my-app-theme"></script> -->
  <!-- stylesheets come after -->
</head>`;

  protected readonly cspHash = `Content-Security-Policy: script-src 'self' ${STAR_THEME_FIRST_PAINT_HASH}

<script>${starThemeFirstPaintScript()}</script>`;

  protected readonly cspHashCustom = `import { starThemeFirstPaintHash, starThemeFirstPaintScript } from '@star-ng/ui/theme';

// Build step or server start: Node.js 20 or later, or a browser in a secure context.
const hash = await starThemeFirstPaintHash('my-app-theme'); // "'sha256-...'", with the quotes
const policy = "script-src 'self' " + hash;
const html = '<script>' + starThemeFirstPaintScript('my-app-theme') + '</script>';`;

  protected readonly cspHashShell = `printf '%s' "$SCRIPT_TEXT" > first-paint.txt
openssl dgst -sha256 -binary first-paint.txt | openssl base64 -A
# or, with Node.js:
node -e "process.stdout.write(require('crypto').createHash('sha256').update(require('fs').readFileSync('first-paint.txt')).digest('base64'))"
# Policy value: 'sha256-' plus the output, in single quotes.`;

  protected readonly cspNonce = `import { randomBytes } from 'node:crypto';
import { starThemeFirstPaintElement } from '@star-ng/ui/theme';

app.get('*', (request, response) => {
  const nonce = randomBytes(16).toString('base64'); // new for each response
  response.setHeader('Content-Security-Policy', "script-src 'self' 'nonce-" + nonce + "'");
  response.send(
    '<!doctype html><html><head>' +
      starThemeFirstPaintElement(nonce) + // <script nonce="...">...</script>
      '</head><body><app-root></app-root></body></html>',
  );
});`;

  protected readonly cspPolicy = `<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  script-src-attr 'unsafe-hashes' 'sha256-bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI=';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self'" />`;

  protected readonly script = `<script>
  (function () {
    var mode = 'system';
    try {
      mode = localStorage.getItem('star-theme') || 'system';
    } catch (e) {}
    var dark =
      mode === 'dark' ||
      (mode !== 'light' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  })();
</script>`;
}
