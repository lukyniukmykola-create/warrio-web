// Warrio FX: soft "bubble" sounds (synthesised, no files) and small motion helpers.
(function () {
  "use strict";
  let ctx = null, muted = false;
  try { muted = localStorage.getItem("warrio-sound") === "off"; } catch { /* ignore */ }
  const audio = () => {
    if (muted) return null;
    if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  };
  // One bubble: sine whose pitch glides up quickly, with a soft attack and a round decay.
  function bubble(freq, when = 0, len = 0.14, gain = 0.07, rise = 1.7) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + when;
    const osc = a.createOscillator(), amp = a.createGain(), lp = a.createBiquadFilter();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * rise, t + len * 0.7);
    lp.type = "lowpass"; lp.frequency.value = 2400;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(lp).connect(amp).connect(a.destination);
    osc.start(t); osc.stop(t + len + 0.03);
  }
  const sounds = {
    click: () => bubble(420, 0, 0.11, 0.05),
    nav: () => { bubble(520, 0, 0.1, 0.05); bubble(700, 0.055, 0.12, 0.04); },
    open: () => { bubble(330, 0, 0.13, 0.055, 2); bubble(560, 0.07, 0.14, 0.04, 1.8); },
    close: () => { bubble(620, 0, 0.1, 0.045, 0.6); },
    ok: () => { bubble(480, 0, 0.12, 0.06); bubble(640, 0.08, 0.12, 0.055); bubble(860, 0.16, 0.18, 0.05); },
    error: () => { bubble(300, 0, 0.18, 0.06, 0.7); bubble(230, 0.1, 0.2, 0.05, 0.7); }
  };
  window.WarrioFX = { play: name => (sounds[name] || sounds.click)(), isMuted: () => muted };

  document.addEventListener("click", event => {
    const el = event.target.closest(".btn,.nav-btn,.quick-btn,.icon-btn,.attention-row,.user,[data-page-link]");
    if (!el) return;
    sounds[el.classList.contains("nav-btn") || el.hasAttribute("data-page-link") ? "nav" : "click"]();
    if (el.matches(".btn,.nav-btn,.quick-btn")) {
      const r = el.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2;
      const dot = document.createElement("span");
      dot.className = "fx-ripple";
      dot.style.cssText = `width:${size}px;height:${size}px;left:${event.clientX - r.left - size / 2}px;top:${event.clientY - r.top - size / 2}px`;
      el.append(dot);
      setTimeout(() => dot.remove(), 600);
    }
  }, true);

  // Modals and toasts.
  const watch = () => {
    const overlay = document.querySelector("#modal-overlay");
    if (overlay) new MutationObserver(() => sounds[overlay.classList.contains("open") ? "open" : "close"]())
      .observe(overlay, { attributes: true, attributeFilter: ["class"] });
    const toasts = document.querySelector("#toasts");
    if (toasts) new MutationObserver(list => {
      for (const m of list) for (const n of m.addedNodes) {
        if (!(n instanceof Element) || !n.classList.contains("toast")) continue;
        sounds[n.classList.contains("toast--warn") ? "error" : "ok"]();
      }
    }).observe(toasts, { childList: true });
  };

  // Numbers count up when a tile value changes.
  const counted = new WeakMap();
  function countUp(el) {
    const raw = el.textContent.trim();
    if (el.dataset.fxBusy || !/^\d+$/.test(raw) || counted.get(el) === raw) return;
    el.dataset.fxBusy = "1";
    const end = Number(raw), t0 = performance.now(), dur = 700;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = String(Math.round(end * e));
      if (k < 1) requestAnimationFrame(step); else { counted.set(el, String(end)); delete el.dataset.fxBusy; }
    };
    requestAnimationFrame(step);
  }
  const scan = () => document.querySelectorAll(".stat strong").forEach(countUp);

  const ICON = {
    speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6M21 9l-5 6"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.1 2.1 0 0 1-3-3z"/><path d="M14.7 6.3a4 4 0 0 1 5-3.1l-2.6 2.6.5 2 2 .5 2.6-2.6a4 4 0 0 1-5.4 4.6"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21 8-9-5-9 5 9 5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.7 2.7L16 9.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 2.8 19h18.4z"/><path d="M12 10v4M12 17v.5"/></svg>'
  };
  const GLYPH = { "!": "alert", "◷": "clock", "⚒": "wrench", "▤": "doc", "@": "mail" };

  function icons() {
    document.querySelectorAll('.nav-btn[data-page="service"] .ico:empty,.nav-btn[data-page="stock"] .ico:empty').forEach(el => {
      el.innerHTML = el.closest("[data-page]").dataset.page === "service" ? ICON.wrench : ICON.box;
    });
    document.querySelectorAll(".notice i").forEach(el => {
      const key = GLYPH[el.textContent.trim()];
      if (key) el.innerHTML = ICON[key];
    });
  }

  function sound() {
    const b = document.createElement("button");
    b.id = "fx-sound"; b.type = "button"; b.className = "icon-btn"; b.title = "Звуки";
    const draw = () => { b.innerHTML = muted ? ICON.mute : ICON.speaker; };
    draw();
    b.addEventListener("click", event => {
      event.stopPropagation();
      muted = !muted;
      try { localStorage.setItem("warrio-sound", muted ? "off" : "on"); } catch { /* ignore */ }
      draw();
      if (!muted) sounds.ok();
    });
    return b;
  }

  function theme() {
    const b = document.createElement("button");
    b.id = "fx-theme"; b.type = "button"; b.className = "icon-btn"; b.title = "Темна / світла тема";
    const apply = dark => {
      document.documentElement.dataset.theme = dark ? "dark" : "light";
      b.innerHTML = dark ? ICON.sun : ICON.moon;
      try { localStorage.setItem("warrio-theme", dark ? "dark" : "light"); } catch { /* ignore */ }
    };
    let dark = false;
    try { dark = localStorage.getItem("warrio-theme") === "dark"; } catch { /* ignore */ }
    apply(dark);
    b.addEventListener("click", event => { event.stopPropagation(); dark = !dark; apply(dark); sounds.nav(); });
    return b;
  }

  function fontPicker() {
    const sel = document.createElement("select");
    sel.id = "fx-font"; sel.title = "Шрифт";
    [["system", "Шрифт: Segoe UI"], ["inter", "Шрифт: Inter"], ["display", "Шрифт: Inter Display"], ["carlito", "Шрифт: Carlito"]].forEach(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; sel.append(o); });
    let cur = "system"; try { cur = localStorage.getItem("warrio-font") || "system"; } catch { /* ignore */ }
    const apply = v => { if (v === "system") delete document.documentElement.dataset.font; else document.documentElement.dataset.font = v; };
    sel.value = cur; apply(cur);
    sel.addEventListener("change", () => { apply(sel.value); try { localStorage.setItem("warrio-font", sel.value); } catch { /* ignore */ } });
    return sel;
  }

  // Custom drop-down that replaces the grey system list. The real <select> stays in the page and keeps the value.
  function enhanceSelect(select) {
    if (select.dataset.fx || select.multiple || select.size > 1 || select.closest(".fx-select")) return;
    select.dataset.fx = "1";
    const wrap = document.createElement("span");
    wrap.className = "fx-select" + (select.closest("label,.full,.modal-body,.form-grid") ? " block" : "");
    select.parentNode.insertBefore(wrap, select);
    wrap.append(select);
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "fx-sel-btn";
    wrap.append(btn);
    let list = null;
    const label = () => { btn.textContent = select.options[select.selectedIndex]?.textContent || ""; };
    const close = () => { list?.remove(); list = null; wrap.classList.remove("open"); };
    const open = () => {
      close(); label();
      list = document.createElement("div");
      list.className = "fx-sel-list";
      [...select.options].forEach((option, index) => {
        const item = document.createElement("div");
        item.className = "fx-opt" + (index === select.selectedIndex ? " sel" : "");
        item.textContent = option.textContent;
        item.addEventListener("mousedown", event => event.preventDefault());
        item.addEventListener("click", event => {
          event.stopPropagation();
          select.selectedIndex = index;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          label(); close(); sounds.click();
        });
        list.append(item);
      });
      const r = btn.getBoundingClientRect();
      list.style.cssText = `left:${r.left}px;top:${r.bottom + 6}px;min-width:${r.width}px`;
      document.body.append(list);
      const lr = list.getBoundingClientRect();
      if (lr.bottom > innerHeight - 8) list.style.top = `${Math.max(8, r.top - lr.height - 6)}px`;
      wrap.classList.add("open");
    };
    btn.addEventListener("click", event => { event.stopPropagation(); list ? close() : open(); });
    document.addEventListener("click", event => { if (list && !list.contains(event.target)) close(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
    addEventListener("scroll", close, true);
    select.addEventListener("change", label);
    new MutationObserver(label).observe(select, { childList: true, subtree: true, characterData: true });
    label();
    setInterval(() => { if (!list) label(); }, 700);
  }

  // Text stays in the system font; numbers, percents, dates and badges use Inter.
  const NUM = /^[\s\d.,:%+\-–↗↘/₴$€]+$/;
  let numQueued = false;
  function numbers() {
    numQueued = false;
    document.querySelectorAll(".stat strong,.status,.nav-badge,.trend,.attention-row b,time,td,th,.card-head b,small,b,strong,span").forEach(el => {
      if (el.children.length || el.classList.contains("fx-num")) return;
      const text = el.textContent.trim();
      if (text && text.length < 24 && /\d/.test(text) && (NUM.test(text) || el.matches(".status,.nav-badge,.trend"))) el.classList.add("fx-num");
    });
  }
  const queueNumbers = () => { if (!numQueued) { numQueued = true; requestAnimationFrame(numbers); } };

  // Right on-screen keyboard and autofill hints for every form field.
  function fieldHints() {
    document.querySelectorAll("input,textarea").forEach(el => {
      if (el.dataset.fxHint) return;
      el.dataset.fxHint = "1";
      const key = `${el.id} ${el.name} ${el.placeholder} ${el.closest("label")?.textContent || ""}`.toLowerCase();
      if (el.type === "checkbox" || el.type === "hidden" || el.type === "file") return;
      if (/phone|тел/.test(key)) { el.type = el.type === "text" ? "tel" : el.type; el.setAttribute("inputmode", "tel"); el.setAttribute("autocomplete", "tel"); }
      else if (/e-?mail|пошт/.test(key)) { el.setAttribute("inputmode", "email"); el.setAttribute("autocapitalize", "none"); el.setAttribute("autocorrect", "off"); }
      else if (/serial|серій|\bsn\b|n600|n1000|-26-/.test(key) || /^(m-sn|sn|serial)/.test(el.id)) { el.setAttribute("autocapitalize", "characters"); el.setAttribute("autocorrect", "off"); el.setAttribute("spellcheck", "false"); el.setAttribute("autocomplete", "off"); }
      else if (/code|код|token/.test(key)) { el.setAttribute("autocapitalize", "characters"); el.setAttribute("autocorrect", "off"); el.setAttribute("autocomplete", "off"); }
      if (el.tagName === "INPUT" && !el.hasAttribute("enterkeyhint")) el.setAttribute("enterkeyhint", el.type === "search" ? "search" : "next");
    });
  }
  // Keep the focused field visible above the keyboard.
  document.addEventListener("focusin", event => {
    const el = event.target;
    if (!el.matches?.("input,textarea,select") || !matchMedia("(max-width:760px)").matches) return;
    setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 280);
  });

  function restructure() {
    const user = document.querySelector("#user-menu");
    const bottom = document.querySelector(".sidebar-bottom");
    if (user && bottom && user.parentElement !== bottom) bottom.append(user);
  }

  // Notifications: new service requests and tasks show up in the bell, with a toast and a sound.
  function notifications() {
    const ctx = () => window.WarrioSession?.getContext?.();
    const drawer = document.querySelector("#notification-drawer"), list = document.querySelector("#notification-list"), bell = document.querySelector("#notifications");
    if (!drawer || !list || !bell) return;
    const feed = document.createElement("div");
    feed.id = "fx-feed";
    list.before(feed);
    const key = org => `warrio-notify-known:${org}`;
    let items = [], first = true;
    const render = () => {
      feed.textContent = "";
      for (const n of items.slice(0, 12)) {
        const el = document.createElement("div");
        el.className = "fx-note" + (n.read ? " read" : "");
        const i = document.createElement("i"); i.innerHTML = ICON[n.icon] || ICON.alert;
        const t = document.createElement("div"), b = document.createElement("b"), s = document.createElement("small");
        b.textContent = n.title; s.textContent = n.text; t.append(b, s);
        el.append(i, t);
        el.addEventListener("click", () => { document.querySelector(`.nav-btn[data-page="${n.page}"]`)?.click(); drawer.classList.remove("open"); });
        feed.append(el);
      }
      bell.classList.toggle("has-new", items.some(n => !n.read));
    };
    const toast = (title, text) => {
      if (window.WarrioApp?.toast) { window.WarrioApp.toast(title, text, "ok"); return; }
      const wrap = document.querySelector("#toasts"); if (!wrap) return;
      const el = document.createElement("div"), b = document.createElement("b"), s = document.createElement("small");
      el.className = "toast"; b.textContent = title; s.textContent = text; el.append(b, s); wrap.append(el);
      setTimeout(() => el.remove(), 6000);
    };
    async function poll() {
      const c = ctx();
      if (!c?.organization?.id || document.hidden || !window.WarrioData?.query) return;
      const org = c.organization.id;
      let known; try { known = new Set(JSON.parse(localStorage.getItem(key(org)) || "null") || []); } catch { known = new Set(); }
      const baseline = !localStorage.getItem(key(org));
      const found = [];
      try {
        if (["owner", "admin", "service_manager", "dealer"].includes(c.membership?.role)) {
          const rows = await window.WarrioData.query("service_requests", { select: "id,title,source,created_at", status: "eq.new", order: "created_at.desc", limit: 30 });
          for (const r of rows || []) found.push({ id: `sr:${r.id}`, icon: "wrench", page: "service", title: r.source === "buyer" ? "Нове звернення від покупця" : "Нове звернення в сервіс", text: r.title });
        }
      } catch { /* module not active */ }
      try {
        const rows = await window.WarrioData.query("work_items", { select: "id,title,status,assigned_user_id,created_by", status: "eq.open", order: "created_at.desc", limit: 30 });
        const me = c.user?.id;
        for (const r of rows || []) if (r.created_by !== me && (!r.assigned_user_id || r.assigned_user_id === me)) found.push({ id: `wi:${r.id}`, icon: "check", page: "tasks", title: "Нове завдання", text: r.title });
      } catch { /* ignore */ }
      const old = new Map(items.map(n => [n.id, n]));
      items = found.map(n => ({ ...n, read: baseline ? true : (known.has(n.id) || old.get(n.id)?.read === true) }));
      const fresh = items.filter(n => !n.read && !old.has(n.id));
      if (fresh.length && !first) { toast(fresh[0].title, fresh.length > 1 ? `${fresh[0].text} і ще ${fresh.length - 1}` : fresh[0].text); sounds.ok(); }
      first = false;
      if (baseline) localStorage.setItem(key(org), JSON.stringify(found.map(n => n.id)));
      render();
    }
    bell.addEventListener("click", () => {
      const c = ctx(); if (!c?.organization?.id) return;
      items.forEach(n => { n.read = true; });
      try { localStorage.setItem(key(c.organization.id), JSON.stringify(items.map(n => n.id))); } catch { /* ignore */ }
      setTimeout(render, 400);
    });
    setTimeout(poll, 4000);
    setInterval(poll, 45000);
  }

  const TAB_ORDER = ["dashboard", "sales", "warranties", "service"];
  function goPage(page) {
    const current = document.querySelector(".page.active")?.id?.replace("page-", "");
    const a = TAB_ORDER.indexOf(current), b = TAB_ORDER.indexOf(page);
    document.body.dataset.dir = a < 0 || b < 0 ? "up" : b > a ? "next" : "prev";
    document.querySelector(`.nav-btn[data-page="${page}"]`)?.click();
  }

  // "More": a glass sheet with every section, instead of the heavy side menu.
  function openMore() {
    if (document.querySelector("#fx-more")) return;
    const wrap = document.createElement("div");
    wrap.id = "fx-more";
    const sheet = document.createElement("div");
    sheet.className = "fx-sheet";
    const grip = document.createElement("div"); grip.className = "fx-grip";
    const grid = document.createElement("div"); grid.className = "fx-more-grid";
    const skip = new Set(TAB_ORDER);
    let delay = 0;
    document.querySelectorAll("#nav .nav-btn[data-page],.sidebar-bottom .nav-btn[data-page]").forEach(nav => {
      const page = nav.dataset.page;
      if (nav.hidden || skip.has(page)) return;
      const item = document.createElement("button");
      item.type = "button"; item.className = "fx-more-item"; item.style.animationDelay = `${delay}ms`; delay += 25;
      const ico = document.createElement("span"); ico.className = "fx-more-ico"; ico.innerHTML = nav.querySelector(".ico")?.innerHTML || "";
      const label = document.createElement("span"); label.textContent = nav.querySelector("span:not(.ico)")?.textContent || page;
      item.append(ico, label);
      const badge = nav.querySelector(".nav-badge");
      if (badge && badge.textContent.trim() !== "0") { const dot = document.createElement("i"); dot.className = "fx-more-badge"; dot.textContent = badge.textContent.trim(); item.append(dot); }
      item.addEventListener("click", () => { sounds.nav(); close(); setTimeout(() => goPage(page), 120); });
      grid.append(item);
    });
    const tools = document.createElement("div"); tools.className = "fx-more-tools";
    const user = document.querySelector("#user-menu");
    const card = document.createElement("button"); card.type = "button"; card.className = "fx-more-profile";
    const av = document.createElement("span"); av.className = "fx-more-avatar"; av.textContent = user?.querySelector(".avatar")?.textContent || "W";
    const who = document.createElement("span"); who.className = "fx-more-who";
    const nm = document.createElement("b"); nm.textContent = user?.querySelector("strong")?.textContent || "Профіль";
    const rl = document.createElement("small"); rl.textContent = user?.querySelector("small")?.textContent || "";
    who.append(nm, rl); card.append(av, who);
    card.addEventListener("click", () => { sounds.nav(); close(); setTimeout(() => goPage("team"), 120); });
    const row = document.createElement("div"); row.className = "fx-more-row";
    const mk = (text, fn) => { const b = document.createElement("button"); b.type = "button"; b.textContent = text; b.addEventListener("click", fn); return b; };
    const dark = document.documentElement.dataset.theme === "dark";
    row.append(
      mk("Швидкі команди", () => { close(); setTimeout(paletteOpen, 260); }),
      mk(dark ? "Світла тема" : "Темна тема", () => { document.querySelector("#fx-theme")?.click(); close(); }),
      mk(muted ? "Увімкнути звук" : "Вимкнути звук", () => { document.querySelector("#fx-sound")?.click(); close(); }),
      mk(document.querySelector("#lang-switch")?.textContent.trim() === "EN" ? "English" : "Українська", () => { document.querySelector("#lang-switch")?.click(); close(); }),
      mk("Вийти", () => { close(); setTimeout(() => document.querySelector('[data-action="logout"]')?.click(), 150); })
    );
    row.lastChild.classList.add("danger");
    tools.append(card, row);
    sheet.append(grip, grid, tools);
    wrap.append(sheet);
    document.body.append(wrap);
    requestAnimationFrame(() => wrap.classList.add("show"));
    function close() { wrap.classList.remove("show"); setTimeout(() => wrap.remove(), 380); }
    wrap.addEventListener("click", event => { if (event.target === wrap) { sounds.close(); close(); } });
    // Glass lens: press and slide over the tiles, release on one to open it.
    const lens = document.createElement("i");
    lens.className = "fx-more-lens";
    grid.prepend(lens);
    const tiles = () => [...grid.querySelectorAll(".fx-more-item")];
    const tileAt = (x, y) => {
      let best = null, bd = 1e9;
      for (const t of tiles()) {
        const r = t.getBoundingClientRect();
        const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
        const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
        const d = Math.hypot(dx, dy);
        if (d < bd) { bd = d; best = t; }
      }
      return bd < 40 ? best : null;
    };
    const moveLens = (tile, grabbed) => {
      if (!tile) { lens.classList.remove("on"); return; }
      const g = grid.getBoundingClientRect(), r = tile.getBoundingClientRect();
      lens.style.width = `${r.width}px`; lens.style.height = `${r.height}px`;
      lens.style.transform = `translate(${r.left - g.left}px,${r.top - g.top}px)${grabbed ? " scale(1.07)" : ""}`;
      lens.classList.add("on");
      tiles().forEach(t => t.classList.toggle("lit", t === tile));
    };
    let down = false, drag = false, sx = 0, sy = 0, last = null, suppress = false;
    grid.addEventListener("pointerdown", e => {
      down = true; drag = false; sx = e.clientX; sy = e.clientY;
      grid.classList.add("grab");
      last = tileAt(e.clientX, e.clientY);
      moveLens(last, true);
    });
    grid.addEventListener("pointermove", e => {
      if (!down) return;
      if (Math.hypot(e.clientX - sx, e.clientY - sy) > 8) drag = true;
      const t = tileAt(e.clientX, e.clientY);
      if (t !== last) { last = t; if (t) sounds.click(); }
      moveLens(t, true);
    });
    const finish = (e, cancel) => {
      if (!down) return;
      down = false;
      grid.classList.remove("grab");
      const t = cancel ? null : tileAt(e.clientX, e.clientY);
      const wasDrag = drag; drag = false;
      tiles().forEach(x => x.classList.remove("lit"));
      lens.classList.remove("on");
      if (wasDrag && t) { suppress = false; t.click(); suppress = true; setTimeout(() => { suppress = false; }, 80); }
    };
    grid.addEventListener("pointerup", e => finish(e, false));
    grid.addEventListener("pointercancel", e => finish(e, true));
    grid.addEventListener("click", e => { if (suppress) { e.stopPropagation(); e.preventDefault(); } }, true);

    // swipe down on the handle area to dismiss
    let y0 = null, dy = 0;
    const top = sheet.querySelector(".fx-grip");
    top.addEventListener("touchstart", e => { y0 = e.touches[0].clientY; dy = 0; sheet.style.transition = "none"; }, { passive: true });
    top.addEventListener("touchmove", e => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = `translateY(${dy}px)`; }, { passive: true });
    top.addEventListener("touchend", () => { sheet.style.transition = ""; sheet.style.transform = ""; if (dy > 70) close(); y0 = null; });
  }

  // Standard symbols (arrows, check marks) must not turn into colour emoji on iPhone.
  const EMOJI_RISK = /[↗↘↔↩↪↖↙⬅➡⬆⬇✔✖▶◀⚠ℹ☑✓↻⇩⇧→←↑↓](?!\uFE0E)/g;
  function plainSymbols(root = document.body) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) { const n = walker.currentNode; if (EMOJI_RISK.test(n.nodeValue)) nodes.push(n); EMOJI_RISK.lastIndex = 0; }
    for (const n of nodes) {
      if (n.parentElement?.closest("script,style")) continue;
      const trend = n.parentElement?.closest(".trend");
      if (trend && /^\s*[↗↘]/.test(n.nodeValue) && !trend.querySelector("svg")) {
        const up = n.nodeValue.trim().startsWith("↗");
        const svg = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:3px"><path d="${up ? "M7 17 17 7M8 7h9v9" : "M7 7l10 10M17 8v9H8"}"/></svg>`;
        const rest = n.nodeValue.replace(/^\s*[↗↘]\uFE0E?\s*/, "");
        const holder = document.createElement("span"); holder.innerHTML = svg;
        n.nodeValue = rest; n.parentNode.insertBefore(holder.firstChild, n);
        continue;
      }
      n.nodeValue = n.nodeValue.replace(EMOJI_RISK, "$&\uFE0E");
    }
  }
  let tblQueued = false;
  const queueTables = () => { if (!tblQueued) { tblQueued = true; requestAnimationFrame(() => { tblQueued = false; labelTables(); }); } };
  let symQueued = false;
  const queueSymbols = () => { if (!symQueued) { symQueued = true; requestAnimationFrame(() => { symQueued = false; plainSymbols(); }); } };


  // ---- Glass pass: sliding lens in the desktop menu, table rows as cards on phones, swipe-down modals ----
  function labelTables() {
    document.querySelectorAll(".page table").forEach(table => {
      const heads = [...table.querySelectorAll("thead th")].map(th => th.textContent.trim());
      if (!heads.length) return;
      table.classList.add("fx-cards");
      table.querySelectorAll("tbody tr").forEach(row => {
        const cells = [...row.children];
        if (cells.length !== heads.length) return;
        cells.forEach((cell, i) => { if (cell.dataset.label !== heads[i]) cell.dataset.label = heads[i]; });
      });
    });
  }

  function navLens() {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar || sidebar.querySelector(".fx-navlens")) return;
    const lens = document.createElement("i");
    lens.className = "fx-navlens";
    sidebar.prepend(lens);
    const place = () => {
      const active = sidebar.querySelector(".nav-btn.active:not([hidden])");
      if (!active || matchMedia("(max-width:760px)").matches) { lens.style.opacity = "0"; return; }
      const s = sidebar.getBoundingClientRect(), r = active.getBoundingClientRect();
      lens.style.opacity = "1";
      lens.style.height = `${r.height}px`; lens.style.width = `${r.width}px`;
      lens.style.transform = `translate(${r.left - s.left}px,${r.top - s.top + sidebar.scrollTop}px)`;
      lens.classList.add("ready");
    };
    let q = false;
    const queue = () => { if (!q) { q = true; requestAnimationFrame(() => { q = false; place(); }); } };
    new MutationObserver(queue).observe(sidebar, { attributes: true, subtree: true, attributeFilter: ["class", "hidden"] });
    addEventListener("resize", queue);
    sidebar.addEventListener("scroll", queue, { passive: true });
    setTimeout(place, 300); setTimeout(place, 1200);
  }

  function modalSwipe() {
    const overlay = document.querySelector("#modal-overlay"), modal = document.querySelector("#modal");
    if (!overlay || !modal) return;
    let y0 = null, dy = 0;
    modal.addEventListener("touchstart", e => {
      if (!matchMedia("(max-width:760px)").matches || !e.target.closest(".modal-head")) return;
      y0 = e.touches[0].clientY; dy = 0; modal.style.transition = "none";
    }, { passive: true });
    modal.addEventListener("touchmove", e => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); modal.style.transform = `translateY(${dy}px)`; }, { passive: true });
    modal.addEventListener("touchend", () => {
      if (y0 === null) return;
      modal.style.transition = ""; modal.style.transform = ""; y0 = null;
      if (dy > 90) document.querySelector("#modal-close")?.click();
    });
  }

  // Bottom tab bar on phones: the five things used most, plus the full menu.
  function tabbar() {
    if ($tab("#fx-tabbar")) return;
    const defs = [["dashboard", "Огляд", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>'],
      ["sales", "Продажі", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2.5l2.2 10.5h10.6L20.5 8H6.5"/></svg>'],
      ["warranties", "Гарантії", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z"/></svg>'],
      ["service", "Сервіс", ICON.wrench], ["menu", "Ще", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>']];
    const bar = document.createElement("nav");
    bar.id = "fx-tabbar"; bar.className = "fx-tabbar";
    const lens = document.createElement("i");
    lens.className = "fx-lens";
    bar.append(lens);
    for (const [page, label, icon] of defs) {
      const b = document.createElement("button");
      b.type = "button"; b.dataset.tab = page; b.innerHTML = `${icon}<span>${label}</span>`;
      b.addEventListener("click", () => {
        sounds.nav();
        if (page === "menu") { openMore(); return; }
        goPage(page);
      });
      bar.append(b);
    }
    document.body.append(bar);

    const buttons = () => [...bar.querySelectorAll("button:not([hidden])")];
    const place = (button, stretch = false) => {
      if (!button) { lens.style.opacity = "0"; return; }
      lens.style.opacity = "1";
      lens.style.width = `${button.offsetWidth}px`;
      lens.style.transform = `translateX(${button.offsetLeft}px)${stretch ? " scale(1.1,1.06)" : ""}`;
    };
    const sync = () => {
      const active = document.querySelector(".page.active")?.id?.replace("page-", "");
      bar.querySelectorAll("button").forEach(b => {
        b.classList.toggle("on", b.dataset.tab === active);
        const nav = document.querySelector(`.nav-btn[data-page="${b.dataset.tab}"]`);
        b.hidden = b.dataset.tab !== "menu" && (!nav || nav.hidden);
      });
      if (!bar.classList.contains("grab")) place(bar.querySelector("button.on"));
    };
    let busy = false, again = false;
    const safe = () => { if (busy) { again = true; return; } busy = true; sync(); setTimeout(() => { busy = false; if (again) { again = false; safe(); } }, 120); };
    new MutationObserver(safe).observe(document.body, { attributes: true, subtree: true, attributeFilter: ["class", "hidden"] });
    addEventListener("resize", sync);

    // Liquid-glass behaviour: press to magnify the lens, drag it between tabs, release to choose.
    let startX = 0, dragging = false, down = false;
    const under = x => {
      const r = bar.getBoundingClientRect();
      return buttons().find(b => { const br = b.getBoundingClientRect(); return x >= br.left && x <= br.right; }) || buttons().reduce((best, b) => {
        const c = b.getBoundingClientRect(); const d = Math.abs(x - (c.left + c.width / 2));
        return !best || d < best.d ? { b, d } : best;
      }, null)?.b || null;
    };
    bar.addEventListener("pointerdown", event => {
      down = true; dragging = false; startX = event.clientX;
      bar.classList.add("grab");
      place(under(event.clientX), true);
    });
    bar.addEventListener("pointermove", event => {
      if (!down) return;
      if (Math.abs(event.clientX - startX) > 8) dragging = true;
      const target = under(event.clientX);
      if (target) place(target, true);
    });
    let suppress = false;
    const release = event => {
      if (!down) return;
      down = false;
      bar.classList.remove("grab");
      const target = under(event.clientX);
      const wasDrag = dragging;
      dragging = false;
      if (wasDrag && target) { suppress = false; target.click(); suppress = true; setTimeout(() => { suppress = false; }, 80); }
      setTimeout(sync, 0);
    };
    bar.addEventListener("pointerup", release);
    bar.addEventListener("pointercancel", () => { down = false; bar.classList.remove("grab"); sync(); });
    bar.addEventListener("click", event => { if (suppress) { event.stopPropagation(); event.preventDefault(); } }, true);
    requestAnimationFrame(() => { sync(); bar.classList.add("ready"); });
  }
  const $tab = selector => document.querySelector(selector);
  document.addEventListener("click", event => {
    if (matchMedia("(max-width:760px)").matches && event.target.closest("#sidebar .nav-btn[data-page]")) document.querySelector("#sidebar")?.classList.remove("open");
  });


  // Smooth entrance of the whole app after sign-in / session restore / splash.
  function appReveal() {
    const root = document.documentElement;
    let busy = false;
    const run = () => {
      if (busy || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const splash = document.querySelector("#warrio-intro");
      if (splash && root.classList.contains("intro") && !splash.classList.contains("out")) { setTimeout(run, 150); return; }
      busy = true;
      document.querySelectorAll(".page.active :is(.card,.stat,.metric,.job,.dealer,.kanban-col)").forEach((el, i) => el.style.setProperty("--ai", Math.min(i, 9)));
      root.classList.add("app-in");
      setTimeout(() => { root.classList.remove("app-in"); busy = false; }, 2400);
    };
    const gate = document.querySelector("#auth-gate");
    if (!gate) { run(); return; }
    let wasHidden = gate.hidden;
    new MutationObserver(() => { if (gate.hidden && !wasHidden) run(); wasHidden = gate.hidden; }).observe(gate, { attributes: true, attributeFilter: ["hidden"] });
    if (gate.hidden) run();
  }

  // Highlight attention rows that actually have something to look at.
  function markAttention() {
    document.querySelectorAll(".attention-row").forEach(row => {
      const n = parseInt(row.querySelector(".count")?.textContent || "0", 10) || 0;
      row.classList.toggle("hot", n > 0);
    });
  }

  // ---- Command palette (Ctrl/Cmd+K) ----
  const palette = { el: null, items: [], idx: 0 };
  function paletteCommands() {
    const out = [];
    document.querySelectorAll(".nav-btn[data-page]").forEach(btn => {
      if (btn.hidden || btn.closest("[hidden]")) return;
      const label = btn.textContent.replace(/\s+/g, " ").replace(/\d+$/, "").trim();
      if (!label) return;
      out.push({ group: "Сторінки", label, icon: btn.querySelector("svg")?.outerHTML || "", run: () => btn.click() });
    });
    const act = (label, hint, sel) => { const el = document.querySelector(sel); if (el) out.push({ group: "Дії", label, hint, icon: "", run: () => el.click() }); };
    act("Зареєструвати продаж", "Новий SN і дилер", '[data-modal="sale"]');
    act("Створити PDF-сертифікат", "Гарантійний документ", '[data-modal="certificate"]');
    act("Синхронізувати дані", "Оновити з сервера", '[data-action="sync"]');
    act("Перевірити QR / публічний статус", "Сторінка покупця", '[data-action="show-public"]');
    const dark = document.documentElement.dataset.theme === "dark";
    out.push({ group: "Налаштування", label: dark ? "Світла тема" : "Темна тема", hint: "Перемкнути вигляд", icon: "", run: () => document.querySelector("#fx-theme")?.click() });
    out.push({ group: "Налаштування", label: "Звук інтерфейсу", hint: "Увімкнути або вимкнути", icon: "", run: () => document.querySelector("#fx-sound")?.click() });
    const lang = document.querySelector("#lang-switch");
    if (lang) out.push({ group: "Налаштування", label: lang.textContent.trim() === "EN" ? "English" : "Українська", hint: "Мова інтерфейсу", icon: "", run: () => lang.click() });
    return out;
  }
  function paletteRender() {
    const list = palette.el.querySelector(".fx-cmd-list");
    const q = palette.el.querySelector("input").value.trim().toLowerCase();
    let items = paletteCommands();
    if (q) {
      const words = q.split(/\s+/);
      items = items.filter(i => words.every(w => (i.label + " " + (i.hint || "")).toLowerCase().includes(w)))
        .sort((a, b) => (b.label.toLowerCase().startsWith(q) ? 1 : 0) - (a.label.toLowerCase().startsWith(q) ? 1 : 0));
      items.push({ group: "Пошук", label: `Шукати «${palette.el.querySelector("input").value.trim()}» у гарантіях, клієнтах і дилерах`, hint: "", icon: "", run: () => { const s = document.querySelector("#global-search"); if (s) { s.value = palette.el.querySelector("input").value.trim(); s.dispatchEvent(new Event("input", { bubbles: true })); setTimeout(() => s.focus(), 30); } } });
    }
    palette.items = items; palette.idx = Math.min(palette.idx, Math.max(0, items.length - 1));
    list.textContent = "";
    let group = "";
    items.forEach((item, i) => {
      if (item.group !== group) { group = item.group; const h = document.createElement("div"); h.className = "fx-cmd-group"; h.textContent = group; list.append(h); }
      const row = document.createElement("button");
      row.type = "button"; row.className = "fx-cmd-item" + (i === palette.idx ? " on" : "");
      row.innerHTML = `<span class="fx-cmd-ico">${item.icon || ""}</span><span class="fx-cmd-t"></span><small></small>`;
      row.querySelector(".fx-cmd-t").textContent = item.label; row.querySelector("small").textContent = item.hint || "";
      row.addEventListener("mousemove", () => { if (palette.idx !== i) { palette.idx = i; paletteMark(); } });
      row.addEventListener("click", () => paletteRun(i));
      list.append(row);
    });
    if (!items.length) { const e = document.createElement("div"); e.className = "fx-cmd-empty"; e.textContent = "Нічого не знайдено"; list.append(e); }
  }
  function paletteMark() { palette.el.querySelectorAll(".fx-cmd-item").forEach((r, i) => { r.classList.toggle("on", i === palette.idx); if (i === palette.idx) r.scrollIntoView({ block: "nearest" }); }); }
  function paletteRun(i) { const item = palette.items[i]; paletteClose(); if (item) setTimeout(item.run, 120); }
  function paletteClose() { if (!palette.el) return; const el = palette.el; palette.el = null; el.classList.remove("open"); setTimeout(() => el.remove(), 260); }
  function paletteOpen() {
    if (palette.el) return paletteClose();
    document.querySelector("#fx-more")?.remove();
    const el = document.createElement("div"); el.className = "fx-cmd";
    el.innerHTML = `<div class="fx-cmd-box" role="dialog" aria-label="Швидкі команди"><div class="fx-cmd-top"><input type="text" placeholder="Куди перейти або що зробити?" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="go"><kbd>Esc</kbd></div><div class="fx-cmd-list"></div><div class="fx-cmd-foot"><span>↑↓ вибір</span><span>Enter відкрити</span><span>Esc закрити</span></div></div>`;
    document.body.append(el); palette.el = el; palette.idx = 0; paletteRender();
    requestAnimationFrame(() => el.classList.add("open"));
    const input = el.querySelector("input"); setTimeout(() => input.focus(), 40);
    el.addEventListener("mousedown", e => { if (e.target === el) paletteClose(); });
    input.addEventListener("input", () => { palette.idx = 0; paletteRender(); });
    input.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); palette.idx = (palette.idx + 1) % Math.max(1, palette.items.length); paletteMark(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); palette.idx = (palette.idx - 1 + palette.items.length) % Math.max(1, palette.items.length); paletteMark(); }
      else if (e.key === "Enter") { e.preventDefault(); paletteRun(palette.idx); }
      else if (e.key === "Escape") { e.preventDefault(); paletteClose(); }
    });
  }
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); e.stopImmediatePropagation(); if (!document.querySelector("#auth-gate:not([hidden])")) paletteOpen(); }
  }, true);
  document.addEventListener("click", e => { if (e.target.closest?.(".search kbd")) paletteOpen(); });

  // ---- Confetti burst for happy moments ----
  function confetti(x, y) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cv = document.createElement("canvas"), dpr = Math.min(2, devicePixelRatio || 1);
    cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483000";
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; document.body.append(cv);
    const c = cv.getContext("2d"); c.scale(dpr, dpr);
    const cx = x ?? innerWidth / 2, cy = y ?? innerHeight * 0.38, colors = ["#6a52f5", "#8b74ff", "#c9bcff", "#23c882", "#ffb832", "#ff6f91", "#ffffff"];
    const bits = Array.from({ length: 90 }, () => { const a = Math.random() * Math.PI * 2, v = 5 + Math.random() * 9; return { x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, w: 5 + Math.random() * 6, h: 3 + Math.random() * 4, r: Math.random() * 6, vr: (Math.random() - .5) * .35, col: colors[(Math.random() * colors.length) | 0] }; });
    const t0 = performance.now();
    (function frame(now) {
      const t = (now - t0) / 1900; c.clearRect(0, 0, innerWidth, innerHeight);
      bits.forEach(b => { b.vy += .28; b.vx *= .992; b.x += b.vx; b.y += b.vy; b.r += b.vr; c.save(); c.globalAlpha = Math.max(0, 1 - t * t); c.translate(b.x, b.y); c.rotate(b.r); c.fillStyle = b.col; c.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); c.restore(); });
      if (t < 1) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  }
  window.WarrioFx = Object.assign(window.WarrioFx || {}, { confetti, openPalette: paletteOpen });

  // ---- Cursor glow + grain texture on cards ----
  function surfaces() {
    const fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
    document.querySelectorAll(".stat,.auth-gate,.dealer-card,.doc,.team-card").forEach(el => {
      if (!el.querySelector(":scope > .fx-grain")) { const g = document.createElement("fx-fill"); g.className = "fx-grain"; g.setAttribute("aria-hidden", "true"); el.append(g); }
    });
    if (!fine) return;
    document.querySelectorAll(".stat,.dealer-card,.doc,.team-card,.quick-btn,.card[data-page-link]").forEach(el => {
      if (el.dataset.fxGlow) return; el.dataset.fxGlow = "1";
      const g = document.createElement("fx-fill"); g.className = "fx-glow"; g.setAttribute("aria-hidden", "true"); el.append(g);
      el.addEventListener("pointermove", e => { const r = el.getBoundingClientRect(); el.style.setProperty("--mx", (e.clientX - r.left) + "px"); el.style.setProperty("--my", (e.clientY - r.top) + "px"); });
    });
  }

  // ---- Password strength + form shake ----
  function strength(v) {
    let s = 0;
    if (v.length >= 8) s++; if (v.length >= 12) s++;
    if (/[a-zа-яіїє]/.test(v) && /[A-ZА-ЯІЇЄ]/.test(v)) s++;
    if (/\d/.test(v) && /[^\w\s]/.test(v)) s++;
    return v ? Math.max(1, s) : 0;
  }
  document.addEventListener("input", e => {
    const t = e.target;
    if (!t.matches?.("#signup-password,#reset-password")) return;
    let m = t.parentElement.querySelector(".fx-meter");
    if (!m) { m = document.createElement("div"); m.className = "fx-meter"; m.innerHTML = "<i></i><i></i><i></i><i></i><span></span>"; t.after(m); }
    const s = strength(t.value);
    m.dataset.s = s; m.querySelector("span").textContent = ["", "Слабкий пароль", "Нормальний", "Добрий", "Сильний пароль"][s];
  });
  new MutationObserver(list => list.forEach(r => {
    const el = r.target.nodeType === 1 ? r.target : r.target.parentElement;
    if (el?.classList?.contains("auth-error") && el.textContent.trim()) { const v = el.closest(".auth-panel") || el.parentElement; v.classList.remove("fx-shake"); void v.offsetWidth; v.classList.add("fx-shake"); }
  })).observe(document.body, { subtree: true, childList: true, characterData: true });

  // Give icon-only buttons an accessible name (screen readers, voice control, SEO a11y score).
  function ariaNames() {
    const names = { "fx-theme": "Темна / світла тема", "fx-sound": "Звук інтерфейсу", "fx-bell": "Сповіщення", "modal-close": "Закрити", "mobile-menu": "Меню" };
    document.querySelectorAll("button,a[role=button],[role=button]").forEach(el => {
      if (el.getAttribute("aria-label") || el.textContent.trim()) return;
      const label = names[el.id] || (el.classList.contains("notifications") ? "Сповіщення" : "") || (el.classList.contains("fx-sel-btn") ? "Вибрати значення" : "") || el.title || el.dataset.tip || "";
      if (label) el.setAttribute("aria-label", label);
    });
  }

  function start() {
    appReveal();
    tabbar();
    const host = document.querySelector(".top-actions");
    if (host) host.prepend(sound(), theme());
    restructure(); icons(); notifications();
    document.querySelectorAll("select").forEach(enhanceSelect);
    watch(); scan(); markAttention(); surfaces(); ariaNames(); numbers(); plainSymbols(); labelTables(); fieldHints(); navLens(); modalSwipe();
    new MutationObserver(() => { scan(); markAttention(); surfaces(); ariaNames(); queueNumbers(); queueSymbols(); queueTables(); fieldHints(); restructure(); icons(); document.querySelectorAll("select:not([data-fx])").forEach(enhanceSelect); })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
