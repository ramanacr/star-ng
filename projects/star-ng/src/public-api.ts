/*
 * Public API of star-ng. Every control group is also a secondary entry point
 * (for example `star-ng/button`); import from there to keep bundles small.
 * `star-ng/transloco` is not re-exported here: it needs the optional peer `@jsverse/transloco`.
 */
export * from 'star-ng/badge';
export * from 'star-ng/button';
export * from 'star-ng/checkbox';
export * from 'star-ng/core';
export * from 'star-ng/field';
export * from 'star-ng/radio';
export * from 'star-ng/spinner';
export * from 'star-ng/tag';
export * from 'star-ng/theme';
export * from 'star-ng/toggle-switch';
