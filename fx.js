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

  function sound() {
    const b = document.createElement("button");
    b.id = "fx-sound"; b.type = "button"; b.title = "Звуки";
    const draw = () => { b.textContent = muted ? "🔇" : "🔊"; };
    draw();
    b.addEventListener("click", event => {
      event.stopPropagation();
      muted = !muted;
      try { localStorage.setItem("warrio-sound", muted ? "off" : "on"); } catch { /* ignore */ }
      draw();
      if (!muted) sounds.ok();
    });
    const host = document.querySelector(".top-actions"); if (host) host.prepend(b); else document.body.appendChild(b);
  }

  function start() { sound(); watch(); scan(); new MutationObserver(scan).observe(document.body, { childList: true, subtree: true, characterData: true }); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
