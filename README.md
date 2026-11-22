<p align="center">
  <a href="https://www.chessdepth.in"><img src="assets/images/apple-touch-icon.png" width="84" alt="ChessDepth logo"></a>
</p>

<h1 align="center">ChessDepth</h1>

<p align="center"><b>Think Deep. Play Deeper!</b><br>
Live online chess classes, a free training lab and an AI that reads chess diagrams.</p>

<p align="center">
  <a href="https://www.chessdepth.in"><b>www.chessdepth.in</b></a> ·
  <a href="https://www.chessdepth.in/lab/">Chess Lab</a> ·
  <a href="https://www.chessdepth.in/ai/">ChessDepth AI</a> ·
  <a href="https://www.chessdepth.in/blog/">Blog</a>
</p>

<p align="center">
  <a href="https://github.com/Sourabhjoshi1/Chess-Depth/actions/workflows/jekyll-gh-pages.yml"><img src="https://github.com/Sourabhjoshi1/Chess-Depth/actions/workflows/jekyll-gh-pages.yml/badge.svg" alt="Deploy status"></a>
  <img src="https://img.shields.io/badge/built%20with-Jekyll-cc0000" alt="Built with Jekyll">
  <img src="https://img.shields.io/badge/code-MIT-4f46e5" alt="MIT licence">
</p>

---

ChessDepth Academy is an online chess academy from Bhopal, India. We teach children (from about age 5) and adults, from first moves to tournament play, in live one-to-one and small-group classes with FIDE-rated coaches, including **GM Daniel Gormally** and **IM Deboushnik De**. Our aim is for students to understand *why* a move is good, not just remember it.

