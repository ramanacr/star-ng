import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { StarButton } from 'star-ng/button';
import { StarThemeService } from 'star-ng/theme';
import { DOCS } from '../shared/docs';

@Component({
  selector: 'docs-dark-mode-guide',
  imports: [DOCS, StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Dark mode"
      lead="The tokens have light and dark values. The data-theme attribute on the html element selects them. The theme service and the first-paint script are optional helpers."
      importFrom="import { StarThemeService, starThemeFirstPaintScript } from 'star-ng/theme';"
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
    </docs-page>
  `,
})
export class DarkModeGuide {
  protected readonly theme = inject(StarThemeService);

  protected readonly service = `import { Component, inject } from '@angular/core';
import { StarThemeService } from 'star-ng/theme';

@Component({ selector: 'app-root', template: '<router-outlet />' })
export class App {
  // Injecting the service is enough: it applies the saved choice.
  private readonly theme = inject(StarThemeService);

  useDark(): void {
    this.theme.setMode('dark'); // 'system' | 'light' | 'dark'
  }
}`;

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
