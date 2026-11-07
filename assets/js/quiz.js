// ChessDepth Academy - Student Area quiz levels (tabs). Quizzes are listed in _data/quizzes.yml.
(function () {
  var tabs = document.querySelectorAll(".qz-tab"); if (!tabs.length) return;
  function show(level, save) {
    tabs.forEach(function (t) { t.setAttribute("aria-selected", String(t.dataset.level === level)); });
    document.querySelectorAll(".qz-panel").forEach(function (p) { p.classList.toggle("hidden", p.dataset.panel !== level); });
    if (save) { try { localStorage.setItem("cd-quiz-level", level); } catch (e) { /* ignore */ } }
  }
  tabs.forEach(function (t) { t.addEventListener("click", function () { show(t.dataset.level, true); }); });
  var saved = null; try { saved = localStorage.getItem("cd-quiz-level"); } catch (e) { /* ignore */ }
  if (saved && document.querySelector('.qz-tab[data-level="' + saved + '"]')) show(saved, false);
})();
