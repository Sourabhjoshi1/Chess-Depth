# ♟️ ChessDepth Academy

**Live site: [www.chessdepth.in](https://www.chessdepth.in)**

ChessDepth Academy is an online chess academy and training platform based in Bhopal, India. We teach students to understand the *why* behind every move, through live classes with FIDE-rated coaches (including a Grandmaster), a structured curriculum, and free and paid training tools.

This repository is the full website: a Jekyll site published with GitHub Pages.

---

## What's on the site

| Area | What it does | Where |
| --- | --- | --- |
| **Home** | Overview, academy stats, course highlights, enquiry form | `index.html` |
| **Puzzle of the Day** | A new puzzle every day (India time), easy on Monday, hard on Sunday; hints, solution, daily streak, WhatsApp sharing | Home page `#daily` · `assets/js/daily.js` · `assets/lab/daily.json` |
| **Courses & fees** | Monthly one-to-one and group classes, fixed-length programmes, INR and USD prices | `pages/courses.html` |
| **About, Coaches, Contact** | Mission, story, coach profiles, contact details and map | `pages/` |
| **Resources & Blog** | Study roadmap, free tools (board editor, Lichess analyser), guides, book list, articles | `pages/resources.html`, `_posts/` |
| **Chess Lab** | Training membership: tactics trainer (26,000+ rated Lichess puzzles in 100-point rating shards, `assets/lab/puzzles/shards/`), Puzzle Streak with all-time leaderboard, 26 opening courses, progress dashboard with points and levels. Free for signed-in users until 21 Nov 2026 (launch offer) | `pages/lab/`, `assets/js/lab/` |
| **Student Area** | Google sign-in and free PDF study material for every course | `pages/student.html`, `assets/js/student.js` |
| **Shop** | Digital products (worksheet packs, improvement plans, puzzle collections, opening repertoires). Free direct downloads or Gumroad checkout | `pages/shop.html`, `_products/` |
| **Careers** | Open roles and Winter 2026 internships (Product Management, Quality Assurance) | `pages/careers.html`, `_data/jobs.yml` |
| **ChessDepth AI** | Coming soon: turn a photo or screenshot of a chess position into a playable board | `pages/ai.html` |

Every chess board on the site uses one shared component (`assets/js/lab/board.js`): drag **or** tap-to-move, legal-move hints and last-move highlights.

Night mode, mobile layouts, SEO (structured data, sitemap) and Google Analytics 4 events are built in across all pages.

---

## Tech stack

- **Jekyll 3** (GitHub Pages) with shared layouts and includes, `permalink: pretty` for clean URLs
- **Tailwind CSS 2.2.19**, trimmed to the classes the site uses (`src/tailwind.css` → `assets/css/tailwind.min.css`)
- **Vanilla JavaScript** (ES modules), no framework
- **Firebase** (Google sign-in + Firestore) for the Student Area and Chess Lab. Rules in `firebase/firestore.rules`
- **chessboard-element** (board display) and **chess.js** (rules), loaded from jsDelivr
- **Lichess puzzle database** (CC0) for the Chess Lab and Puzzle of the Day
- **Gumroad** for paid Shop products · **Google Analytics 4** · **Google AdSense**

---

## Repository layout

```
_config.yml          Site settings: contact details, Lab settings, analytics IDs, shop, collections
_layouts/            default, post (blog), product (shop)
_includes/           header, footer, head/SEO, schema, page banner, Lab bar, shop cards
_data/               navigation, courses, reviews, books, tools, openings, shop categories, jobs
_posts/              Blog articles (Markdown)
_products/           One file per Shop product
pages/               All pages (lab/ = Chess Lab)
assets/css/          site.css, dark.css, pages/*.css, tailwind.min.css (built, committed)
assets/js/           site.js, daily.js, student.js, resources.js, lab/*.js
assets/lab/          Puzzle sets, daily calendar, opening courses
downloads/           Free PDF downloads
firebase/            Firestore security rules
scripts/             make-daily.py (builds the Puzzle of the Day calendar)
shop-src/            Source files used to build Shop PDFs (not published)
.github/workflows/   Build + deploy to GitHub Pages
```

---

## Editing the site

Day-to-day editing (prices, coaches, products, internships, Lab settings, analytics) is documented in **[EDITING.md](EDITING.md)**. Important rules:

- **Prices:** dollar prices are adjusted for purchasing power, about ₹67 = $1, rounded to a clean price (e.g. ₹5,999 → $90).
- **Shop products:** one file per product in `_products/`. Text containing a colon must be in double quotes; the deploy stops with a clear message if a product file is broken.
- **Stylesheet:** `assets/css/tailwind.min.css` is committed. If you add new Tailwind classes, rebuild it before committing:
  ```
  npx tailwindcss@2.2.19 -c tailwind.config.js -i src/tailwind.css -o assets/css/tailwind.min.css --minify
  ```
- **Daily puzzles:** the calendar runs to 31 Dec 2027. Extend it with `python3 scripts/make-daily.py` (needs `pip install chess`).

### Running locally

```
bundle exec jekyll serve      # needs Ruby + the github-pages gem
```
Then open http://localhost:4000.

### Deploying

Every push to `main` is built and published by `.github/workflows/jekyll-gh-pages.yml`: it checks the Shop product files, builds the trimmed Tailwind CSS, builds Jekyll and deploys to GitHub Pages.
**Settings → Pages → Source should be "GitHub Actions"**, so only this workflow publishes the site.

---

## Roadmap

### Now: 23 Oct – 30 Nov 2026

| Week | Focus |
| --- | --- |
| 23–31 Oct | Connect Firebase so the Chess Lab and Student Area go live; email sign-up; ChessDepth team on Lichess with a free weekly arena |
| 1–7 Nov | **ChessDepth AI v0.1**: upload a screenshot or digital diagram, get a playable board or open it in Lichess |
| 8–14 Nov | AI accuracy improvements and "turn this page into a puzzle set" for worksheets; weekly puzzle email |
| 15–21 Nov | Chess Lab push before the launch offer ends (21 Nov); decide Lab pricing; second Shop product |
| 22–30 Nov | AI v0.3 (stretch): read photos of physical books; select Winter 2026 interns |

**Targets for 30 Nov:** 50 Chess Lab students · 30 regular Daily Puzzle solvers · 100 email subscribers · 50 Lichess team members · AI beta reading 9 of 10 clean screenshots correctly.

### Next (2027)

- **ChessDepth AI**: book pages and worksheets into drillable puzzle sets; coach tools that turn printed worksheets into online assignments; an open-source core and community-contributed training data
- **Coach tools**: homework, auto-graded quizzes and progress reports for parents, for ChessDepth and other small academies
- **Asynchronous game reviews**: students upload games and get annotated reviews from titled coaches
- **Community**: weekly Lichess arenas, Daily Puzzle leaderboard, build-in-public updates
- **International students**: classes in UK, US and Singapore time zones; international card payments
- **More Shop products**: checkmate patterns, tactics by theme, endgame workbook, opening repertoires, 90-day improvement plans

---

## Credits

- Puzzles: [Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0)
- Boards: [chessboard-element](https://github.com/justinfagnani/chessboard-element) (MIT) and [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause)
- Fonts: Poppins and EB Garamond (Google Fonts) · Icons: Font Awesome

## Contributing

See [Contributing.md](Contributing.md). Bug reports and suggestions are welcome as GitHub issues.

## License

Code: [MIT](LICENSE) © 2026 Sourabh K. Joshi. Course content, worksheets and Shop products © ChessDepth Academy, all rights reserved.

## Contact

📞 +91 98230 29262 · ✉️ info@chessdepth.in · 📍 Bhopal, Madhya Pradesh, India · [Instagram](https://www.instagram.com/chessdepth/)
