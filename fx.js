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
        const text = (n.textContent || "").toLowerCase();
        sounds[/помилк|не вдалося|перевірте|недостатньо|error|failed/.test(text) ? "error" : "ok"]();
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

  function start() {
    const host = document.querySelector(".top-actions");
    if (host) host.prepend(fontPicker(), sound(), theme());
    restructure(); icons(); notifications();
    document.querySelectorAll("select").forEach(enhanceSelect);
    watch(); scan();
    new MutationObserver(() => { scan(); restructure(); icons(); document.querySelectorAll("select:not([data-fx])").forEach(enhanceSelect); })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
