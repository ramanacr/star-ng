import { Clipboard } from '@angular/cdk/clipboard';
import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT, inject, PLATFORM_ID, Service } from '@angular/core';

/**
 * Copies text to the clipboard (CDK `Clipboard`; PrimeNG has no service). It uses the async
 * `navigator.clipboard.writeText` when the browser has it and allows it, else the CDK copy through
 * a hidden text area. On the server it does nothing and resolves with `false`.
 *
 * ```ts
 * const done = await inject(StarClipboard).copy('ORD-1042');
 * ```
 *
 * The `starCopy` directive (`@star-ng/ui/utility`) wraps it for a button and announces the result.
 */
@Service()
export class StarClipboard {
  private readonly cdk = inject(Clipboard);
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Copies `text`. Resolves with `true` when the text is on the clipboard. */
  async copy(text: string): Promise<boolean> {
    if (!this.browser) return false;
    const clipboard = this.document.defaultView?.navigator?.clipboard;
    if (typeof clipboard?.writeText === 'function') {
      try {
        await clipboard.writeText(text);
        return true;
      } catch {
        // Not allowed (no user gesture, an iframe without permission): try the CDK fallback.
      }
    }
    try {
      return this.cdk.copy(text);
    } catch {
      return false;
    }
  }
}
