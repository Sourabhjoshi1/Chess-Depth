# Editing the ChessDepth website

The site is built by Jekyll on GitHub Pages. Every push to `main` rebuilds and publishes it.

| To change...                         | Edit this file                         |
|--------------------------------------|----------------------------------------|
| Phone, email, address, social links  | `_config.yml` (the `contact:` section) |
| Menu items (add/remove/reorder)      | `_data/navigation.yml` (the logo links home) |
| Header (top strip, logo, menu, demo button) | `_includes/header.html`, styles under "Header" in `assets/css/site.css` |
| Rook logo symbol                     | `_includes/logo-mark.html`             |
| Footer                               | `_includes/footer.html`                |
| `<head>` tags (SEO, fonts, ads)      | `_includes/head.html`                  |
| Overall page skeleton                | `_layouts/default.html`                |
| Home page content                    | `index.html`                           |
| Other pages' content                 | `pages/<name>.html`                    |
| Styles shared by every page          | `assets/css/site.css`                  |
| Styles for one page                  | `assets/css/pages/<name>.css`          |
| Shared JavaScript (menu, year, forms)| `assets/js/site.js`                    |
| Images                               | `assets/images/`                       |
| Blog articles                        | `_posts/YYYY-MM-DD-title.md`           |
| Books / tools / openings lists       | `_data/books.yml`, `_data/tools.yml`, `_data/openings.yml` |
| Student reviews (About page)         | `_data/reviews.yml`                    |
| Student Area (login + PDF downloads) | `pages/student.html`, `assets/js/student.js` |
| Firebase settings / course names     | `assets/js/firebase-config.js`         |
| Firebase security rules              | `firebase/storage.rules`, `firebase/firestore.rules` |

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

## Student Area PDFs
Students sign in with Google at `chessdepth.in/student/`. PDFs live in Firebase Storage
under `materials/<course-folder>/`. Upload new PDFs in the Firebase console; they appear
on the page automatically. Signed-in students are listed in Firestore under `students`.

## Writing a blog post
Create `_posts/2026-11-01-my-article-title.md` (date first, then the title in lowercase with dashes):

```
---
title: "My Article Title"
description: "One or two sentences shown on the blog list and in Google."
category: Tactics        # Tactics, Strategy, Openings, Endgames, Training, Psychology or Parents
level: Beginner          # optional
---

Write the article in Markdown. ## for headings, **bold**, - for lists.
```

It appears at `chessdepth.in/blog/my-article-title/` and on the blog list automatically.
Posts dated in the future stay hidden until that date.

**Chess diagrams:** put an SVG board in `assets/images/blog/` and add
`{% include board.html img="file-name-without-.svg" caption="White to move." %}`.
**Hidden answers:** `{% include answer.html text="**1.Nd6+!** wins the queen." %}`

## SEO and analytics
- **Page title and Google description:** the `title:` and `description:` lines at the top of each page or post.
  Keep titles under about 60 characters and descriptions under about 155.
- **Google Analytics:** paste your GA4 Measurement ID (G-XXXXXXXXXX) into `google_analytics` in `_config.yml`.
- **Google Search Console:** paste the HTML-tag verification code into `google_site_verification` in `_config.yml`.
- **Structured data** (what Google reads about the academy, courses, articles and breadcrumbs) is in `_includes/schema.html`.
  The course list for Google is in `_data/courses.yml`; keep it in step with the Courses page.
- **Styles:** the site uses a trimmed Tailwind CSS that is rebuilt automatically on every deploy
  (see `tailwind.config.js` and `.github/workflows/jekyll-gh-pages.yml`). Any Tailwind class you add to a page is picked up automatically.

## Chess Lab (paid membership)
- Pages: `pages/lab/` (public page at `/lab/`, tools at `/lab/tactics/`, `/lab/streak/`, `/lab/openings/`, `/lab/progress/`, admin at `/lab/admin/`).
- Price, payment link, launch offer end date (`free_until`) and admins: the `lab:` section in `_config.yml`.
  If you change `free_until`, also change the date in `promoActive()` in `firebase/firestore.rules` and republish the rules.
- **Giving someone access:** after they pay, open `chessdepth.in/lab/admin/`, sign in with an admin Google account, switch "Lab access" on for them (optional end date) and press Save.
- Puzzles: `assets/lab/puzzles/*.json` (Lichess, CC0) and `assets/lab/originals.json` (ChessDepth Originals:
  `[id, FEN with the solver to move, solution moves in UCI e.g. "e4d6 e8d8 d6b7", rating, themes, title]`).
