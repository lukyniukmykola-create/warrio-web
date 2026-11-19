(() => {
  "use strict";
  const $ = s => document.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;
  const eo = p => 1 - Math.pow(1 - p, 4);
  const eio = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const eb = p => { const c = 1.6; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
  const D = 14.5;
  const ICON = { box: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8", cart: "M3 4h2l2.5 10h10.5l2-7H6.5M9 19.5h.01M17 19.5h.01", shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z", wrench: "M14.7 6.3a4 4 0 005 5L21 13l-8 8-4-4 8-8M9 17l-3 3", bolt: "M13 2L4 14h7l-1 8 9-12h-7l1-8z" };
  const CHIPS = [["box", "Stock"], ["cart", "Sales"], ["shield", "Warranty"], ["wrench", "Install"], ["bolt", "Automation"]];
  $("#chips").innerHTML = CHIPS.map(([i, n]) => `<div class="chip"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e6deff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ICON[i]}"/></svg>${n}</div>`).join("");
  const word = $("#word"); word.innerHTML = [..."Warrio"].map(c => `<i>${c}</i>`).join("");
  let seed = 11; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  $("#qr").innerHTML = Array.from({ length: 121 }, (_, i) => { const x = i % 11, y = Math.floor(i / 11); const f = (x < 3 && y < 3) || (x > 7 && y < 3) || (x < 3 && y > 7); return `<i class="${f || rnd() > .5 ? "" : "w"}"></i>`; }).join("");
  const chipEls = [...$("#chips").children]; let chipC = [];
  const dust = $("#dust"), dctx = dust.getContext("2d");
  const parts = Array.from({ length: 80 }, () => ({ x: rnd() * 960, y: rnd() * 540, r: .7 + rnd() * 2, s: .2 + rnd() * .7, ph: rnd() * 6.28 }));
  const SLOGAN = "Warranties, made simple.", NAME = "WARRIO";
  const slogan = $("#slogan"), ename = $("#ename");
  function layout(el, text, width) {
    el.innerHTML = ""; const probe = document.createElement("span"); probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font:inherit;letter-spacing:inherit"; el.appendChild(probe);
    const pos = []; for (let i = 0; i <= text.length; i++) { probe.textContent = text.slice(0, i); pos.push(probe.getBoundingClientRect().width); }
    const off = (width - pos[text.length]) / 2;
    el.innerHTML = [...text].map((c, i) => `<i style="left:${(off + pos[i]).toFixed(1)}px">${c}</i>`).join("");
  }
  function measure() { chipC = chipEls.map(el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; }); layout(slogan, SLOGAN, 820); layout(ename, NAME, 300); }
  const stage = $("#stage"), s1 = $(".s1"), s2 = $(".s2"), bg = $("#bg"), brand = $("#brand"), mark = $("#mark"), chipsBox = $("#chips"), cursor = $("#cursor"), prompt = $("#prompt"), ptext = $("#ptext"), pcaret = $("#pcaret");
  const code = $("#code"), hero = $("#hero"), card = $("#card"), glow = $("#glow"), ph1 = $("#ph1"), ph2 = $("#ph2"), pdf = $("#pdf"), mail = $("#mail"), okp = $("#okp"), end = $("#end"), emark = $("#emark");
  const mbA = $("#mbAg"), mbB = $("#mbBg");
  const T1 = "Register a NAVI 600 sale for Klimat Plus", T2 = "Add a 3-year warranty and send the PDF";
  const typeInto = (text, start, dur, t) => text.slice(0, Math.floor(clamp((t - start) / dur) * text.length));

  function render(t) {
    // ----- colour arc: warm -> violet -> cool blue -----
    const H = t < 7.4 ? lerp(292, 217, eio(seg(t, 0.5, 5.4))) : lerp(217, 182, eio(seg(t, 7.4, 8.8)));
    const accR = t < 7.4 ? lerp(255, 170, eio(seg(t, 0.5, 5.4))) : lerp(170, 90, eio(seg(t, 7.4, 8.8)));
    const accG = t < 7.4 ? lerp(120, 120, 0) : lerp(120, 170, eio(seg(t, 7.4, 8.8)));
    const accB = t < 7.4 ? lerp(210, 255, eio(seg(t, 0.5, 5.4))) : 255;
    stage.style.setProperty("--acc", `${accR | 0},${accG | 0},${accB | 0}`);
    const intro = eo(seg(t, 0, .9)), fadeEnd = 1 - eio(seg(t, 11.0, 11.7));
    const dim = lerp(1, .6, seg(t, 2.8, 4.0));
    bg.style.opacity = intro * fadeEnd;
    const flt = `hue-rotate(${H}deg) saturate(1.4) brightness(${(0.8 * dim).toFixed(3)}) contrast(1.25)`;
    s1.style.filter = flt; s2.style.filter = flt; s2.style.opacity = .42;
    s1.style.transform = `rotate(${t * 3.2 - 6}deg) scale(${1.05 + Math.sin(t * .6) * .07}) translate(${Math.sin(t * .45) * 40}px,${Math.cos(t * .35) * 24}px)`;
    s2.style.transform = `scaleX(-1) rotate(${-t * 2.4 + 18}deg) scale(${1.2 + Math.cos(t * .5) * .08}) translate(${Math.cos(t * .35) * 50}px,${Math.sin(t * .45) * 30}px)`;
    dctx.clearRect(0, 0, 960, 540);
    for (const p of parts) { const x = (p.x + t * 14 * p.s) % 960, y = (p.y - t * 10 * p.s + 2160) % 540, a = (.25 + .35 * Math.sin(t * 1.6 + p.ph)) * intro; dctx.fillStyle = `rgba(230,215,255,${Math.max(0, a)})`; dctx.beginPath(); dctx.arc(x, y, p.r, 0, 6.283); dctx.fill(); }

    // ----- brand intro (0.25-2.3) -----
    const logoP = seg(t, .25, 1.0), wordP = seg(t, .85, 1.7), bOut = eio(seg(t, 1.9, 2.4));
    brand.style.opacity = eo(logoP) * (1 - bOut);
    mark.style.transform = `scale(${lerp(.4, 1, eb(logoP))}) rotate(${(1 - eo(logoP)) * -50}deg)`;
    mark.style.filter = `drop-shadow(0 0 26px rgba(190,160,255,1)) blur(${(1 - eo(logoP)) * 14}px)`;
    [...word.children].forEach((c, i) => { const q = eo(seg(wordP, i * .1, .55 + i * .1)); c.style.opacity = q; c.style.transform = `translateY(${(1 - q) * 26}px)`; c.style.filter = q < 1 ? `blur(${(1 - q) * 10}px)` : "none"; });
    word.style.letterSpacing = `${lerp(12, -1.8, eo(wordP))}px`; word.style.maxWidth = `${lerp(0, 380, eo(wordP))}px`;
    brand.style.transform = `translateY(${-bOut * 80}px) scale(${1 - bOut * .12})`; brand.style.filter = bOut ? `blur(${bOut * 14}px)` : "none";

    // ----- chips + cursor (1.9-3.8) -----
    const cIn = seg(t, 1.9, 2.7), cOut = eio(seg(t, 3.3, 3.8));
    chipsBox.style.opacity = t >= 1.9 && t < 3.9 ? 1 : 0;
    const hov = t < 2.6 ? -1 : t < 3.0 ? 0 : t < 3.4 ? 1 : -1;
    chipEls.forEach((c, i) => {
      const q = eo(seg(cIn, i * .1, .5 + i * .1));
      let o = q, tr = `translateY(${(1 - q) * 30}px) scale(${.9 + .1 * q})`, f = (1 - q) * 10;
      if (hov === i) { tr += " scale(1.08)"; c.style.borderColor = "rgba(240,230,255,1)"; c.style.boxShadow = "0 0 46px rgba(180,150,255,.95),inset 0 1px 0 rgba(255,255,255,.5)"; c.style.background = "rgba(70,40,160,.7)"; }
      else { c.style.borderColor = "rgba(190,170,255,.6)"; c.style.boxShadow = "0 0 30px rgba(130,100,255,.4),inset 0 1px 0 rgba(255,255,255,.35)"; c.style.background = "rgba(14,8,40,.6)"; }
      if (i === 1) { const pr = seg(t, 3.15, 3.3) * (1 - seg(t, 3.3, 3.45)); tr += ` scale(${1 - .1 * pr})`; o *= 1 - seg(t, 3.4, 3.55); }
      else { o *= 1 - cOut; f += cOut * 12; }
      c.style.opacity = o; c.style.transform = tr; c.style.filter = f > .05 ? `blur(${f}px)` : "none";
    });
    if (chipC.length) {
      const path = [[2.05, 1010, 330], [2.6, chipC[0].x, chipC[0].y + 3], [3.0, chipC[1].x, chipC[1].y + 4]];
      let cx = path[0][1], cy = path[0][2];
      for (let i = 0; i < path.length - 1; i++) if (t >= path[i][0]) { const k = eio(seg(t, path[i][0], path[i + 1][0])); cx = lerp(path[i][1], path[i + 1][1], k); cy = lerp(path[i][2], path[i + 1][2], k); }
      if (t >= 3.0) { cx = path[2][1]; cy = path[2][2]; }
      const press = seg(t, 3.15, 3.3) * (1 - seg(t, 3.3, 3.45));
      cursor.style.opacity = t > 2.05 && t < 3.6 ? Math.min(1, seg(t, 2.05, 2.35)) * (1 - seg(t, 3.4, 3.6)) : 0;
      cursor.style.transform = `translate(${cx - 6}px,${cy - 4}px) scale(${1 - .16 * press})`;
    }

    // ----- prompt bar -----
    const morph = eo(seg(t, 3.35, 3.85)), toBottom = eio(seg(t, 4.15, 4.85));
    let w = lerp(chipC[1]?.w || 140, 700, morph), h = lerp(60, 72, morph), yc = lerp(270, 478, toBottom);
    const pEnd = eio(seg(t, 10.9, 11.3));
    prompt.style.opacity = t >= 3.35 ? Math.min(1, seg(t, 3.35, 3.6)) * (1 - pEnd) : 0;
    prompt.style.width = `${w}px`; prompt.style.height = `${h}px`; prompt.style.marginLeft = `${-w / 2}px`; prompt.style.top = `${yc - h / 2}px`; prompt.style.borderRadius = `${lerp(30, 28, morph)}px`;
    const ta = seg(t, 3.7, 4.0); ptext.style.opacity = ta; $(".plus").style.opacity = ta * .85; $(".send").style.opacity = ta;
    let txt = t < 6.9 ? typeInto(T1, 3.95, 1.2, t) : typeInto(T2, 7.0, 1.2, t);
    ptext.textContent = txt; pcaret.style.opacity = Math.floor(t * 2.6) % 2 ? .15 : 1;

    // ----- readable code, then camera rush (4.4-5.7) -----
    const cin = seg(t, 4.4, 4.8), crush = eio(seg(t, 5.1, 5.7));
    code.style.opacity = t >= 4.4 && t < 5.75 ? eo(cin) * (1 - seg(t, 5.45, 5.75)) : 0;
    const cScale = t < 5.1 ? lerp(.9, 1, eo(cin)) : lerp(1, 5.5, crush);
    code.style.transform = `translateY(-34px) scale(${cScale})`;
    const cBlurX = t < 4.8 ? (1 - eo(cin)) * 14 : t < 5.1 ? 0 : crush * 34;
    mbA.setAttribute("stdDeviation", `${cBlurX.toFixed(2)} ${(cBlurX * .15).toFixed(2)}`);
    code.style.filter = cBlurX > .05 ? "url(#mbA)" : "none";

    // ----- hero card (5.3-10.9) -----
    const hin = seg(t, 5.25, 6.2), hOut = eio(seg(t, 10.6, 11.2));
    const drift = Math.sin(t * .9) , floatY = Math.sin(t * 1.3) * 5;
    hero.style.opacity = t >= 5.25 ? eo(seg(t, 5.25, 5.6)) * (1 - seg(t, 10.9, 11.2)) : 0;
    const hs = t < 6.2 ? lerp(.55, 1, eb(hin)) : 1;
    const outS = 1 + hOut * 3.2;
    hero.style.transform = `translateY(${floatY + (1 - eo(hin)) * 30}px) rotateY(${-10 + drift * 2.2 + (1 - eo(hin)) * 40}deg) rotateX(${7 - drift * 1.2}deg) scale(${hs * outS})`;
    const hb = t < 6.2 ? (1 - eo(hin)) * 40 : hOut * 36;
    mbB.setAttribute("stdDeviation", `${hb.toFixed(2)} ${(hb * .12).toFixed(2)}`);
    hero.style.filter = hb > .05 ? "url(#mbB)" : "none";
    glow.style.opacity = t >= 5.4 ? eo(seg(t, 5.4, 6.4)) * (.85 + .15 * Math.sin(t * 2)) * (1 - seg(t, 10.8, 11.2)) : 0;
    glow.style.transform = `scale(${1 + Math.sin(t * 1.3) * .05})`;
    // phase 1 rows
    const m = eio(seg(t, 7.55, 8.35));
    ph1.style.opacity = (1 - m); ph1.style.transform = `translateX(${-m * 60}px) scale(${1 - m * .06})`; ph1.style.filter = m > 0 ? `blur(${m * 10}px)` : "none";
    [...ph1.children].forEach((ch, i) => { const q = eo(seg(t, 5.7 + i * .1, 6.3 + i * .1)); ch.style.opacity = q; ch.style.transform = `translateY(${(1 - q) * 18}px)`; });
    // phase 2
    ph2.style.opacity = m; ph2.style.transform = `translateX(${(1 - m) * 60}px) scale(${.94 + .06 * m})`; ph2.style.filter = m < 1 ? `blur(${(1 - m) * 10}px)` : "none";
    const pdfP = eio(seg(t, 8.7, 9.6));
    pdf.style.opacity = seg(t, 8.6, 8.9) * (1 - seg(t, 9.4, 9.7));
    pdf.style.transform = `translate(${60 * pdfP}px,${250 * pdfP}px) rotate(${-10 + 10 * pdfP}deg) scale(${1 - .6 * pdfP})`;
    mail.style.opacity = seg(t, 9.3, 9.55); mail.style.transform = `scale(${eb(seg(t, 9.3, 9.9))})`;
    okp.style.opacity = eo(seg(t, 9.5, 9.9)); okp.style.transform = `translateY(${(1 - eb(seg(t, 9.5, 10.1))) * 20}px)`;

    // ----- end card (11.3-14.5) -----
    end.style.opacity = t >= 11.3 ? 1 : 0;
    const eP = seg(t, 11.3, 12.1);
    emark.style.opacity = eo(eP); emark.style.transform = `scale(${lerp(.5, 1, eb(eP))}) rotate(${(1 - eo(eP)) * -30}deg)`; emark.style.filter = `drop-shadow(0 0 40px rgba(170,140,255,.95)) blur(${(1 - eo(eP)) * 14}px)`;
    const sl = [...slogan.children], n = sl.length;
    sl.forEach((el, i) => { const q = eo(seg(t, 11.9 + i * .04, 13.0 + i * .04)); const d = i - n / 2; el.style.opacity = q; el.style.transform = `translateY(${(1 - q) * (50 + d * d * .7)}px) rotate(${(1 - q) * d * 3.4}deg)`; el.style.filter = q < 1 ? `blur(${(1 - q) * 7}px)` : "none"; });
    const nm = [...ename.children]; nm.forEach((el, i) => { const q = eo(seg(t, 13.0 + i * .05, 13.7 + i * .05)); el.style.opacity = q; el.style.transform = `translateY(${(1 - q) * 14}px)`; el.style.filter = q < 1 ? `blur(${(1 - q) * 6}px)` : "none"; });
    document.body.style.opacity = 1 - seg(t, 14.2, 14.5);
  }
  window.renderAt = render;
  (async () => { await document.fonts.ready; measure(); render(0); window.__ready = true; })();
  const q = new URLSearchParams(location.search);
  if (!q.get("manual")) { const t0 = performance.now(); const loop = () => { render(((performance.now() - t0) / 1000) % D); requestAnimationFrame(loop); }; document.fonts.ready.then(() => { measure(); loop(); }); }
})();