This repository is the whole website: a Jekyll site built and deployed to GitHub Pages by GitHub Actions. Contributions are welcome; see [Contributing](#contributing).

## Contents

- [What's on the site](#whats-on-the-site)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Tools and generators](#tools-and-generators)
- [Editing and deploying](#editing-and-deploying)
- [Roadmap](#roadmap)
- [Credits](#credits) · [Contributing](#contributing) · [Licence](#licence) · [Contact](#contact)

---

## What's on the site

### The academy

| Page | What it covers | Source |
| --- | --- | --- |
| **Live Classes** | One-to-one (from ₹5,600 / US$90 a month) and group classes of 2 to 4 (₹2,999 / US$60), four levels, how to pay | `pages/courses.html` |
| **Curriculum** | Beginner, Intermediate, Advanced and Elite, three stages each, every topic and quiz | `pages/curriculum.html`, `_data/curriculum.yml` |
| **Classes for kids** | A parents' guide: ages, the free demo class, FAQ | `pages/kids.html` |
| **Country pages** | USA and Canada, UK and Europe, UAE, Saudi Arabia, Qatar, Singapore: local class times, US$ fees, hreflang | `pages/regions/`, `_data/regions.yml` |
| **Coaches, About, Register, Contact** | The team, mission, reviews, registration form, careers | `pages/` |
| **Student Area** | Google sign-in, enrolment numbers that unlock quizzes, PDF study material | `pages/student.html`, `assets/js/student.js` |
| **ChessDepth Assistant** | A scripted chat that asks a few questions and recommends a class, with fees and links | `assets/js/assistant.js` |

### Free training tools

| Tool | What it does | Source |
| --- | --- | --- |
| **Chess Lab** | 68 interactive courses, a positional-play path, a tactics trainer (26,000+ rated Lichess puzzles), **Depth Dive** (puzzles get harder until your first mistake), **Depth Sprint** (timed), an endgame trainer against Stockfish, a coordinates trainer, points, levels (Pawn to King) and a progress page | `pages/lab/`, `assets/js/lab/` |
| **Opening courses** | 26 openings for White and Black, each with a main line and 2 to 3 **branches** (63 in total). Learn or practise one line, or play the **Whole opening** with the lines in random order | `assets/lab/openings.json`, `_tools/opening-branches/` |
| **Blindfold trainer** | 10 visualisation drills, a 28-day plan, a daily blindfold puzzle, games against Stockfish, four printable workbooks | `pages/blindfold.html` |
| **Puzzle of the Day** | A new puzzle every day (India time), easier on Monday, harder by Sunday | `assets/js/daily.js`, `assets/lab/daily.json` |
| **ChessDepth AI** (beta) | Reads a screenshot, book diagram or photo of a printed board and gives a playable board and FEN, entirely in the browser | `pages/ai.html`, `assets/js/ai/` |
| **Free resources** | Study roadmap, score sheets, Lichess game analyser, board editor, guides, book list | `pages/lab/resources.html` |

Every board on the site uses one shared component (`assets/js/lab/board.js`): drag or tap to move, legal-move hints and last-move highlights. Dark mode, mobile layouts, structured data and Google Analytics 4 events work across every page.

### ChessDepth AI, in short

The browser finds the board, cuts it into 64 squares and reads each one with two small neural networks (float16 weights, under 0.4 MB each) that check each other, then applies chess rules to tidy the result. **v0.6** (Nov 2026) was trained on squares from 34 piece styles: book diagrams, phone photos of printed pages, screen boards and wooden boards. On 60 test book diagrams it reads 49 perfectly (up from 33 in v0.5). A new version is only released if all the real test photos still read perfectly. Test and training kits: `_tools/ai-test/`, `_tools/ai-train/`.

### Shop and content

- **Shop:** 19 products, 9 of them free PDFs (Opening Basics, Understanding Pawn Structures, blindfold workbooks…). Paid books are sold through [Gumroad](https://chessdepth.gumroad.com). Source: `_products/`.
- **Blog:** 18 articles on improvement, teaching and chess news (`_posts/`).
- **For AI assistants:** [`/llms.txt`](https://www.chessdepth.in/llms.txt) and [`/llms-full.txt`](https://www.chessdepth.in/llms-full.txt), built from the site's own pages and FAQs.

---

## Tech stack

- **Jekyll 3** on GitHub Pages (built by GitHub Actions), `permalink: pretty`
- **Tailwind CSS 2.2.19**, trimmed to the classes the site uses, plus hand-written CSS in `assets/css/`
- **Vanilla JavaScript** (ES modules), no framework
- **Firebase** (Google sign-in and Firestore) for the Student Area and Chess Lab; rules in `firebase/firestore.rules`
- **chessboard-element** and **chess.js** for boards, **Stockfish** (WebAssembly) for engine play
- **Python** (python-chess, reportlab, PyTorch) for the generators in `_tools/`
- **Gumroad** for paid products, **Google Analytics 4** for analytics

---

## Repository layout

```
_config.yml          Site settings: contact details, Lab settings, launch offer, analytics, collections
_data/               Navigation, curriculum, regions, reviews, books, jobs, shop categories…
_includes/           Header, footer, SEO/head, structured data, Lab bar, assistant, shared widgets
_layouts/            default, post (blog), product (shop)
_posts/              Blog articles (Markdown)
_products/           One file per shop product
_tools/              Generators and test kits (not published, see below)
pages/               Every page; pages/lab/ is the Chess Lab, pages/regions/ the country pages
assets/css/          site.css, dark.css, pages/*.css, tailwind.min.css (built, committed)
assets/js/           Site scripts; lab/ = Chess Lab, ai/ = ChessDepth AI
assets/lab/          Puzzle shards, daily calendar, opening courses
assets/ai/           AI model weights and example images
downloads/           Free PDFs
firebase/            Firestore security rules
scripts/             make-daily.py (Puzzle of the Day calendar)
llms.txt, llms-full.txt   Summaries for AI assistants (Liquid templates)
```

---

## Tools and generators

Everything in `_tools/` runs locally and is excluded from the published site.

| Folder | What it makes |
| --- | --- |
| `opening-branches/` | Opening branches: edit `branches.txt`, check with `check.py` (legality and Stockfish), then `build.py` writes them into `openings.json` |
| `ai-test/`, `ai-train/` | ChessDepth AI: a Node copy of the browser pipeline, benchmarks, training-data generator and trainer |
| `move-of-the-day/` | The daily "Move of the Day" image for social media (fixed template) |
| `opening-basics/`, `pawn-structures/`, `blindfold-pdfs/`, `score-sheet/` | The free PDF books and sheets |
| `certificates/`, `admission-letter/` | Student certificates and admission letters (real student data is git-ignored) |

---

## Editing and deploying

Day-to-day editing (prices, coaches, products, jobs, Lab settings) is in **[EDITING.md](EDITING.md)**. The main rules:

- **Prices:** class fees are set by hand: one-to-one from ₹5,600 / US$90 (depending on the coach), group ₹2,999 / US$60, all taxes included.
- **Shop products:** one file per product in `_products/`. Text containing a colon must be in double quotes; the deploy stops with a clear message if a product file is broken.
- **Tailwind:** `assets/css/tailwind.min.css` is committed. After adding new Tailwind classes, rebuild it:
  ```
  npx tailwindcss@2.2.19 -c tailwind.config.js -i src/tailwind.css -o assets/css/tailwind.min.css --minify
  ```
- **Daily puzzles:** the calendar runs to 31 Dec 2027; extend it with `python3 scripts/make-daily.py`.
- **Never commit real student data.** `.gitignore` excludes `_tools/**/students/` and `_tools/**/*-private.json`.

**Run locally:** `bundle exec jekyll serve` (needs Ruby and the `github-pages` gem), then open http://localhost:4000.

**Deploy:** every push to `main` runs `.github/workflows/jekyll-gh-pages.yml`, which checks the shop files, builds Tailwind and Jekyll, and publishes to GitHub Pages. In **Settings → Pages**, the source must be **GitHub Actions**.

---

## Roadmap

**Done in Oct–Nov 2026:** Chess Lab and Student Area live with Firebase · Puzzle of the Day · blindfold trainer · ChessDepth AI from v0.1 to v0.6 · opening branches and Whole opening mode · country pages for the USA, UK, Gulf and Singapore · free PDF books · chat assistant.

**Next:**
- **ChessDepth AI:** photos of physical boards, and turning book pages and worksheets into puzzle sets
- **Chess Lab:** pricing after the launch offer (free until 31 Dec 2026), more courses, puzzle themes
- **Coach tools:** homework, auto-graded quizzes and progress reports for parents
- **Apps:** ChessDepth for iOS and Android
- **Community:** weekly Lichess arenas and a Daily Puzzle leaderboard

---

## Credits

- Puzzles: [Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0)
- Boards: [chessboard-element](https://github.com/justinfagnani/chessboard-element) (MIT) and [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause)
- Engine: [Stockfish](https://stockfishchess.org/) (GPL-3.0), run in the browser
- AI training images use piece sets from [lichess-org/lila](https://github.com/lichess-org/lila), under their own licences
- Fonts: Poppins and EB Garamond (Google Fonts) · Icons: Font Awesome

## Contributing

Bug reports and ideas are welcome as [GitHub issues](https://github.com/Sourabhjoshi1/Chess-Depth/issues). For pull requests, see [Contributing.md](Contributing.md); security reports go through [SECURITY.md](SECURITY.md).

## Licence

Code: [MIT](LICENSE) © 2026 Sourabh Joshi. Course content, worksheets, books and shop products © ChessDepth Academy, all rights reserved.

## Contact

📞 +91 98230 29262 · ✉️ info@chessdepth.in · 📍 Bhopal, Madhya Pradesh, India · [Instagram](https://www.instagram.com/chessdepth/) · [WhatsApp community](https://chat.whatsapp.com/FlMZyNdMU9SEyJlKKclmon) · [Lichess team](https://lichess.org/team/chessdepth) · [Chess.com club](https://www.chess.com/club/chessdepth)
