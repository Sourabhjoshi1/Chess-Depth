# Blindfold practice workbooks

Four free PDFs in /downloads/, listed in _data/blindfold_pdfs.yml and shown on /blindfold/ and in the Student Area.

1. `puzzles.py N min max count seed out.json` makes mate-in-N puzzles from small random positions and keeps only those with exactly one winning first move (checked with Stockfish).
2. `python3 build.py OUTDIR` builds the four PDFs. Run it from this folder so it finds the puzzle files.
