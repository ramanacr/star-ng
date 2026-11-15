# Security policy

## Supported versions

Only the latest `0.x` release of `@star-ng/ui` gets security fixes. Update to the latest version before you report a problem.

## Report a vulnerability

Do not open a public issue for a vulnerability. Use GitHub private vulnerability reporting:

1. Open <https://github.com/ramanacr/star-ng>.
2. Select the **Security** tab.
3. Select **Report a vulnerability**.
4. Fill in the form.

Include this information:

- The affected version of `@star-ng/ui`.
- The control or entry point that is affected.
- Steps to reproduce the problem, or a small example.
- The impact that you expect.
- Your browser and its version, if the problem depends on it.

You get an answer in the report thread. This project has no fixed response time.

## Scope

In scope:

- The library: the controls, the styles and the first-paint script.
- The build output: the package that npm serves.

Out of scope:

- Your application, your server and your Content Security Policy.
- Vulnerabilities in dependencies. Report them to the dependency.
- The docs site, unless the problem is in a library control that it shows.

## Security notes for users

- **Editor.** `star-editor` sanitizes HTML for display with the Angular `DomSanitizer`. This protects the editing area only. A value that your code sets is not sanitized until the user edits the area. Sanitize the HTML again on the server before you store it. Never mark the value as trusted without sanitizing it.
- **File upload.** `star-file-upload` checks the file type and size in the browser only. The checks help the user. They do not protect the server. Check the type, the size and the content again on the server.
- **Content Security Policy and the first-paint script.** An inline script is blocked by `script-src 'self'` without `'unsafe-inline'`. Run the first-paint script in one of three forms: as an external file (`script-src 'self'`), with a hash (`'sha256-...'`), or with a nonce (`'nonce-...'`). The guide "Dark mode" on the docs site shows each form.
- **Table print export.** The print frame uses inline style. It needs `'unsafe-inline'` in `style-src`. Without it, the print still works, but the table loses its own style.
