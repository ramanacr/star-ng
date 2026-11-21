# Third-party notices

This file lists the third-party code and assets in StarNG and their licences. The package `@star-ng/ui` contains this file.

## Code in the package `@star-ng/ui`

### Aurora RTE

Parts of the editor (`@star-ng/ui/editor`) are ported from Aurora RTE, <https://github.com/ramanacr/aurora-rte>. Each ported file names its Aurora RTE source in a comment at the top. Aurora RTE has this licence:

```text
MIT License

Copyright (c) 2026 Ramana Reddy Chamakura

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The package bundles no other third-party code, fonts, icons or images. Its runtime dependency `tslib` and its peer dependencies install separately, each with its own licence.

## Optional peer dependency

### Phosphor Icons (`@phosphor-icons/web`)

The default icons of the controls are class names of Phosphor Icons. The package does not contain the icon fonts: your application installs `@phosphor-icons/web` (optional peer dependency) and loads its style sheets. Licence: MIT, from <https://github.com/phosphor-icons/web>.

```text
MIT License

Copyright (c) 2020-2021 Phosphor Icons

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Docs site (not in the package)

The docs application bundles these packages in its build output. Each keeps its own licence:

| Package                                          | Licence    |
| ------------------------------------------------ | ---------- |
| Angular (`@angular/*`), Angular CDK              | MIT        |
| RxJS                                             | Apache-2.0 |
| tslib                                            | 0BSD       |
| Phosphor Icons (`@phosphor-icons/web`) fonts/CSS | MIT        |

The map example can load map tiles from OpenStreetMap only after you switch them on. The tiles are not in the build. Their use follows the OpenStreetMap tile usage policy and the attribution rules of the OpenStreetMap Foundation.

## Names of other products

StarNG compares its API with other component libraries by name only. See the section "Trademarks" in [README.md](README.md).
