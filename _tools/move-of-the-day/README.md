# Move of the Day image

Makes a 1080 x 1350 ChessDepth "Move of the Day" image (good for Instagram, WhatsApp and LinkedIn).

1. Copy `example.json`, change the date, FEN, move, players, event and explanation.
2. Run `python3 motd.py myday.json` (needs `python-chess` and `cairosvg`).
3. The PNG appears as `ChessDepth-Move-of-the-Day-<date>.png`.

The script checks that the move and the follow-up line are legal before drawing.
The board is shown from the side to move, with an arrow for the star move.
