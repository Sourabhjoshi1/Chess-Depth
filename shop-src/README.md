# Shop product sources

The files used to build each Shop PDF. Not published on the website.

## tactics-starter

- `chosen.json`: the 30 puzzles (positions from the Lichess puzzle database, CC0).
- `text.py`: the hint and explanation for each puzzle.
- `pack.css`: the design. `build.py` writes `pack.html`; `pdf.js` prints it to PDF with Playwright/Chromium.
- Fonts: Poppins (latin, weights 400–800) as woff2 files in a `fonts/` folder next to `pack.css`.

To rebuild: `python3 build.py && node pdf.js` (needs `pip install chess` and Playwright).
