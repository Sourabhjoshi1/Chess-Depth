// ChessDepth Academy - "This week's quiz" in the Student Area. Quizzes are listed in _data/quizzes.yml.
(function () {
  var box = document.getElementById("qz-now"); if (!box) return;
  var data = []; try { data = JSON.parse(document.getElementById("qz-data").textContent || "[]") || []; } catch (e) { data = []; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function day(s) { var p = String(s || "").split("-").map(Number); return p.length === 3 ? new Date(p[0], p[1] - 1, p[2]) : null; }
  function fmt(d) { return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }); }
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var open = [], past = [];
  data.forEach(function (q) {
    var o = day(q.opens), c = day(q.closes); if (!o) return;
    if (o <= today && (!c || c >= today)) open.push(q); else if (c && c < today) past.push(q);
  });
  if (!open.length) {
    box.innerHTML = '<p class="qz-empty"><i class="far fa-calendar"></i> No quiz this week. Your coach will share the next one in class and on our <a href="' + esc(window.CD_WA_COMMUNITY || "#") + '" target="_blank" rel="noopener">WhatsApp community</a>. Meanwhile, keep sharp in the <a href="/lab/tactics/">Tactics trainer</a>.</p>';
  } else {
    box.innerHTML = open.map(function (q) {
      var c = day(q.closes), left = c ? Math.round((c - today) / 86400000) : null;
      var due = c ? (left === 0 ? "Closes today" : left === 1 ? "Closes tomorrow" : "Open until " + fmt(c)) : "";
      var btn = q.url ? '<a class="qz-btn" href="' + esc(q.url) + '" target="_blank" rel="noopener"><i class="fas fa-play"></i> Start the quiz</a>'
                      : '<span class="qz-soon"><i class="far fa-clock"></i> The link will appear here very soon</span>';
      return '<article class="qz-item">' +
        '<div class="qz-main"><p class="qz-meta"><span class="qz-level">' + esc(q.level || "All levels") + '</span>' + (due ? '<span class="qz-due' + (left !== null && left <= 1 ? " soon" : "") + '">' + esc(due) + "</span>" : "") + '</p>' +
        '<h3>' + esc(q.title) + '</h3>' + (q.topics ? '<p class="qz-topics">' + esc(q.topics) + "</p>" : "") +
        '<p class="qz-facts">' + [q.questions ? q.questions + " questions" : "", q.minutes ? "about " + q.minutes + " minutes" : "", q.points ? q.points + " points" : ""].filter(Boolean).map(esc).join(" · ") + "</p></div>" +
        '<div class="qz-cta">' + btn + "</div></article>";
    }).join("");
  }
  if (past.length) {
    document.getElementById("qz-past").classList.remove("hidden");
    document.getElementById("qz-past-list").innerHTML = past.map(function (q) {
      return "<li><b>" + esc(q.title) + "</b> <span>" + esc(q.level || "") + " · closed " + fmt(day(q.closes)) + "</span>" +
        (q.key ? ' <a href="' + esc(q.key) + '" target="_blank" rel="noopener">Answers and explanations</a>' : "") + "</li>";
    }).join("");
  }
})();
