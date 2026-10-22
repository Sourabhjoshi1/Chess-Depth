/* ChessDepth Academy - shared behaviour for every page */
(function () {
  // Current year in the footer
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // Night / day mode toggle (the initial theme is set in <head> to avoid a flash)
  (function () {
    var root = document.documentElement;
    function label() {
      var dark = root.classList.contains("dark");
      document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
        b.setAttribute("aria-label", dark ? "Switch to day mode" : "Switch to night mode");
        b.setAttribute("aria-pressed", String(dark));
      });
    }
    function set(theme, save) {
      root.classList.add("cd-theme-anim");
      root.classList.toggle("dark", theme === "dark");
      if (save) { try { localStorage.setItem("cd-theme", theme); } catch (e) {} }
      label();
      setTimeout(function () { root.classList.remove("cd-theme-anim"); }, 350);
    }
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      b.addEventListener("click", function () { set(root.classList.contains("dark") ? "light" : "dark", true); });
    });
    // Follow the device setting live, until the visitor picks a mode themselves
    if (window.matchMedia) {
      var mq = matchMedia("(prefers-color-scheme: dark)");
      var follow = function (e) { var saved = null; try { saved = localStorage.getItem("cd-theme"); } catch (x) {} if (!saved) set(e.matches ? "dark" : "light", false); };
      if (mq.addEventListener) mq.addEventListener("change", follow); else if (mq.addListener) mq.addListener(follow);
    }
    label();
  })();

  // Google Analytics: record clicks on the ways visitors contact the academy
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || typeof window.gtag !== "function") return;
    var href = a.getAttribute("href") || "", where = a.closest("header, .cd-topbar") ? "header" : a.closest("footer") ? "footer" : a.classList.contains("whatsapp-float") ? "floating_button" : "page";
    var label = (a.textContent || a.getAttribute("aria-label") || "").trim().slice(0, 60);
    if (href.indexOf("wa.me/") !== -1) {
      var demo = /demo/i.test(label) || a.classList.contains("cd-demo-btn") || a.classList.contains("cd-hdr-cta") || a.classList.contains("demo-button");
      gtag("event", demo ? "book_demo_click" : "whatsapp_click", { link_location: where, link_text: label, page_path: location.pathname });
    } else if (href.indexOf("tel:") === 0) {
      gtag("event", "phone_click", { link_location: where, page_path: location.pathname });
    } else if (href.indexOf("mailto:") === 0) {
      gtag("event", "email_click", { link_location: where, page_path: location.pathname });
    } else if (href.indexOf("/student/") === 0) {
      gtag("event", "student_login_click", { link_location: where, page_path: location.pathname });
    }
  }, true);

  // Hide "Free" launch-offer labels once the offer has ended
  document.querySelectorAll("[data-free-until]").forEach(function (el) {
    var p = (el.getAttribute("data-free-until") || "").split("-").map(Number);
    if (p.length === 3 && Date.now() > new Date(p[0], p[1] - 1, p[2], 23, 59, 59).getTime()) el.remove();
  });

  // Inline form messages (replaces browser alert pop-ups)
  window.cdFormMessage = function (form, text, type) {
    if (!form) return;
    var box = form.parentNode.querySelector('.cd-form-msg[data-for="' + (form.id || 'form') + '"]');
    if (!box) {
      box = document.createElement('div');
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      box.dataset.for = form.id || 'form';
      form.insertAdjacentElement('afterend', box);
    }
    box.className = 'cd-form-msg ' + (type || 'error');
    box.textContent = text;
    if (type !== 'success') { setTimeout(function () { box.remove(); }, 8000); }
  };

  // Mobile menu: one consistent implementation for all pages
  function setupMenu() {
    var oldBtn = document.getElementById('menu-toggle');
    var menu = document.getElementById('mobile-menu');
    if (!oldBtn || !menu) return;
    var btn = oldBtn.cloneNode(true);            // drops any older per-page listeners
    oldBtn.parentNode.replaceChild(btn, oldBtn);
    var open = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>';
    var closed = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"></path>';
    function set(isOpen) {
      menu.classList.toggle('hidden', !isOpen);
      menu.classList.toggle('-translate-y-full', !isOpen);
      btn.setAttribute('aria-expanded', String(isOpen));
      var svg = btn.querySelector('svg'); if (svg) svg.innerHTML = isOpen ? open : closed;
    }
    set(false);
    btn.addEventListener('click', function () { set(menu.classList.contains('hidden')); });
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { set(false); }); });
  }
  if (document.readyState === 'complete') setupMenu(); else window.addEventListener('load', setupMenu);
})();
