// First-paint text direction of the docs application. A static file (no inline script, because
// the Content Security Policy is script-src 'self'), loaded with a blocking <script src> in the
// <head> of index.html. The prerendered pages always say dir="ltr". This script sets dir="rtl"
// on <html> before the first paint when the user saved that choice, so the layout does not flip
// when the application starts. It must use the same key and value as DIRECTION_KEY in
// src/app/app.ts. It does nothing when no right-to-left choice is saved or storage is blocked.
(function () {
  try {
    if (localStorage.getItem('star-direction') === 'rtl') {
      document.documentElement.setAttribute('dir', 'rtl');
    }
  } catch (e) {
    // Storage can be blocked: keep the default direction.
  }
})();
