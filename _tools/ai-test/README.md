# ChessDepth AI test kit

Offline copy of the browser pipeline (`sim.mjs`, follows assets/js/ai/app.js) and benchmarks.

    npm i pngjs jpeg-js                       # in this folder, with "type": "module" in package.json
    node real.mjs [detect.js]                 # the real images (site examples + uploads) with known answers
    python3 gen_test.py book btest 60 7       # needs lila/public/piece (git sparse checkout) and the puzzle shards
    python3 gen_test.py screen stest 60 8
    node bench.mjs ../btest [detect.js|-] [guard|-] tag [fine]

v0.5 results (60 boards each): book diagrams 33 perfect (v0.4: 31), board found correctly 47 (45);
screen boards 48 perfect (48), 99.2% of squares (98.6%); all six real test images perfect.