- Opening courses: `assets/lab/openings.json`.
- Security rules: `firebase/firestore.rules` (paste into the Firebase console). The admin email is listed there too.
- Before Firebase is connected the Lab shows "opening soon". Add `?demo=1` to any Lab address to try everything
  in demo mode (stored only in that browser); `?demo=0` leaves demo mode.


## This week's quiz (Student Area)

Quizzes live in `_data/quizzes.yml`. Add the newest one at the top with its title, level, `opens` and `closes` dates and the Google Form link (`url`).
- Between `opens` and `closes` it shows as **This week's quiz** with a Start button (several can be open at once, e.g. one per level).
- After `closes` it moves to **Past quizzes**; add a `key` link if you want to share answers afterwards.
- No quiz open → students see a friendly "no quiz this week" note.

## Reviews (live, from Firebase)

- Anyone signed in with Google can leave **one review per item** (stars + text), edit it or delete it. Reviews appear straight away.
- Reviews by students who linked their enrollment number in the Chess Lab show a **Verified student** badge automatically.
- Moderate at **/lab/admin/** → *Reviews*: hide only abuse, spam, advertising or personal details, never a review for being negative. Reply publicly instead.
- Where they appear: coach cards (Coaches), course cards (Courses), the Chess Lab page, free/available Shop products, the About page (academy), and the home page (newest academy reviews, hidden until there is at least one).
- To add reviews to something new: `{% include reviews.html target="course:my-new-course" title="My New Course" %}` (full) or add `summary=true` (stars + count with a pop-up). Targets look like `academy`, `lab`, `coach:<slug>`, `course:<slug>`, `product:<slug>`. **Never rename a target**, or its reviews disappear.
- Never type ratings or review counts into a page by hand. They must come from real reviews.
- After changing `firebase/firestore.rules`, paste it into Firebase console → Firestore → Rules → Publish.

## Shop (digital products, sold through Gumroad)

- The shop is at **/shop/**. Each product is one file in `_products/` (for example `_products/checkmate-patterns.md`) and gets its own page at `/shop/<file-name>/`.
- To add a product, copy an existing file, rename it and change the details at the top:
  - `title`, `description` (one sentence), `level`, `format`, `size` (leave `""` to hide)
  - `category`: one of `worksheets`, `plans`, `puzzles`, `openings` (names and order are in `_data/shop.yml`)
  - `order`: position inside its category
  - `glyph`: the chess piece shown on the cover (♔♕♖♗♘♙♚♛♜♝♞♟)
  - `includes`: the bullet list under "What's inside"; `for`: who it is for
  - `badge`: optional label on the cover, e.g. `Free` or `New`
  - The text below the second `---` is the longer description.
  - If a line's text contains a colon (`:`), put the whole text in double quotes, e.g. `title: "90-Day Plan: 1200–1600"`. Otherwise the product's settings are ignored.
- **To start selling a product:**
  1. Create the product on Gumroad, upload the PDF and set the price (Gumroad shows rupees to buyers in India).
  2. Copy the product's Gumroad link (looks like `https://chessdepth.gumroad.com/l/abcde`) into `gumroad:`.
  3. Put the price in `price_inr:` (and optionally `price_usd:`). For a free product use `price_inr: "0"` and set the price to 0+ on Gumroad.
  Until `gumroad:` is filled in, the product shows **Coming soon** with a **Notify me** WhatsApp button.
- **Free direct download (no Gumroad):** put the PDF in the `downloads/` folder and set `download: "/downloads/file-name.pdf"` with `price_inr: "0"`. The page shows **Download free**. To move it to Gumroad later, clear `download:` and fill in `gumroad:`.
- Analytics: free downloads are recorded as `shop_free_download`.
- Your Gumroad store link can go in `shop: gumroad_profile:` in `_config.yml` to show "See all products on Gumroad".
- Analytics: "Buy now" clicks are recorded as `begin_checkout` and "Notify me" clicks as `shop_notify_click`, with the product name.


## Important: the built stylesheet is committed

`assets/css/tailwind.min.css` is generated from the Tailwind classes used in the pages and is **committed to the repository**.
GitHub's automatic "pages build and deployment" also publishes the site and does not build this file, so it must be in the repo.
If you add new Tailwind classes to a page, rebuild it before committing:

    npx tailwindcss@2.2.19 -c tailwind.config.js -i src/tailwind.css -o assets/css/tailwind.min.css --minify

(Best fix: in GitHub → Settings → Pages, set **Source** to **GitHub Actions**, so only the site's own workflow publishes.)


## Dollar prices

Dollar prices are adjusted for purchasing power: **1.5 × (₹ ÷ 100)**, i.e. about ₹67 = $1, rounded to a clean price (e.g. ₹5,999 → $90, ₹4,500 → $69, ₹19,999 → $299).
