(() => {
  "use strict";
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const eo = p => 1 - Math.pow(1 - p, 4);
  const eb = p => { const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
  const CAPS = ["", "Склад: прийом за серійними номерами", "Продаж дилером за хвилину", "Покупець сам активує гарантію", "Монтаж підтверджено одним кліком", ""];
  const TEXT = "Я хочу, щоб гарантії працювали самі…";
  let seed = 11; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  $("#qr").innerHTML = Array.from({ length: 121 }, (_, i) => { const x = i % 11, y = Math.floor(i / 11); const finder = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7); return `<i class="${finder || rnd() > .5 ? "" : "w"}"></i>`; }).join("");
  const scenes = $$(".sc").map((el, i) => ({ el, s: +el.dataset.s, e: +el.dataset.e, i }));
  function render(t) {
    // background motion
    const a = $(".orb.a"), b = $(".orb.b"), c = $(".orb.c");
    a.style.transform = `translate(${Math.sin(t * .5) * 70}px,${Math.cos(t * .4) * 60}px) scale(${1 + Math.sin(t * .7) * .12})`;
    b.style.transform = `translate(${Math.cos(t * .45) * -60}px,${Math.sin(t * .55) * 80}px) scale(${1 + Math.cos(t * .6) * .1})`;
    c.style.transform = `translate(${Math.sin(t * .35) * 80}px,${Math.cos(t * .5) * -50}px)`;
    let activeIdx = -1;
    for (const sc of scenes) {
      const on = t >= sc.s && t < sc.e;
      sc.el.style.display = on ? "flex" : "none";
      if (!on) continue;
      activeIdx = sc.i;
      const u = t - sc.s, dur = sc.e - sc.s;
      const out = clamp((u - (dur - .4)) / .4);
      sc.el.style.opacity = 1 - out;
      sc.el.style.transform = `scale(${1 - out * .04})`;
      sc.el.style.filter = out ? `blur(${out * 10}px)` : "none";
      sc.el.querySelectorAll("[data-at]").forEach(el => {
        const p = clamp((u - +el.dataset.at) / +(el.dataset.dur || .55));
        const k = eo(p);
        el.style.opacity = k;
        el.style.transform = `translateY(${(1 - eb(p)) * 36}px) scale(${.94 + .06 * k})`;
        el.style.filter = p < 1 ? `blur(${(1 - k) * 12}px)` : "none";
      });
      if (sc.i === 0) {
        const n = Math.floor(clamp((u - .3) / 2.4) * TEXT.length);
        $("#t0").textContent = TEXT.slice(0, n);
        $(".caret").style.opacity = Math.floor(t * 2.2) % 2 ? .1 : 1;
      }
      if (sc.i === 1) $("#cnt").textContent = `+${Math.round(eo(clamp((u - .4) / 1.6)) * 120)} шт.`;
      if (sc.i === 4) {
        const press = clamp((u - 1.2) / .25), rel = clamp((u - 1.45) / .3);
        const g = $("#gbtn"), ck = $("#check");
        const scl = 1 - .08 * Math.sin(press * Math.PI * (rel < 1 ? 1 : 0)) ;
        g.style.transform = `scale(${u > 1.2 ? scl : 1})`;
        const k = clamp((u - 1.5) / .5);
        ck.style.opacity = k;
        ck.style.transform = `scale(${eb(k)})`;
        sc.el.querySelector(".panel").style.opacity = u > 1.5 ? 1 - .75 * eo(clamp((u - 1.5) / .5)) : 1;
        sc.el.querySelector(".panel").style.filter = u > 1.5 ? `blur(${6 * eo(clamp((u - 1.5) / .5))}px)` : "none";
      }
    }
    $("#cap").textContent = CAPS[activeIdx] || "";
    $("#cap").style.opacity = activeIdx > 0 && activeIdx < 5 ? 1 : 0;
  }
  function $$q(sel, root) { return root.querySelector(sel); }
  window.renderAt = render;
  const q = new URLSearchParams(location.search);
  if (q.get("t") !== null) render(+q.get("t"));
  else { const t0 = performance.now(); const loop = () => { render(((performance.now() - t0) / 1000) % 19); requestAnimationFrame(loop); }; loop(); }
})();
