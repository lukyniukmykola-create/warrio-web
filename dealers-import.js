// Bulk import of dealers from pasted text or a CSV file (name; phone; email; code).
(() => {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const context = () => window.WarrioSession?.getContext?.();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const HEADERS = {
    name: /^(name|назва|дилер|компанія|dealer|company)$/i,
    phone: /^(phone|телефон|тел|tel)$/i,
    email: /^(email|e-mail|пошта|електронна пошта)$/i,
    code: /^(code|код)$/i
  };

  function splitLine(line) {
    const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    return line.split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, ""));
  }

  // Returns { rows: [{name, phone, email, code, problem?}] }
  function parse(text) {
    const lines = String(text || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) return [];
    let columns = { name: 0, phone: 1, email: 2, code: 3 };
    const first = splitLine(lines[0]);
    const mapped = {};
    first.forEach((cell, index) => { for (const [key, pattern] of Object.entries(HEADERS)) if (pattern.test(cell)) mapped[key] = index; });
    let body = lines;
    if (mapped.name !== undefined) { columns = mapped; body = lines.slice(1); }
    return body.slice(0, 500).map(line => {
      const cells = splitLine(line);
      const pick = key => (columns[key] !== undefined ? (cells[columns[key]] || "").trim() : "");
      const row = { name: pick("name"), phone: pick("phone"), email: pick("email"), code: pick("code").toUpperCase() };
      if (row.name.length < 2 || row.name.length > 200) row.problem = "назва 2–200 символів";
      else if (row.phone.length > 40) row.problem = "телефон задовгий";
      else if (row.email && (row.email.length > 254 || !emailPattern.test(row.email))) row.problem = "неправильний email";
      else if (row.code && (row.code.length < 2 || row.code.length > 64)) row.problem = "код 2–64 символи";
      return row;
    });
  }

  const reason = error => {
    const text = String(error?.message || "");
    if (/dealer_limit_reached/.test(text)) return "ліміт дилерів";
    if (/duplicate|23505|409/.test(`${text} ${error?.code} ${error?.status}`)) return "уже існує (код)";
    return "помилка збереження";
  };

  function close() { $("#dealers-import")?.remove(); }

  function open() {
    close();
    const overlay = document.createElement("div");
    overlay.id = "dealers-import";
    overlay.setAttribute("role", "dialog");
    overlay.style.cssText = "position:fixed;inset:0;z-index:1000;background:rgba(20,27,47,.55);display:flex;align-items:center;justify-content:center;padding:18px";
    overlay.innerHTML = `<div class="card" style="max-width:620px;width:100%;max-height:88vh;overflow:auto;padding:22px;background:var(--card,#fff)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h3 style="margin:0">Імпорт дилерів</h3><button class="btn small" type="button" id="di-close">Закрити</button></div>
      <p style="color:var(--muted);font-size:13px">Вставте рядки з Excel або завантажте CSV. Колонки: назва, телефон, email, код (телефон, email і код необов'язкові). Перший рядок може бути заголовком. До 500 рядків.</p>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">
        <label class="btn" for="di-file" style="cursor:pointer;margin:0">Вибрати файл</label><span id="di-file-name" style="color:var(--muted);font-size:13px">Файл не вибрано</span>
        <input id="di-file" type="file" accept=".csv,.txt,text/csv,text/plain" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none">
      </div>
      <textarea id="di-text" rows="7" style="width:100%" placeholder="Клімат Плюс;+380501112233;info@klimat.example;KLIMAT"></textarea>
      <div style="margin-top:12px;display:flex;gap:12px;align-items:center"><button class="btn primary" type="button" id="di-run">Імпортувати</button><span id="di-status" role="status" style="font-size:13px;color:var(--muted)"></span></div>
      <ul id="di-result" style="font-size:13px;padding-left:18px"></ul></div>`;
    document.body.appendChild(overlay);
    {
      let down = false;
      const box = overlay.firstElementChild;
      const outside = event => { if (event.target !== overlay) return false; const r = box.getBoundingClientRect(), m = 24; return event.clientX < r.left - m || event.clientX > r.right + m || event.clientY < r.top - m || event.clientY > r.bottom + m; };
      overlay.addEventListener("mousedown", event => { down = outside(event); });
      overlay.addEventListener("click", event => { if (down && outside(event)) close(); down = false; });
    }
    $("#di-close").addEventListener("click", close);
    $("#di-file").addEventListener("change", event => {
      const file = event.target.files?.[0];
      $("#di-file-name").textContent = file ? file.name : "Файл не вибрано";
      if (!file) return;
      if (file.size > 1024 * 1024) { $("#di-status").textContent = "Файл завеликий (максимум 1 МБ)."; return; }
      const reader = new FileReader();
      reader.onload = () => { $("#di-text").value = String(reader.result || ""); };
      reader.readAsText(file);
    });
    $("#di-run").addEventListener("click", run);
  }

  async function run() {
    const ctx = context();
    const orgId = ctx?.organization?.id;
    const status = $("#di-status");
    if (!orgId || !["owner", "admin"].includes(ctx.membership?.role)) { status.textContent = "Імпорт доступний власнику й адміністратору."; return; }
    const rows = parse($("#di-text").value);
    if (!rows.length) { status.textContent = "Немає рядків для імпорту."; return; }
    const button = $("#di-run");
    button.disabled = true;
    const list = $("#di-result");
    list.textContent = "";
    let created = 0;
    const issues = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      status.textContent = `Імпортуємо ${i + 1} з ${rows.length}…`;
      if (row.problem) { issues.push(`${row.name || "(без назви)"} — ${row.problem}`); continue; }
      try {
        await window.WarrioData.createDealer({ organizationId: orgId, name: row.name, phone: row.phone, email: row.email, code: row.code });
        created++;
      } catch (error) {
        const why = reason(error);
        issues.push(`${row.name} — ${why}`);
        if (why === "ліміт дилерів") break;
      }
    }
    status.textContent = `Додано: ${created}. Пропущено: ${issues.length}.`;
    for (const text of issues.slice(0, 50)) { const li = document.createElement("li"); li.textContent = text; list.append(li); }
    button.disabled = false;
    if (created) document.querySelector('[data-action="sync"]')?.click();
  }

  function inject() {
    const actions = $("#page-dealers .actions");
    if (!actions || $("#dealers-import-open")) return;
    const button = document.createElement("button");
    button.id = "dealers-import-open";
    button.type = "button";
    button.className = "btn";
    button.textContent = "⇧ Імпорт з CSV";
    button.hidden = true;
    button.addEventListener("click", open);
    actions.prepend(button);
  }

  function refreshVisibility() {
    const button = $("#dealers-import-open");
    if (button) button.hidden = !["owner", "admin"].includes(context()?.membership?.role);
  }

  inject();
  document.addEventListener("click", event => {
    if (event.target.closest('.nav-btn[data-page="dealers"]')) refreshVisibility();
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
  window.WarrioDealersImport = { parse };
})();
