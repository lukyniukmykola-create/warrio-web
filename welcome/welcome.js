(() => {
  "use strict";
  const typed = document.getElementById("typed"), scene = document.getElementById("scene"), dots = document.getElementById("dots"), btn = document.getElementById("replay");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const qr = () => { let s = 7, h = ""; for (let i = 0; i < 81; i++) { s = (s * 9301 + 49297) % 233280; const corner = (i % 9 < 3 && i < 27) || (i % 9 > 5 && i < 27) || (i % 9 < 3 && i > 53); h += `<i class="${corner || s / 233280 > .5 ? "" : "w"}"></i>`; } return `<div class="qr">${h}</div>`; };
  const SCENES = [
    { prompt: "Я хочу прийняти поставку на склад…", html: `<div class="pane"><div class="row"><b>N600-26-00201</b><span class="tag">на складі</span></div><div class="row"><b>N600-26-00202</b><span class="tag">на складі</span></div><div class="row"><b>N1000-26-00088</b><span class="tag">на складі</span></div><div class="cap">Поставка 19.11 · 3 шт.</div></div>` },
    { prompt: "…і щоб дилер зареєстрував продаж", html: `<div class="pane"><div class="row"><span>Дилер</span><b>Клімат Плюс</b></div><div class="row"><span>Модель</span><b>NAVI 600</b></div><div class="row"><span>SN</span><b>N600-26-00201</b></div><div class="row"><span>Статус</span><span class="tag v">Очікує покупця</span></div></div>` },
    { prompt: "Покупець сам активує гарантію", html: `<div class="pane">${qr()}<div class="cap">WRR-2026-004821 · PDF надіслано на email</div></div>` },
    { prompt: "Монтаж №17 — підтверджено", html: `<div class="pane"><div class="check">✓</div><div class="cap">Гарантія активна · журнал оновлено</div></div>` },
    { prompt: "", html: `<div class="pane"><div class="logo-end"><img src="../assets/warrio-mark.svg" alt="" width="46" height="46">Warrio</div><div class="cap">Гарантії, які працюють самі</div></div>` }
  ];
  dots.innerHTML = SCENES.map(() => "<i></i>").join("");
  let idx = 0, timer = 0, typeTimer = 0, paused = false;
  const wait = ms => new Promise(r => { timer = setTimeout(r, ms); });
  function type(text) {
    clearInterval(typeTimer); typed.textContent = "";
    if (reduce || !text) { typed.textContent = text; return Promise.resolve(); }
    return new Promise(done => { let n = 0; typeTimer = setInterval(() => { typed.textContent = text.slice(0, ++n); if (n >= text.length) { clearInterval(typeTimer); done(); } }, 42); });
  }
  async function play() {
    for (;;) {
      if (paused) { await wait(300); continue; }
      const s = SCENES[idx];
      [...dots.children].forEach((d, i) => d.classList.toggle("on", i === idx));
      scene.innerHTML = s.html;
      await Promise.all([type(s.prompt), wait(2600)]);
      await wait(reduce ? 1500 : 900);
      if (paused) continue;
      scene.firstElementChild?.classList.add("out");
      await wait(reduce ? 0 : 450);
      idx = (idx + 1) % SCENES.length;
    }
  }
  btn.addEventListener("click", () => { paused = !paused; btn.textContent = paused ? "▶" : "Ⅱ"; });
  const io = "IntersectionObserver" in window ? new IntersectionObserver(entries => entries.forEach(e => { e.target.dataset.seen = e.isIntersecting ? "1" : ""; }), { threshold: .2 }) : null;
  io?.observe(document.getElementById("stage"));
  play();
})();
