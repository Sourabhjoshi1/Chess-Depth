/* ChessDepth Academy - Resources page: game analyser, board editor, opening tabs,
   endgame checklist and section navigation. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------------- Lichess game analyser ---------------- */
  var form = $("analysis-form");
  if (form) {
    var input = $("username-input"), countSel = $("games-count"), btn = $("analyze-button");
    var statusEl = $("analysis-status"), out = $("analysis-results");
    $("prefill-sample").addEventListener("click", function () { input.value = "DrNykterstein"; input.focus(); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = input.value.trim();
      if (!/^[A-Za-z0-9_-]{2,30}$/.test(name)) { statusEl.textContent = "Please enter a valid Lichess username."; return; }
      analyse(name, parseInt(countSel.value, 10) || 20);
    });

    async function analyse(name, max) {
      btn.disabled = true; out.classList.add("hidden"); out.innerHTML = "";
      statusEl.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i>Fetching games for ' + esc(name) + "…";
      try {
        var uRes = await fetch("https://lichess.org/api/user/" + encodeURIComponent(name));
        if (uRes.status === 404) { statusEl.textContent = "No Lichess account called \"" + name + "\" was found."; return; }
        if (uRes.status === 429) { statusEl.textContent = "Lichess is busy. Please wait a minute and try again."; return; }
        if (!uRes.ok) throw new Error("user " + uRes.status);
        var user = await uRes.json();
        if (user.disabled) { statusEl.textContent = "This Lichess account is closed."; return; }

        var gRes = await fetch("https://lichess.org/api/games/user/" + encodeURIComponent(name) +
          "?max=" + max + "&rated=true&opening=true&moves=false&perfType=bullet,blitz,rapid,classical",
          { headers: { Accept: "application/x-ndjson" } });
        if (gRes.status === 429) { statusEl.textContent = "Lichess is busy. Please wait a minute and try again."; return; }
        if (!gRes.ok) throw new Error("games " + gRes.status);
        var games = (await gRes.text()).split("\n").filter(Boolean).map(function (l) { return JSON.parse(l); });
        render(user, games);
        statusEl.textContent = "";
      } catch (err) {
        console.error(err);
        statusEl.textContent = "Could not reach Lichess right now. Please check your connection and try again.";
      } finally { btn.disabled = false; }
    }

    function render(user, games) {
      var me = (user.username || user.id).toLowerCase();
      var perfs = user.perfs || {};
      var ratingCards = ["bullet", "blitz", "rapid", "classical"].map(function (k) {
        var p = perfs[k];
        if (!p || !p.games) return "";
        var prog = p.prog ? (p.prog > 0 ? '<span class="text-green-600 text-xs font-bold">+' + p.prog + "</span>" : '<span class="text-red-600 text-xs font-bold">' + p.prog + "</span>") : "";
        return '<div class="rs-stat"><p class="text-xs font-bold uppercase text-indigo-700">' + k + '</p><p class="text-2xl font-extrabold text-gray-900">' + p.rating + (p.prov ? "?" : "") + " " + prog + '</p><p class="text-xs text-gray-500">' + p.games + " games</p></div>";
      }).join("");

      var total = { w: 0, d: 0, l: 0 }, byColor = { white: { w: 0, d: 0, l: 0 }, black: { w: 0, d: 0, l: 0 } }, openings = {};
      var rows = games.map(function (g) {
        var white = g.players.white, black = g.players.black;
        var wName = white.user ? white.user.name : (white.aiLevel ? "Stockfish level " + white.aiLevel : "Anonymous");
        var bName = black.user ? black.user.name : (black.aiLevel ? "Stockfish level " + black.aiLevel : "Anonymous");
        var color = (white.user && white.user.name.toLowerCase() === me) ? "white" : "black";
        var res = !g.winner ? "d" : (g.winner === color ? "w" : "l");
        total[res]++; byColor[color][res]++;
        var op = g.opening ? g.opening.name.split(":")[0] : "Unknown opening";
        openings[op] = openings[op] || { n: 0, pts: 0 };
        openings[op].n++; openings[op].pts += res === "w" ? 1 : res === "d" ? 0.5 : 0;
        var opp = color === "white" ? { n: bName, r: black.rating } : { n: wName, r: white.rating };
        var badge = { w: '<span class="text-green-700 font-bold">Win</span>', d: '<span class="text-gray-600 font-bold">Draw</span>', l: '<span class="text-red-600 font-bold">Loss</span>' }[res];
        var date = new Date(g.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
        return '<a href="https://lichess.org/' + esc(g.id) + (color === "black" ? "/black" : "") + '" target="_blank" rel="noopener noreferrer" class="flex items-center justify-between gap-3 p-3 rounded-md border border-gray-100 hover:border-indigo-300 transition">' +
          '<div class="min-w-0"><p class="font-semibold text-gray-800 truncate">' + (color === "white" ? "♔ " : "♚ ") + "vs " + esc(opp.n) + (opp.r ? ' <span class="text-gray-500 font-normal">(' + opp.r + ")</span>" : "") + "</p>" +
          '<p class="text-xs text-gray-500 truncate">' + esc(g.opening ? g.opening.name : "") + " · " + esc(g.speed) + " · " + date + "</p></div>" +
          '<div class="text-sm flex-shrink-0">' + badge + "</div></a>";
      });

      if (!games.length) {
        out.innerHTML = '<div class="rs-card p-6"><p class="text-xl font-bold">' + esc(user.username) + '</p><div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">' + ratingCards + '</div><p class="text-gray-600 mt-4">No recent rated games found.</p></div>';
        out.classList.remove("hidden"); return;
      }

      var n = games.length, score = total.w + total.d / 2;
      function bar(t) { var s = t.w + t.d + t.l || 1; return '<div class="rs-bar"><span style="width:' + (t.w / s * 100) + '%;background:#22c55e"></span><span style="width:' + (t.d / s * 100) + '%;background:#9ca3af"></span><span style="width:' + (t.l / s * 100) + '%;background:#ef4444"></span></div>'; }
      function line(label, t) { var s = t.w + t.d + t.l; if (!s) return ""; return '<div><div class="flex justify-between text-sm mb-1"><span class="font-semibold">' + label + '</span><span class="text-gray-600">+' + t.w + " =" + t.d + " −" + t.l + " · " + Math.round((t.w + t.d / 2) / s * 100) + "%</span></div>" + bar(t) + "</div>"; }

      var topOpenings = Object.keys(openings).map(function (k) { return { name: k, n: openings[k].n, pct: Math.round(openings[k].pts / openings[k].n * 100) }; })
        .sort(function (a, b) { return b.n - a.n; }).slice(0, 5)
        .map(function (o) { return '<li class="flex justify-between gap-3 py-2 border-b border-gray-100 last:border-0"><span class="truncate">' + esc(o.name) + '</span><span class="text-gray-500 flex-shrink-0">' + o.n + " game" + (o.n > 1 ? "s" : "") + " · " + o.pct + "%</span></li>"; }).join("");

      var tip = score / n < 0.4 ? "Your recent score is below 40%. Try longer time controls and run the CCT checklist (checks, captures, threats) before every move."
        : score / n > 0.65 ? "Great form! You may be ready for stronger opponents or longer, rated tournaments."
        : "Solid results. Analyse your losses to find the patterns that repeat.";

      out.innerHTML =
        '<div class="rs-card p-6"><div class="flex flex-wrap items-baseline justify-between gap-2"><p class="text-2xl font-bold text-gray-900">' + esc(user.title ? user.title + " " : "") + esc(user.username) + '</p><a href="https://lichess.org/@/' + esc(user.username) + '" target="_blank" rel="noopener noreferrer" class="text-sm text-indigo-700 font-semibold hover:underline">View on Lichess</a></div>' +
        '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">' + ratingCards + "</div></div>" +
        '<div class="grid md:grid-cols-2 gap-6"><div class="rs-card p-6 space-y-4"><p class="font-bold text-lg">Last ' + n + " rated games</p>" + line("Overall", total) + line("With White", byColor.white) + line("With Black", byColor.black) +
        '<p class="text-sm text-indigo-900 bg-indigo-50 rounded-md p-3"><i class="fas fa-lightbulb mr-1"></i>' + tip + "</p></div>" +
        '<div class="rs-card p-6"><p class="font-bold text-lg mb-2">Most played openings</p><ul class="text-sm">' + topOpenings + "</ul></div></div>" +
        '<div class="rs-card p-6"><p class="font-bold text-lg mb-3">Recent games</p><div class="grid gap-2">' + rows.slice(0, 10).join("") + "</div>" +
        '<p class="text-xs text-gray-500 mt-4">Data from the Lichess API. Click a game to open it on Lichess and run a free computer analysis.</p></div>';
      out.classList.remove("hidden");
    }
  }

  /* ---------------- Board editor ---------------- */
  var board = $("play-board");
  if (board && window.customElements) {
    customElements.whenDefined("chess-board").then(function () {
      var msg = $("board-msg");
      function say(t, bad) { msg.textContent = t; msg.className = "text-center text-sm mt-2 " + (bad ? "text-red-600" : "text-green-700"); setTimeout(function () { msg.textContent = ""; }, 4000); }
      var validFen = /^([pnbrqkPNBRQK1-8]{1,8}\/){7}[pnbrqkPNBRQK1-8]{1,8}$/;
      $("start-pos").addEventListener("click", function () { board.start(); });
      $("clear-board").addEventListener("click", function () { board.clear(); });
      $("flip-board").addEventListener("click", function () { board.flip(); });
      $("load-fen").addEventListener("click", function () {
        var fen = $("fen-input").value.trim().split(/\s+/)[0];
        if (!validFen.test(fen)) { say("That doesn't look like a valid FEN.", true); return; }
        board.setPosition(fen); say("Position loaded.");
      });
      $("copy-fen").addEventListener("click", function () {
        var fen = board.fen() + " w - - 0 1";
        $("fen-input").value = fen;
        if (navigator.clipboard) navigator.clipboard.writeText(fen).then(function () { say("FEN copied to clipboard."); }, function () { say("FEN shown in the box above."); });
        else say("FEN shown in the box above.");
      });
      $("open-lichess").addEventListener("click", function () {
        var fen = board.fen() + " w - - 0 1";
        window.open("https://lichess.org/analysis/standard/" + fen.replace(/ /g, "_"), "_blank", "noopener");
      });
    });
  }

  /* ---------------- Opening tabs ---------------- */
  document.querySelectorAll(".rs-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll(".rs-tab").forEach(function (t) { var on = t === tab; t.classList.toggle("is-active", on); t.setAttribute("aria-selected", String(on)); });
      document.querySelectorAll(".rs-tabpanel").forEach(function (p) { p.classList.toggle("hidden", p.dataset.panel !== tab.dataset.tab); });
    });
  });

  /* ---------------- Endgame checklist (saved per browser) ---------------- */
  var KEY = "cd-endgame-checklist";
  var boxes = document.querySelectorAll("#endgame-checklist input[data-eg]");
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage unavailable */ } }
  function progress() {
    var done = 0; boxes.forEach(function (b) { if (b.checked) done++; });
    var el = $("eg-progress"); if (el) el.textContent = done + " of " + boxes.length + " endgames mastered";
  }
  if (boxes.length) {
    var state = load();
    boxes.forEach(function (b) {
      b.checked = !!state[b.dataset.eg];
      b.addEventListener("change", function () { var d = load(); d[b.dataset.eg] = b.checked; save(d); progress(); });
    });
    progress();
    $("eg-reset").addEventListener("click", function () { boxes.forEach(function (b) { b.checked = false; }); save({}); progress(); });
  }

  /* ---------------- Section nav: highlight current section ---------------- */
  var links = document.querySelectorAll(".rs-subnav a[href^='#']");
  if ("IntersectionObserver" in window && links.length) {
    var map = {}; links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) {
          links.forEach(function (a) { a.classList.remove("is-current"); });
          map[en.target.id].classList.add("is-current");
          var a = map[en.target.id], ul = a.closest("ul"); if (ul) ul.scrollLeft = a.offsetLeft - ul.clientWidth / 2;
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(map).forEach(function (id) { var s = $(id); if (s) io.observe(s); });
  }
})();
