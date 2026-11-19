(() => {
  "use strict";
  const $ = s => document.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;
  const eo = p => 1 - Math.pow(1 - p, 4);
  const eio = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const eb = p => { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
  const blur = (el, px) => { el.style.filter = px > .05 ? `blur(${px.toFixed(2)}px)` : "none"; };

  // ---------- setup ----------
  const ICON = {
    box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8", cart: "M3 4h2l2.5 10h10.5l2-7H6.5M9 19.5h.01M17 19.5h.01",
    shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z", wrench: "M14.7 6.3a4 4 0 005 5L21 13l-8 8-4-4 8-8M9 17l-3 3", bolt: "M13 2L4 14h7l-1 8 9-12h-7l1-8z"
  };
  const CHIPS = [["box", "Склад"], ["cart", "Продаж"], ["shield", "Гарантія"], ["wrench", "Монтаж"], ["bolt", "Автоматизація"]];
  $("#chips").innerHTML = CHIPS.map(([i, n]) => `<div class="chip"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e6deff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICON[i]}"/></svg>${n}</div>`).join("");
  const word = $("#word"); word.innerHTML = [..."Warrio"].map(c => `<i>${c}</i>`).join("");
  let seed = 11; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  $("#qr").innerHTML = Array.from({ length: 121 }, (_, i) => { const x = i % 11, y = Math.floor(i / 11); const f = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7); return `<i class="${f || rnd() > .5 ? "" : "w"}"></i>`; }).join("");
  $("#stripes").innerHTML = Array.from({ length: 12 }, () => "<i></i>").join("");
  const stripes = [...$("#stripes").children];
  const LINES = ['INSERT sale { sn: "N600-26-00201" }', 'dealer: "Клімат Плюс", model: NAVI 600', 'status: "pending_buyer"  // створено', 'rpc("register_warrio_sale", { ... })', 'audit.log("sale.registered")', 'warranty.number = "WRR-2026-004821"', 'pdf.generate(qr: true) → email.send()', 'RLS: organization_id = auth.org()'];
  const stream = $("#stream");
  stream.innerHTML = Array.from({ length: 16 }, (_, i) => `<div data-i="${i}" style="left:${(i * 67) % 560 + 20}px;color:${["#d9ceff", "#9be8ff", "#ffb4e6", "#a8ffcf"][i % 4]}">${LINES[i % LINES.length]}</div>`).join("");
  const streamRows = [...stream.children];
  const chipEls = [...$("#chips").children];
  let chipC = [];
  const dust = $("#dust"), dctx = dust.getContext("2d");
  const parts = Array.from({ length: 70 }, () => ({ x: rnd() * 960, y: rnd() * 540, r: .6 + rnd() * 1.8, s: .2 + rnd() * .6, ph: rnd() * 6.28 }));
  const SLOGAN = "Гарантії — простіше.";
  const slogan = $("#slogan"); let slogPos = [];
  function measure() {
    chipC = chipEls.map(el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
    slogan.innerHTML = ""; const probe = document.createElement("span"); probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font:inherit;letter-spacing:inherit"; slogan.appendChild(probe);
    const widths = []; let x = 0;
    for (const ch of SLOGAN) { probe.textContent = SLOGAN.slice(0, SLOGAN.indexOf(ch, 0) >= 0 ? 0 : 0); widths.push(0); }
    // cumulative widths by prefix
    slogPos = []; for (let i = 0; i <= SLOGAN.length; i++) { probe.textContent = SLOGAN.slice(0, i); slogPos.push(probe.getBoundingClientRect().width); }
    const total = slogPos[SLOGAN.length], off = (760 - total) / 2;
    slogan.innerHTML = [...SLOGAN].map((c, i) => `<i style="left:${(off + slogPos[i]).toFixed(1)}px">${c}</i>`).join("");
  }
  const sloganEls = () => [...slogan.children];

  const bg = $("#bg"), s1 = $(".s1"), s2 = $(".s2"), brand = $("#brand"), mark = $("#mark"), chipsBox = $("#chips"), cursor = $("#cursor"), prompt = $("#prompt"), ptext = $("#ptext"), pcaret = $("#pcaret");
  const c1 = $("#c1"), c2 = $("#c2"), c3 = $("#c3"), st = [$("#st1"), $("#st2"), $("#st3")], pdf = $("#pdf"), mail = $("#mail"), gbtn = $("#gbtn"), check = $("#check"), mst = $("#mst");
  const white = $("#white"), fin = $("#final"), sub = $("#sub");
  const T1 = "Зареєструй продаж NAVI 600 для дилера «Клімат Плюс»", T2 = "Покупець активує гарантію і отримує PDF з QR", T3 = "Підтверди монтаж №17";

  function card3d(el, p, outP = 0) {
    const e = eo(p), k = eb(p);
    el.style.opacity = e * (1 - outP);
    el.style.transform = `translateY(${(1 - k) * 60}px) rotateX(${(1 - e) * 55}deg) rotateY(${(1 - e) * -28}deg) scale(${.78 + .22 * e})`;
    blur(el, (1 - e) * 10 + outP * 8);
    [...el.children].forEach((ch, i) => {
      if (ch.classList.contains("row") || ch.classList.contains("ph") || ch.classList.contains("btnwrap") || ch.classList.contains("detail") || ch.classList.contains("qrcol")) {
        const q = eo(seg(p, .35 + i * .08, .75 + i * .08)); ch.style.opacity = q; ch.style.transform = `translateY(${(1 - q) * 16}px)`;
      }
    });
  }
  function typeInto(text, start, dur, t) { return text.slice(0, Math.floor(clamp((t - start) / dur) * text.length)); }

  function render(t) {
    // ---- background ----
    const blueMix = eio(seg(t, 16.0, 17.4)) * (1 - seg(t, 26.6, 27.0));
    const H = lerp(217, 183, blueMix);
    const dim = lerp(1, .62, seg(t, 9, 11)) ;
    const intro = eo(seg(t, 0, 1.4));
    bg.style.opacity = intro;
    const flt = `hue-rotate(${H}deg) saturate(1.35) brightness(${(0.78 * dim).toFixed(3)}) contrast(1.25)`;
    s1.style.filter = flt; s2.style.filter = flt;
    s1.style.transform = `rotate(${t * 2.4 - 6}deg) scale(${1.05 + Math.sin(t * .5) * .07}) translate(${Math.sin(t * .35) * 40}px,${Math.cos(t * .3) * 24}px)`;
    s2.style.transform = `scaleX(-1) rotate(${-t * 1.8 + 18}deg) scale(${1.2 + Math.cos(t * .42) * .08}) translate(${Math.cos(t * .3) * 50}px,${Math.sin(t * .4) * 30}px)`;
    s2.style.opacity = .4;
    // dust
    dctx.clearRect(0, 0, 960, 540);
    if (t < 27.4) for (const p of parts) { const x = (p.x + t * 12 * p.s) % 960, y = (p.y - t * 9 * p.s + 540 * 4) % 540, a = (.25 + .35 * Math.sin(t * 1.5 + p.ph)) * intro; dctx.fillStyle = `rgba(225,210,255,${Math.max(0, a)})`; dctx.beginPath(); dctx.arc(x, y, p.r, 0, 6.283); dctx.fill(); }

    // ---- brand intro ----
    const logoP = seg(t, 1.0, 2.3), wordP = seg(t, 2.1, 3.5), brandOut = eio(seg(t, 4.2, 4.9));
    brand.style.opacity = eo(logoP) * (1 - brandOut);
    mark.style.transform = `scale(${lerp(.4, 1, eb(logoP))}) rotate(${(1 - eo(logoP)) * -40}deg)`;
    blur(mark, (1 - eo(logoP)) * 14);
    [...word.children].forEach((c, i) => { const q = eo(seg(wordP, i * .09, .55 + i * .09)); c.style.opacity = q; c.style.transform = `translateY(${(1 - q) * 22}px)`; c.style.filter = q < 1 ? `blur(${(1 - q) * 10}px)` : "none"; });
    const letterGap = lerp(36, 0, eo(wordP)); word.style.letterSpacing = `${letterGap * .35 - 1.5}px`;
    word.style.maxWidth = `${lerp(0, 340, eo(wordP))}px`;
    brand.style.transform = `translateY(${-brandOut * 70}px) scale(${1 - brandOut * .12})`;
    blur(brand, brandOut * 14);

    // ---- chips + cursor ----
    const chipsIn = seg(t, 4.7, 5.9), chipsOut = eio(seg(t, 9.0, 9.5));
    chipsBox.style.opacity = t >= 4.7 && t < 9.6 ? 1 : 0;
    chipEls.forEach((c, i) => {
      const q = eo(seg(chipsIn, i * .12, .5 + i * .12));
      let o = q, tr = `translateY(${(1 - q) * 28}px) scale(${.9 + .1 * q})`, f = (1 - q) * 10;
      const hovered = chipHover(t) === i;
      if (hovered) { tr += " scale(1.07)"; c.style.borderColor = "rgba(235,225,255,.98)"; c.style.boxShadow = "0 0 40px rgba(170,140,255,.85),inset 0 1px 0 rgba(255,255,255,.5)"; c.style.background = "rgba(60,35,140,.65)"; }
      else { c.style.borderColor = "rgba(190,170,255,.55)"; c.style.boxShadow = "0 0 26px rgba(130,100,255,.35),inset 0 1px 0 rgba(255,255,255,.35)"; c.style.background = "rgba(14,8,40,.55)"; }
      if (i === 1) { const press = seg(t, 8.55, 8.75) * (1 - seg(t, 8.75, 8.95)); tr += ` scale(${1 - .09 * press})`; o *= 1 - seg(t, 9.0, 9.2); }
      else { o *= 1 - chipsOut; f += chipsOut * 12; tr += ` translateY(${chipsOut * 20}px)`; }
      c.style.opacity = o; c.style.transform = tr; c.style.filter = f > .05 ? `blur(${f}px)` : "none";
    });
    if (chipC.length) {
      const path = [[5.5, 1000, 320], [6.2, chipC[4].x, chipC[4].y], [6.9, chipC[0].x, chipC[0].y], [7.5, chipC[2].x, chipC[2].y], [8.1, chipC[3].x, chipC[3].y], [8.55, chipC[1].x, chipC[1].y + 4]];
      let cx = path[0][1], cy = path[0][2];
      for (let i = 0; i < path.length - 1; i++) if (t >= path[i][0]) { const k = eio(seg(t, path[i][0], path[i + 1][0])); cx = lerp(path[i][1], path[i + 1][1], k); cy = lerp(path[i][2], path[i + 1][2], k); }
      if (t >= path[path.length - 1][0]) { cx = path[path.length - 1][1]; cy = path[path.length - 1][2]; }
      cursor.style.opacity = t > 5.5 && t < 9.5 ? Math.min(1, seg(t, 5.5, 6)) * (1 - seg(t, 9.0, 9.4)) : 0;
      cursor.style.transform = `translate(${cx - 6}px,${cy - 4}px) scale(${1 - .15 * (seg(t, 8.55, 8.75) * (1 - seg(t, 8.75, 8.95)))})`;
    }

    // ---- prompt bar ----
    const morph = eo(seg(t, 9.0, 9.8)), toBottom = eio(seg(t, 10.4, 11.3));
    const showPrompt = t >= 9.0 && t < 27.0;
    let w = lerp(chipC[1]?.w || 130, 620, morph), h = lerp(52, 62, morph);
    let yc = lerp(270, 480, toBottom);
    const pOut = eio(seg(t, 26.6, 27.0));
    prompt.style.opacity = showPrompt ? Math.min(1, seg(t, 9.0, 9.3)) * (1 - pOut) : 0;
    prompt.style.width = `${w}px`; prompt.style.height = `${h}px`; prompt.style.marginLeft = `${-w / 2}px`; prompt.style.top = `${yc - h / 2}px`;
    prompt.style.borderRadius = `${lerp(26, 24, morph)}px`;
    const txtAlpha = seg(t, 9.5, 9.9);
    ptext.style.opacity = txtAlpha; $(".plus").style.opacity = txtAlpha * .85; $(".pr").style.opacity = txtAlpha;
    let txt = "";
    if (t < 17.0) txt = typeInto(T1, 9.9, 2.2, t); else if (t < 23.4) txt = typeInto(T2, 17.0, 1.9, t); else txt = typeInto(T3, 23.4, 1.2, t);
    ptext.textContent = txt; pcaret.style.opacity = Math.floor(t * 2.4) % 2 ? .15 : 1;

    // ---- code stream ----
    const sP = seg(t, 10.8, 11.4) * (1 - seg(t, 12.2, 13.0));
    stream.style.opacity = sP * .8;
    streamRows.forEach((r, i) => { const sp = 60 + (i % 5) * 26; const y = ((i * 41 + 560 - (t - 10.8) * sp) % 560); r.style.top = `${y}px`; r.style.transform = `translateX(${Math.sin(t * 1.2 + i) * 10}px) scale(${1 + (i % 3) * .12})`; r.style.filter = `blur(${(i % 3) * .8}px)`; });
    stream.style.transform = `perspective(700px) rotateX(18deg) translateY(-30px)`;

    // ---- cards ----
    const A = seg(t, 12.2, 13.6), Aout = seg(t, 16.0, 16.8);
    c1.style.display = t >= 12.2 && t < 16.9 ? "grid" : "none";
    if (c1.style.display !== "none") card3d(c1, A, 0);
    st.forEach((s, i) => { const p0 = 14.1 + i * .45, q = seg(t, p0, p0 + .7), o = 1 - seg(t, 15.9, 16.4); s.style.opacity = eo(q) * o; s.style.transform = `translateY(${(1 - eb(q)) * 50}px) scale(${.7 + .3 * eb(q)}) rotate(${(1 - eo(q)) * (i % 2 ? 8 : -8)}deg)`; blur(s, (1 - eo(q)) * 8); });
    const B = seg(t, 17.6, 18.9);
    c2.style.display = t >= 17.6 && t < 22.9 ? "grid" : "none";
    if (c2.style.display !== "none") {
      card3d(c2, B, 0);
      const pp = seg(t, 19.4, 20.6), pk = eio(pp);
      pdf.style.opacity = seg(t, 19.2, 19.7) * (1 - seg(t, 20.3, 20.7));
      pdf.style.transform = `translate(${46 * pk}px,${246 * pk}px) rotate(${-8 + 8 * pk}deg) scale(${1 - .65 * pk})`;
      mail.style.opacity = seg(t, 20.2, 20.5); mail.style.transform = `scale(${eb(seg(t, 20.2, 20.8))})`;
    }
    const C = seg(t, 23.8, 25.0);
    c3.style.display = t >= 23.8 && t < 27.2 ? "grid" : "none";
    if (c3.style.display !== "none") {
      card3d(c3, C, 0);
      const press = seg(t, 25.5, 25.7) * (1 - seg(t, 25.7, 25.95));
      gbtn.style.transform = `scale(${1 - .1 * press})`;
      const ck = seg(t, 25.9, 26.5);
      check.style.opacity = eo(ck); check.style.transform = `scale(${eb(ck)})`;
      const dimP = eo(seg(t, 25.9, 26.4)); [...c3.children].forEach(ch => { if (ch !== check) ch.style.opacity = (ch.style.opacity || 1) * (1 - dimP * .8); });
      mst.textContent = t > 25.9 ? "Підтверджено" : "Заплановано"; mst.className = t > 25.9 ? "pill ok" : "pill v";
    }

    // ---- stripes (BMW-like jumps) ----
    const sw = (a, b, c, d, i) => { const inP = eio(seg(t, a + i * .035, b + i * .035)), outP = eio(seg(t, c + i * .035, d + i * .035)); return [inP, outP]; };
    stripes.forEach((s, i) => {
      let sc = 0, origin = "50% 0";
      const [i1, o1] = sw(0, 0, 0, 0, i);
      const a = (t0, t1, t2, t3) => { const inP = eio(seg(t, t0 + i * .03, t1 + i * .03)), outP = eio(seg(t, t2 + i * .03, t3 + i * .03)); return inP > 0 && outP < 1 ? [inP, outP] : null; };
      const r = a(16.0, 16.6, 16.7, 17.3) || a(22.2, 22.8, 22.9, 23.5);
      if (r) { sc = r[0] * (1 - r[1]) + 0; origin = r[1] > 0 ? "50% 100%" : "50% 0"; sc = r[1] > 0 ? 1 - r[1] : r[0]; }
      s.style.transformOrigin = origin; s.style.transform = `scaleY(${sc})`;
    });

    // ---- white wipe + final ----
    const wp = eio(seg(t, 27.0, 28.3));
    white.style.clipPath = `circle(${(wp * 760).toFixed(1)}px at 50% 50%)`;
    const fP = seg(t, 28.3, 29.1);
    fin.style.opacity = t >= 28.3 ? 1 : 0;
    const fb = fin.querySelector(".fb"); fb.style.opacity = eo(fP); fb.style.transform = `translateY(${(1 - eb(fP)) * 30}px) scale(${.85 + .15 * eb(fP)})`; blur(fb, (1 - eo(fP)) * 12);
    const els = sloganEls(), n = els.length;
    els.forEach((el, i) => { const q = eo(seg(t, 28.9 + i * .035, 30.0 + i * .035)); const d = i - n / 2; el.style.opacity = q; el.style.transform = `translateY(${(1 - q) * (40 + d * d * .6)}px) rotate(${(1 - q) * d * 3.2}deg)`; el.style.filter = q < 1 ? `blur(${(1 - q) * 6}px)` : "none"; });
    sub.style.opacity = eo(seg(t, 30.3, 31.1)); sub.style.transform = `translateY(${(1 - eo(seg(t, 30.3, 31.1))) * 14}px)`;
    // ending fade
    document.body.style.opacity = 1 - seg(t, 31.8, 32);
  }
  function chipHover(t) { if (t < 6.1) return -1; if (t < 6.7) return 4; if (t < 7.3) return 0; if (t < 7.9) return 2; if (t < 8.45) return 3; if (t < 9.0) return 1; return -1; }

  window.renderAt = t => { render(t); };
  window.initPromo = async () => { await document.fonts.ready; measure(); render(0); window.__ready = true; };
  window.initPromo();
  const q = new URLSearchParams(location.search);
  if (q.get("t") !== null) window.renderAt(+q.get("t"));
  else if (!q.get("manual")) { const t0 = performance.now(); const loop = () => { render(((performance.now() - t0) / 1000) % 32.5); requestAnimationFrame(loop); }; loop(); }
})();
