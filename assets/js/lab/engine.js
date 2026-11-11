// ChessDepth Chess Lab - Stockfish 18 lite (WebAssembly) in a worker, loaded only when needed.
let worker = null, ready = null, queue = Promise.resolve();
export function loadEngine() {
  if (ready) return ready;
  ready = new Promise((resolve, reject) => {
    try { worker = new Worker("/assets/vendor/stockfish/stockfish-18-lite-single.js"); } catch (e) { reject(e); return; }
    const t = setTimeout(() => reject(new Error("Stockfish took too long to start")), 20000);
    worker.onmessage = (e) => { const l = String(e.data); if (l === "uciok") worker.postMessage("isready"); else if (l === "readyok") { clearTimeout(t); resolve(worker); } };
    worker.onerror = (e) => { clearTimeout(t); reject(e); };
    worker.postMessage("uci");
  }).catch((e) => { ready = null; throw e; });
  return ready;
}
// Best move at full strength. Score is from the side to move: { cp } or { mate } (positive = good for the mover).
export function bestMove(fen, movetime = 500) {
  const job = queue.then(() => loadEngine()).then((w) => new Promise((resolve) => {
    let score = null;
    w.onmessage = (e) => {
      const l = String(e.data);
      const m = l.match(/ score (cp|mate) (-?\d+)/); if (m && / pv /.test(l)) score = m[1] === "cp" ? { cp: Number(m[2]) } : { mate: Number(m[2]) };
      if (l.startsWith("bestmove")) resolve({ move: l.split(" ")[1], score });
    };
    w.postMessage("setoption name UCI_LimitStrength value false"); w.postMessage("setoption name Skill Level value 20");
    w.postMessage(`position fen ${fen}`); w.postMessage(`go movetime ${movetime}`);
  }));
  queue = job.catch(() => {});
  return job;
}
export function newGame() { if (worker) worker.postMessage("ucinewgame"); }
