/* ChessDepth Assistant: the chat button at the bottom right of every page.
   It asks a visitor a few questions (who the class is for, age, level, format, country),
   suggests a class and fee, and answers common questions typed in the box.
   Everything runs in the browser; nothing is sent anywhere unless the visitor taps a link.
   Settings and links come from the JSON block #cd-assistant-config (see _includes/assistant.html). */
(function () {
  "use strict";
  var cfgEl = document.getElementById("cd-assistant-config");
  if (!cfgEl) return;
  var CFG = JSON.parse(cfgEl.textContent);
  var WA = "https://wa.me/" + CFG.phone + "?text=";
  var A = {};            // answers so far
  var started = false, open = false;

  function track(name, extra) {
    if (typeof window.gtag !== "function") return;
    var p = { page_path: location.pathname }; for (var k in extra || {}) p[k] = extra[k];
    window.gtag("event", name, p);
  }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------- the widget ---------- */
  var root = el("div", "cda");
  root.innerHTML =
    '<button type="button" class="cda-fab" aria-expanded="false" aria-controls="cda-panel" aria-label="Open the ChessDepth assistant">' +
      '<i class="fas fa-chess-knight cda-fab-ico" aria-hidden="true"></i><i class="fas fa-xmark cda-fab-x" aria-hidden="true"></i>' +
      '<span class="cda-fab-tip">Need help choosing a class?</span></button>' +
    '<section class="cda-panel" id="cda-panel" role="dialog" aria-label="ChessDepth assistant" hidden>' +
      '<header class="cda-head"><span class="cda-av"><i class="fas fa-chess-knight"></i></span>' +
        '<div><b>ChessDepth Assistant</b><small>Finds the right class in under a minute</small></div>' +
        '<button type="button" class="cda-restart" title="Start again" aria-label="Start again"><i class="fas fa-rotate-left"></i></button>' +
        '<button type="button" class="cda-close" aria-label="Close"><i class="fas fa-xmark"></i></button></header>' +
      '<div class="cda-log" aria-live="polite"></div>' +
      '<form class="cda-input" autocomplete="off"><input type="text" maxlength="200" placeholder="Type a question, e.g. fees or timings" aria-label="Type a question">' +
        '<button type="submit" aria-label="Send"><i class="fas fa-paper-plane"></i></button></form>' +
    '</section>';
  document.body.appendChild(root);
  var fab = root.querySelector(".cda-fab"), panel = root.querySelector(".cda-panel"), log = root.querySelector(".cda-log"),
      form = root.querySelector(".cda-input"), input = form.querySelector("input");

  function setOpen(v) {
    open = v; panel.hidden = !v; root.classList.toggle("is-open", v); fab.setAttribute("aria-expanded", v ? "true" : "false");
    if (v) { try { sessionStorage.setItem("cda_seen", "1"); } catch (e) {} root.classList.remove("cda-nudge"); if (!started) start(); setTimeout(function () { input.focus({ preventScroll: true }); }, 50); track("assistant_open"); }
  }
  fab.addEventListener("click", function () { setOpen(!open); });
  root.querySelector(".cda-close").addEventListener("click", function () { setOpen(false); fab.focus(); });
  root.querySelector(".cda-restart").addEventListener("click", function () { log.innerHTML = ""; A = {}; start(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && open) { setOpen(false); fab.focus(); } });
  // a small "need help?" tip on the first page of a visit, after a few seconds
  try { if (!sessionStorage.getItem("cda_seen")) setTimeout(function () { if (!open) root.classList.add("cda-nudge"); }, 6000); } catch (e) {}

  /* ---------- chat helpers ---------- */
  function scroll() { log.scrollTop = log.scrollHeight; }
  function say(html, delay) {
    return new Promise(function (res) {
      var t = el("div", "cda-msg cda-bot cda-typing", "<span></span><span></span><span></span>"); log.appendChild(t); scroll();
      setTimeout(function () { t.className = "cda-msg cda-bot"; t.innerHTML = html; scroll(); res(); }, delay == null ? 450 : delay);
    });
  }
  function me(text) { log.appendChild(el("div", "cda-msg cda-me", esc(text))); scroll(); }
  function chips(list, cb) {
    var box = el("div", "cda-chips");
    list.forEach(function (o) {
      var b = el("button", "cda-chip", esc(o.label)); b.type = "button";
      b.addEventListener("click", function () { box.remove(); me(o.label); cb(o.value != null ? o.value : o.label); });
      box.appendChild(b);
    });
    log.appendChild(box); scroll();
  }
  function links(list) {
    var box = el("div", "cda-links");
    list.forEach(function (l) {
      var a = el("a", "cda-link" + (l.main ? " cda-link-main" : ""), (l.icon ? '<i class="' + l.icon + '"></i>' : "") + esc(l.label));
      a.href = l.href; if (/^https?:/.test(l.href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      if (l.href.indexOf("wa.me/") === -1) a.addEventListener("click", function () { track(l.event || "assistant_link", { link_location: "assistant", link_text: l.label }); });   // WhatsApp clicks are counted by site.js
      box.appendChild(a);
    });
    log.appendChild(box); scroll();
  }
  function they() { return A.who === "child" ? "your child" : "you"; }

  /* ---------- the guided questions ---------- */
  function start() {
    started = true;
    say("Hi! I'm the ChessDepth assistant. A few quick questions and I'll suggest the right class for you.", 300)
      .then(function () { return say("Who are the classes for?"); })
      .then(function () {
        chips([{ label: "My child", value: "child" }, { label: "Myself", value: "self" }, { label: "I just have a question", value: "q" }], function (v) {
          A.who = v;
          if (v === "q") { say("Sure, type it in the box below. You can ask about fees, timings, the free demo, coaches, levels or payment."); return; }
          track("assistant_start", { who: v });
          v === "child" ? askAge() : askLevel();
        });
      });
  }
  function askAge() {
    say("How old is your child?").then(function () {
      chips([{ label: "Under 5", value: 4 }, { label: "5 to 7", value: 6 }, { label: "8 to 12", value: 10 }, { label: "13 to 17", value: 15 }], function (v) {
        A.age = v;
        if (v < 5) say("Most children can start from about 5, once they can sit with a short game or puzzle for 20 to 30 minutes. The free demo class is a good way to check if your child is ready.").then(askLevel);
        else askLevel();
      });
    });
  }
  function askLevel() {
    say("How much chess does " + they() + " play now?").then(function () {
      chips([
        { label: "New to chess", value: "new" },
        { label: "Knows how the pieces move", value: "moves" },
        { label: "Plays full games online or at a club", value: "games" },
        { label: "Plays rated tournaments", value: "rated" }
      ], function (v) {
        A.exp = v;
        if (v === "new" || v === "moves") { A.level = "Beginner"; askFormat(); }
        else askRating();
      });
    });
  }
  function askRating() {
    say("Roughly what rating? Online (Chess.com or Lichess) or FIDE is fine.").then(function () {
      chips([
        { label: "No rating / not sure", value: "" }, { label: "Under 1000", value: "Beginner" }, { label: "1000 to 1500", value: "Intermediate" },
        { label: "1500 to 1900", value: "Advanced" }, { label: "1900 and above", value: "Elite" }
      ], function (v) { A.level = v || (A.exp === "rated" ? "Intermediate" : "Beginner or Intermediate"); A.rated = !!v; askFormat(); });
    });
  }
  function askFormat() {
    say("Which way of learning suits " + they() + " better?").then(function () {
      chips([{ label: "One-to-one with a coach", value: "one" }, { label: "Small group (2 to 4 students)", value: "group" }, { label: "Not sure, help me choose", value: "?" }], function (v) {
        if (v !== "?") { A.format = v; askPlace(); return; }
        var adv = A.level === "Advanced" || A.level === "Elite";
        A.format = (A.age && A.age < 8) || adv ? "one" : "group";
        var why = A.format === "one"
          ? (adv ? "At " + A.level + " level, lessons built around your own games and openings help most, so I'd suggest one-to-one."
                 : "Young children learn best with a coach's full attention, so I'd suggest one-to-one.")
          : "A small group is great value, and learning alongside other players keeps it fun. One-to-one is better if you want a plan built only around " + (A.who === "child" ? "your child's" : "your") + " games.";
        say(why).then(askPlace);
      });
    });
  }
  function askPlace() {
    say("Last one: where are you based?").then(function () {
      chips([{ label: "India", value: "in" }, { label: "Outside India", value: "abroad" }], function (v) { A.place = v; recommend(); });
    });
  }
  function recommend() {
    var one = A.format === "one", inr = A.place === "in";
    var fmt = one ? "One-to-one personalised training" : "Group classes (2 to 4 students)";
    var fee = one ? (inr ? "from ₹5,600 a month" : "from US$90 a month") : (inr ? "₹2,999 a month" : "US$60 a month");
    var levelTxt = A.level === "Beginner or Intermediate" ? "Beginner or Intermediate (the coach confirms in the demo)" : A.level;
    track("assistant_recommend", { format: A.format, level: A.level, region: A.place });
    say("Here's my suggestion:", 400).then(function () {
      return say('<div class="cda-card"><p class="cda-card-k">Suggested class</p><p class="cda-card-t">' + fmt + '</p>' +
        '<p><b>Level:</b> ' + levelTxt + '</p><p><b>Fee:</b> ' + fee + (one ? ", depending on the coach" : "") + ', inclusive of all taxes</p>' +
        '<p>8 to 10 live online classes a month, 60 to 70 minutes each.' + (A.place === "abroad" ? " Class times are set to suit your time zone." : "") + '</p>' +
        '<p class="cda-card-free"><i class="fas fa-gift"></i> The first demo class is free.</p></div>', 600);
    }).then(function () {
      var who = A.who === "child" ? "my child" + (A.age ? " (age group " + ({ 4: "under 5", 6: "5 to 7", 10: "8 to 12", 15: "13 to 17" }[A.age]) + ")" : "") : "myself";
      var msg = "Hi ChessDepth, I'd like a free demo class for " + who + ". Level: " + A.level + ". Format: " + (one ? "one-to-one" : "group") + ". Based " + (A.place === "in" ? "in India" : "outside India") + ".";
      links([
        { label: "Book the free demo", href: CFG.register, icon: "fas fa-calendar-check", main: true, event: "book_demo_click" },
        { label: "Send this on WhatsApp", href: WA + encodeURIComponent(msg), icon: "fab fa-whatsapp" },
        { label: "See what each level covers", href: "/courses/#levels", icon: "fas fa-layer-group" }
      ]);
      return say("Anything else you'd like to know? Type it below.", 700);
    });
  }

  /* ---------- typed questions ---------- */
  var FAQ = [
    { k: /fee|price|cost|charge|how much|rate|₹|\$|inr|usd|dollar|rupee|afford|expensive|discount/, a: function () {
        return "<b>One-to-one:</b> from ₹5,600 or US$90 a month, depending on the coach.<br><b>Group (2 to 4 students):</b> ₹2,999 or US$60 a month.<br>Both include 8 to 10 live classes of 60 to 70 minutes, and prices are inclusive of all taxes. The first demo class is free."; },
      l: [{ label: "Fees and plans", href: "/courses/#fees", icon: "fas fa-tag" }] },
    { k: /demo|trial|free class|\btry\b/, a: "The first class is a free 30-minute demo. The coach checks the level and suggests the right course. There's no obligation to join.",
      l: [{ label: "Book the free demo", href: "@register", icon: "fas fa-calendar-check", main: true, event: "book_demo_click" }] },
    { k: /\bai\b|photo|scan|picture|camera|image|screenshot|vision/, a: "ChessDepth AI turns a photo or screenshot of a chess position into a board you can analyse. It's free to try.",
      l: [{ label: "Try ChessDepth AI", href: "/ai/", icon: "fas fa-camera" }] },
    { k: /lab|puzzle|tactic|practice|tool|blindfold|quiz|worksheet|homework|tournament/, a: "Students get worksheets, a quiz every eight sessions, club tournaments and free access to the Chess Lab and our other training tools.",
      l: [{ label: "Open the Chess Lab", href: "/lab/", icon: "fas fa-flask" }] },
    { k: /abroad|usa|america|uk|england|dubai|uae|singapore|canada|australia|overseas|outside india|nri/, a: "Yes, we teach students around the world. Fees are in US dollars (one-to-one from $90, group $60 a month) and class times are set to your time zone." },
    { k: /refund|cancel|stop|pause|miss|reschedul|leave/, a: "The refund and cancellation terms, including missed and rescheduled classes, are on our Refunds page.",
      l: [{ label: "Refunds and cancellations", href: "/refunds/", icon: "fas fa-file-lines" }] },
    { k: /pay|payment|upi|card|wise|bank|transfer|paypal|invoice|gst|tax/, a: "Fees are paid monthly, in advance. In India you pay by UPI or bank transfer, and we send the details on WhatsApp when you enrol. Outside India you can pay in your own currency with Wise. Prices are inclusive of all taxes.",
      l: [{ label: "How to pay", href: "/courses/#pay", icon: "fas fa-credit-card" }] },
    { k: /job|career|hiring|work with you|join as/, a: "We're always glad to hear from good coaches. See the Careers page for open roles.", l: [{ label: "Careers", href: "/careers/", icon: "fas fa-briefcase" }] },
    { k: /coach|teacher|trainer|tutor|\bim\b|master|fide|who teaches/, a: "Our coaches include a Grandmaster, an International Master and FIDE-rated players. You can read about each of them on the Coaches page.",
      l: [{ label: "Meet the coaches", href: "/coaches/", icon: "fas fa-user-tie" }] },
    { k: /group|batch|one.?to.?one|1.?on.?1|private|personal|individual|difference|which is better/, a: "<b>One-to-one</b> is built entirely around one student's games, openings and pace. <b>Group classes</b> have 2 to 4 students at a similar level and cost less. Both follow the same four levels.",
      l: [{ label: "Compare the two", href: "/courses/#compare", icon: "fas fa-scale-balanced" }] },
    { k: /level|beginner|intermediate|advanced|elite|rating|elo|syllabus|curriculum|learn|cover/, a: "There are four levels: Beginner (up to 1000), Intermediate (1000 to 1500), Advanced (1500 to 1900) and Elite (1900+). You don't need to choose: the coach places you in the free demo.",
      l: [{ label: "What each level covers", href: "/courses/#levels", icon: "fas fa-layer-group" }] },
    { k: /age|old|kid|child|son|daughter|young|year/, a: "Most children can start from about 5 years old, as long as they can sit with a short game or puzzle for 20 to 30 minutes. We teach adults too.",
      l: [{ label: "Classes for kids", href: "/chess-classes-for-kids/", icon: "fas fa-child" }] },
    { k: /time|timing|schedule|slot|when|hour|weekend|timezone|time zone|day/, a: "Class times are flexible, with no fixed hours. We fix a time that suits you, including weekends and other time zones, when you book the demo." },
    { k: /online|offline|zoom|meet|video|in person|location|where|centre|center|physical|laptop|device/, a: "All classes are live and online, so you can join from anywhere with a laptop or tablet and a steady internet connection. The coach teaches on a shared board and you can ask questions as you go." },
    { k: /contact|phone|call|whatsapp|talk|human|person|email|number|reach/, a: "You can talk to us directly on WhatsApp or call " + CFG.phoneDisplay + ".",
      l: [{ label: "Chat on WhatsApp", href: "@wa", icon: "fab fa-whatsapp" }] },
    { k: /^(hi|hello|hey|namaste|hii+|good (morning|evening|afternoon))\b/, a: "Hello! Ask me anything about our classes, or tap “Start again” at the top to get a class suggestion." },
    { k: /thank|thanks|great|ok(ay)?$|cool|nice/, a: "You're welcome! Whenever you're ready, the first demo class is free.", l: [{ label: "Book the free demo", href: "@register", icon: "fas fa-calendar-check", main: true, event: "book_demo_click" }] }
  ];
  function fix(l) { return l.map(function (x) { var y = {}; for (var k in x) y[k] = x[k]; if (y.href === "@register") y.href = CFG.register; if (y.href === "@wa") y.href = WA + CFG.waText; return y; }); }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = input.value.trim(); if (!q) return; input.value = ""; me(q); started = true;
    var s = q.toLowerCase(), hit = null;
    for (var i = 0; i < FAQ.length; i++) if (FAQ[i].k.test(s)) { hit = FAQ[i]; break; }
    track("assistant_question", { matched: hit ? "yes" : "no" });
    if (hit) say(typeof hit.a === "function" ? hit.a() : hit.a).then(function () { if (hit.l) links(fix(hit.l)); });
    else say("I'm not sure about that one, but a coach can answer it. Send your question on WhatsApp and we'll reply soon.")
      .then(function () { links([{ label: "Ask on WhatsApp", href: WA + encodeURIComponent("Hi ChessDepth, " + q), icon: "fab fa-whatsapp" }]); });
  });
})();
