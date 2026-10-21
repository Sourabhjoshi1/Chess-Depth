# Editing the ChessDepth website

The site is built by Jekyll on GitHub Pages. Every push to `main` rebuilds and publishes it.

| To change...                         | Edit this file                         |
|--------------------------------------|----------------------------------------|
| Phone, email, address, social links  | `_config.yml` (the `contact:` section) |
| Menu items (add/remove/reorder)      | `_data/navigation.yml`                 |
| Header (logo, menu, Free Demo button)| `_includes/header.html`                |
| Footer                               | `_includes/footer.html`                |
| `<head>` tags (SEO, fonts, ads)      | `_includes/head.html`                  |
| Overall page skeleton                | `_layouts/default.html`                |
| Home page content                    | `index.html`                           |
| Other pages' content                 | `pages/<name>.html`                    |
| Styles shared by every page          | `assets/css/site.css`                  |
| Styles for one page                  | `assets/css/pages/<name>.css`          |
| Shared JavaScript (menu, year, forms)| `assets/js/site.js`                    |
| Images                               | `assets/images/`                       |

## Adding a new page
Create `pages/<name>.html` starting with:

```
---
title: "Page Title | ChessDepth Academy"
description: "One sentence for Google."
permalink: /<name>/
---
  <section> ...your content... </section>
```

It gets the header and footer automatically and is live at `chessdepth.in/<name>/`.
Add it to `_data/navigation.yml` if it should appear in the menu.

Note: the page files only work after Jekyll builds them, so opening them directly
from your computer will not show the header or footer.
