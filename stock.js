// Warrio warehouse: receive goods (one / list / CSV), stock list, serial history.
// Self-contained: degrades gracefully if migration 018 is not applied yet.
(() => {
  "use strict";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const STATUS = {
    in_stock: ["На складі", "green"],
    sold: ["Продано", "violet"],
    in_service: ["У сервісі", "amber"],
    written_off: ["Списано", "red"]
  };
  const EVENTS = {
    received: "Прийнято на склад",
    sold: "Продано",
    warranty_issued: "Видано гарантію",
    service_opened: "Відкрито звернення",
    service_closed: "Звернення закрито",
    written_off: "Списано"
  };
  const OUTCOMES = {
    received: "додано",
    already_exists: "вже є в базі",
    duplicate_in_list: "повтор у списку",
    invalid_format: "неправильний формат"
  };
  const ERRORS = {
    permission_denied: "У вашої ролі немає доступу до складу.",
    model_not_found: "Модель не знайдено або вона вимкнена.",
    invalid_serial_count: "Потрібно від 1 до 500 серійних номерів за раз.",
    reason_required: "Вкажіть причину списання.",
    already_sold: "Проданий виріб списати не можна.",
    already_written_off: "Виріб уже списано.",
    product_not_found: "Виріб не знайдено."
  };
  const context = () => window.WarrioSession?.getContext?.();
  const errorText = error => ERRORS[String(error?.message || "")] || (/PGRST202|PGRST205|42883|404/.test(`${error?.code} ${error?.status}`)
    ? "Склад ще не активовано в базі (потрібна міграція 018)."
    : "Не вдалося виконати дію. Спробуйте ще раз.");
  const dateText = value => value ? new Date(value).toLocaleDateString("uk-UA") : "—";
  const $ = selector => document.querySelector(selector);

  // Serials from a pasted list or a CSV: split on newlines, commas, semicolons, tabs.
  // For CSV with a header the first cell named serial/серійний is used.
  function parseSerials(text) {
    const lines = String(text || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) return [];
    const header = lines[0].toLowerCase().split(/[;,\t]/).map(cell => cell.trim().replace(/^"|"$/g, ""));
    const column = header.findIndex(cell => /^(serial|serial_number|sn|серійний|серійний номер|серійник)/.test(cell));
    const rows = column >= 0 ? lines.slice(1) : lines;
    const split = line => line.split(/[;,\t]/).map(cell => cell.trim().replace(/^"|"$/g, ""));
    const counts = rows.map(line => split(line).length);
    // A table (every row has the same number of cells > 1): take the first column only.
    const isTable = column < 0 && rows.length > 1 && counts[0] > 1 && counts.every(count => count === counts[0]);
    const result = [];
    for (const line of rows) {
      const cells = split(line);
      const picked = column >= 0 ? [cells[column]] : (isTable ? [cells[0]] : cells);
      for (const cell of picked) if (cell) result.push(cell);
    }
    return result;
  }

  let lastRows = [];

  function injectPage() {
    if ($("#page-stock")) return;
    document.querySelector('.nav-btn[data-page="service"]')?.insertAdjacentHTML("afterend",
      '<button class="nav-btn" data-page="stock" hidden><span class="ico" data-icon="box"></span><span>Склад</span></button>');
    $("#page-service")?.insertAdjacentHTML("afterend", `
      <section class="page" id="page-stock">
        <div class="page-head"><div><h1>Склад</h1><p>Прийом товару за серійними номерами, наявність і повна історія кожного виробу.</p></div><div class="actions"><button class="btn" id="stock-labels-open" type="button" title="Наклейки з QR для виробів, що зараз на складі">🏷 Наклейки зі складу (QR)</button></div></div>
        <p id="stock-msg" role="status" style="display:none;margin:12px 0;padding:10px 14px;border-radius:10px;background:#fff4e5;color:#7a4b00;font-size:14px"></p>
        <div class="card settings-card" id="stock-receive-card"><h3>Прийняти товар</h3>
          <div class="form-grid">
            <div class="form-group"><label for="stock-model">Модель</label><select id="stock-model"></select></div>
            <div class="form-group"><label for="stock-note">Примітка (накладна, партія)</label><input id="stock-note" maxlength="300"></div>
            <div class="form-group full"><label for="stock-serials">Серійні номери: по одному в рядку або через кому. Можна вставити з Excel.</label><textarea id="stock-serials" rows="5" placeholder="N600-26-00128&#10;N600-26-00129"></textarea></div>
            <div class="form-group full"><label>Або завантажте CSV / TXT файл</label>
              <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
                <label class="btn" for="stock-file" style="cursor:pointer;margin:0">Вибрати файл</label>
                <span id="stock-file-name" style="color:var(--muted);font-size:13px">Файл не вибрано</span>
                <input id="stock-file" type="file" accept=".csv,.txt,text/csv,text/plain" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none">
              </div></div>
          </div>
          <button class="btn primary" id="stock-receive" type="button">Прийняти на склад</button>
          <div id="stock-result" style="margin-top:12px;font-size:13px"></div>
        </div>
        <div class="card" style="margin-top:18px;padding:14px">
          <div class="form-grid">
            <div class="form-group"><label for="stock-search">Пошук серійного номера</label><input id="stock-search" maxlength="64"></div>
            <div class="form-group"><label for="stock-filter">Статус</label><select id="stock-filter"><option value="">Усі</option><option value="in_stock">На складі</option><option value="sold">Продано</option><option value="in_service">У сервісі</option><option value="written_off">Списано</option></select></div>
          </div>
        </div>
        <div class="card table-card" style="margin-top:18px"><div class="table-wrap"><table class="table"><thead><tr><th>Серійний номер</th><th>Модель</th><th>Прийнято</th><th>Статус</th><th>Дилер / гарантія</th><th></th></tr></thead><tbody id="stock-body"></tbody></table></div></div>
        <div id="stock-history" hidden style="position:fixed;inset:0;z-index:1000;background:rgba(20,27,47,.55);display:none;align-items:center;justify-content:center;padding:18px" role="dialog" aria-modal="true" aria-labelledby="stock-history-title">
          <div class="card" style="max-width:560px;width:100%;max-height:85vh;overflow:auto;padding:22px;background:var(--card,#fff)">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h3 id="stock-history-title" style="margin:0">Історія</h3><button class="btn small" type="button" id="stock-history-close">Закрити</button></div>
            <ol id="stock-history-list" style="padding-left:18px;line-height:1.8;margin-bottom:0"></ol>
          </div>
        </div>
      </section>`);
    $("#stock-receive").addEventListener("click", receive);
    $("#stock-file").addEventListener("change", readFile);
    $("#stock-labels-open").addEventListener("click", openLabels);
    $("#stock-history-close").addEventListener("click", closeHistory);
    bindOutsideClose($("#stock-history"), $("#stock-history > *"), closeHistory);
    document.addEventListener("keydown", event => { if (event.key === "Escape") { closeHistory(); closeLabels(); } });
    $("#stock-filter").addEventListener("change", loadList);
    let timer;
    $("#stock-search").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(loadList, 300); });
    $("#stock-body").addEventListener("click", event => {
      const history = event.target.closest("[data-stock-history]");
      if (history) showHistory(history.dataset.stockHistory, history.dataset.serial);
      const off = event.target.closest("[data-stock-writeoff]");
      if (off) writeOff(off.dataset.stockWriteoff);
    });
  }

  function message(text) { const el = $("#stock-msg"); if (!el) return; el.textContent = text || ""; el.style.display = text ? "block" : "none"; }

  async function loadModels() {
    const orgId = context()?.organization?.id;
    const models = await window.WarrioData.queryAll("product_models", { select: "id,code,name", organization_id: `eq.${orgId}`, is_active: "eq.true", order: "name.asc" });
    $("#stock-model").innerHTML = models.map(model => `<option value="${esc(model.id)}">${esc(model.name)} (${esc(model.code)})</option>`).join("");
  }

  async function loadList() {
    const ctx = context();
    const orgId = ctx?.organization?.id;
    if (!orgId) { message("Склад доступний після входу в робочий простір."); return; }
    try {
      const rows = await window.WarrioData.rpc("get_warrio_stock", {
        p_organization_id: orgId,
        p_search: $("#stock-search").value.trim() || null,
        p_status: $("#stock-filter").value || null,
        p_limit: 200
      });
      lastRows = rows || [];
      const isAdmin = ["owner", "admin"].includes(ctx.membership?.role);
      $("#stock-receive-card").hidden = !isAdmin;
      $("#stock-body").innerHTML = (rows || []).map(row => {
        const [label, css] = STATUS[row.status] || [row.status, "violet"];
        const extra = [row.dealer, row.warranty_number].filter(Boolean).map(esc).join(" · ") || "—";
        const service = row.open_service_requests > 0 ? `<small style="display:block">Відкритих звернень: ${esc(row.open_service_requests)}</small>` : "";
        const repeat = row.total_service_requests >= 2 ? `<small style="display:block;color:#b42318;font-weight:600">Повторні звернення: ${esc(row.total_service_requests)}</small>` : "";
        const off = isAdmin && row.status === "in_stock" ? `<button class="btn small" type="button" data-stock-writeoff="${esc(row.product_id)}">Списати</button> ` : "";
        return `<tr><td class="mono"><b>${esc(row.serial_number)}</b></td><td>${esc(row.model_name)}<small style="display:block;color:var(--muted)">${esc(row.model_code)}</small></td>
          <td>${esc(dateText(row.received_at))}</td><td><span class="status ${css}">${esc(label)}</span>${service}${repeat}</td><td>${extra}</td>
          <td>${off}<button class="btn small" type="button" data-stock-history="${esc(row.product_id)}" data-serial="${esc(row.serial_number)}">Історія</button></td></tr>`;
      }).join("") || '<tr><td colspan="6" class="empty">Нічого не знайдено</td></tr>';
      message("");
    } catch (error) {
      $("#stock-body").innerHTML = '<tr><td colspan="6" class="empty">—</td></tr>';
      message(errorText(error));
    }
  }

  async function load() {
    try { await loadModels(); } catch { /* list below shows the error */ }
    await loadList();
  }

  function readFile(event) {
    const file = event.target.files?.[0];
    $("#stock-file-name").textContent = file ? file.name : "Файл не вибрано";
    if (!file) return;
    if (file.size > 1024 * 1024) { message("Файл завеликий (максимум 1 МБ)."); event.target.value = ""; return; }
    const reader = new FileReader();
    reader.onload = () => {
      const serials = parseSerials(String(reader.result || ""));
      $("#stock-serials").value = serials.join("\n");
      message(`З файлу прочитано серійних номерів: ${serials.length}. Перевірте і натисніть «Прийняти на склад».`);
    };
    reader.readAsText(file);
  }

  async function receive() {
    const ctx = context();
    const serials = parseSerials($("#stock-serials").value);
    const modelId = $("#stock-model").value;
    if (!modelId) { message("Спершу додайте модель у розділі продуктів."); return; }
    if (!serials.length) { message("Додайте хоча б один серійний номер."); return; }
    const button = $("#stock-receive");
    button.disabled = true;
    const summary = { received: 0, already_exists: 0, duplicate_in_list: 0, invalid_format: 0 };
    const problems = [];
    try {
      for (let start = 0; start < serials.length; start += 500) {
        const rows = await window.WarrioData.rpc("receive_warrio_stock", {
          p_organization_id: ctx.organization.id, p_model_id: modelId,
          p_serials: serials.slice(start, start + 500), p_note: $("#stock-note").value.trim() || null
        });
        for (const row of rows || []) {
          summary[row.outcome] = (summary[row.outcome] || 0) + 1;
          if (row.outcome !== "received") problems.push(`${row.serial} — ${OUTCOMES[row.outcome] || row.outcome}`);
        }
      }
      $("#stock-result").innerHTML = `<b>Додано: ${summary.received}</b>` + (problems.length
        ? `<br>Пропущено: ${problems.length}<ul>${problems.slice(0, 50).map(text => `<li>${esc(text)}</li>`).join("")}</ul>` : "");
      if (!problems.length) { $("#stock-serials").value = ""; $("#stock-file").value = ""; $("#stock-file-name").textContent = "Файл не вибрано"; }
      message("");
      await loadList();
    } catch (error) { message(errorText(error)); }
    finally { button.disabled = false; }
  }


  // Printable QR labels for items currently shown with status "in stock".
  // The QR carries only the serial number (usable with any scanner and the search box).
  function openLabels() {
    const items = lastRows.filter(row => row.status === "in_stock");
    if (!items.length) { message("Немає що друкувати: у списку нема виробів зі статусом «На складі». Спершу прийміть товар (форма «Прийняти товар» вище), потім натисніть кнопку знову."); return; }
    if (!window.WarrioQR) { message("Модуль QR не завантажено."); return; }
    closeLabels();
    const overlay = document.createElement("div");
    overlay.id = "stock-labels";
    overlay.style.cssText = "position:fixed;inset:0;z-index:1100;background:#fff;overflow:auto;color:#000";
    const bar = document.createElement("div");
    bar.className = "no-print";
    bar.style.cssText = "position:sticky;top:0;background:#f4f6fb;border-bottom:1px solid #e4e7f0;padding:12px 18px;display:flex;gap:12px;align-items:center";
    bar.innerHTML = `<b>Наклейки: ${items.length} шт.</b><span style="color:#68738c;font-size:13px">Наклейки потрібні для складу: наклейте на коробку чи виріб, і серійник можна сканувати замість набору вручну. Для продажу вони не обов'язкові. Друк: A4, без полів.</span>`;
    const print = document.createElement("button");
    print.className = "btn primary";
    print.type = "button";
    print.textContent = "Друк";
    print.style.marginLeft = "auto";
        const close = document.createElement("button");
    close.className = "btn";
    close.type = "button";
    close.textContent = "Закрити";
    close.addEventListener("click", closeLabels);
    bar.append(print, close);
    const esc = value => String(value ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
    const cells = items.map(row => `<div class="c"><div class="q">${window.WarrioQR.svg(row.serial_number, 4, 1).replace(/width="\d+" height="\d+"/, 'width="100%" height="100%"')}</div><div class="t"><b>${esc(row.serial_number)}</b><span>${esc(row.model_name)}</span></div></div>`).join("");
    const doc = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:8mm}body{margin:0;padding:12px;background:#fff;color:#000;font-family:Arial,sans-serif}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(52mm,1fr));gap:3mm}.c{border:1px dashed #999;padding:2mm;display:flex;gap:2mm;align-items:center;break-inside:avoid;min-height:26mm}.q{width:22mm;height:22mm;flex:none}.t{font:600 11px/1.3 Consolas,monospace;word-break:break-all}.t span{display:block;font:400 10px/1.3 Arial,sans-serif;color:#333;margin-top:1mm}</style></head><body><div class="g">${cells}</div></body></html>`;
    const frame = document.createElement("iframe");
    frame.title = "Наклейки";
    frame.style.cssText = "display:block;width:100%;height:calc(100vh - 60px);border:0;background:#fff";
    frame.srcdoc = doc;
    print.onclick = () => { frame.contentWindow.focus(); frame.contentWindow.print(); };
    const grid = frame;
    overlay.append(bar, grid);
    document.body.appendChild(overlay);
  }

  function bindOutsideClose(overlay, dialog, close) {
    let downOutside = false;
    const outside = event => {
      if (event.target !== overlay || !dialog) return false;
      const r = dialog.getBoundingClientRect(), m = 24;
      return event.clientX < r.left - m || event.clientX > r.right + m || event.clientY < r.top - m || event.clientY > r.bottom + m;
    };
    overlay.addEventListener("mousedown", event => { downOutside = outside(event); });
    overlay.addEventListener("click", event => { if (downOutside && outside(event)) close(); downOutside = false; });
  }

  function closeLabels() { $("#stock-labels")?.remove(); }

  function closeHistory() {
    const modal = $("#stock-history");
    if (!modal) return;
    modal.hidden = true;
    modal.style.display = "none";
  }

  async function showHistory(productId, serial) {
    try {
      const rows = await window.WarrioData.rpc("get_warrio_product_history", { p_product_id: productId });
      $("#stock-history-title").textContent = `Історія ${serial}`;
      $("#stock-history-list").innerHTML = (rows || []).map(row => {
        const meta = row.metadata || {};
        const detail = [row.note, meta.dealer, meta.warranty_number].filter(Boolean).map(esc).join(" · ");
        return `<li><b>${esc(EVENTS[row.event_type] || row.event_type)}</b> · ${esc(dateText(row.created_at))}${detail ? ` · ${detail}` : ""}</li>`;
      }).join("") || "<li>Подій ще немає.</li>";
      const modal = $("#stock-history");
      modal.hidden = false;
      modal.style.display = "flex";
      $("#stock-history-close").focus();
    } catch (error) { message(errorText(error)); }
  }

  async function writeOff(productId) {
    const reason = window.prompt("Причина списання (наприклад, пошкоджено при транспортуванні):");
    if (!reason || !reason.trim()) return;
    try {
      await window.WarrioData.rpc("write_off_warrio_stock_item", { p_product_id: productId, p_reason: reason.trim() });
      await loadList();
      message("Виріб списано.");
    } catch (error) { message(errorText(error)); }
  }

  // ---- owner setting: who manages stock / who sees service requests ----
  async function renderAccessCard() {
    const ctx = context();
    const grid = document.querySelector("#page-settings .settings-grid");
    if (!grid || ctx?.membership?.role !== "owner" || !ctx.organization?.id) return;
    let card = $("#access-card");
    if (!card) {
      grid.insertAdjacentHTML("beforeend", `<div class="card settings-card" id="access-card" hidden><h3>Доступ до складу й сервісу</h3>
        <p>Власник завжди має повний доступ. Тут можна обмежити решту ролей.</p>
        <label class="switch-row"><span><b>Адміністратори керують складом</b><small>Якщо вимкнути, склад бачить і змінює лише власник.</small></span><input type="checkbox" id="access-admins"></label>
        <label class="switch-row"><span><b>Дилери бачать звернення по своїх продажах</b><small id="access-msg"></small></span><input type="checkbox" id="access-dealers"></label></div>`);
      card = $("#access-card");
      const save = async event => {
        const box = event.target;
        try {
          await window.WarrioData.rpc("set_warrio_access_settings", {
            p_organization_id: context().organization.id,
            p_admins_manage_stock: $("#access-admins").checked,
            p_dealers_see_service: $("#access-dealers").checked
          });
          $("#access-msg").textContent = "Збережено.";
        } catch (error) { box.checked = !box.checked; $("#access-msg").textContent = errorText(error); }
      };
      $("#access-admins").addEventListener("change", save);
      $("#access-dealers").addEventListener("change", save);
    }
    try {
      const rows = await window.WarrioData.query("organizations", { select: "admins_manage_stock,dealers_see_service", id: `eq.${ctx.organization.id}`, limit: 1 });
      $("#access-admins").checked = rows?.[0]?.admins_manage_stock !== false;
      $("#access-dealers").checked = rows?.[0]?.dealers_see_service !== false;
      card.hidden = false;
    } catch { card.hidden = true; /* migration 021 not applied yet */ }
  }

  // Sale form helper (owner/admin): suggest serials that are in stock and pick the model automatically.
  async function attachSaleHelper(input) {
    const ctx = context();
    if (input.dataset.stockHelper || !["owner", "admin"].includes(ctx?.membership?.role) || !ctx.organization?.id) return;
    input.dataset.stockHelper = "1";
    try {
      const rows = await window.WarrioData.rpc("get_warrio_stock", { p_organization_id: ctx.organization.id, p_search: null, p_status: "in_stock", p_limit: 500 });
      if (!rows?.length || !input.isConnected) return;
      const modelSelect = document.querySelector("#m-model");
      const pickSelect = document.createElement("select");
      pickSelect.id = "m-sn-pick";
      pickSelect.style.cssText = "width:100%;margin-bottom:6px";
      const hint = document.createElement("small");
      hint.style.cssText = "display:block;color:var(--muted);margin-top:4px";
      const fill = () => {
        const code = modelSelect?.value;
        const subset = rows.filter(row => !code || row.model_code === code);
        pickSelect.textContent = "";
        const first = document.createElement("option");
        first.value = "";
        first.textContent = subset.length ? `Вибрати зі складу (${subset.length})` : "Для цієї моделі на складі нічого немає";
        pickSelect.append(first);
        for (const row of subset) { const option = document.createElement("option"); option.value = row.serial_number; option.textContent = `${row.serial_number} · ${row.model_name}`; pickSelect.append(option); }
        hint.textContent = `Усього на складі: ${rows.length}. Оберіть серійний номер зі списку або введіть вручну.`;
      };
      input.before(pickSelect);
      input.after(hint);
      fill();
      modelSelect?.addEventListener("change", fill);
      pickSelect.addEventListener("change", () => {
        if (!pickSelect.value) return;
        input.value = pickSelect.value;
        const match = rows.find(row => row.serial_number === pickSelect.value);
        if (match && modelSelect && [...modelSelect.options].some(option => option.value === match.model_code)) modelSelect.value = match.model_code;
      });
      input.addEventListener("input", () => {
        const match = rows.find(row => row.serial_number === input.value.trim().toUpperCase());
        if (match && modelSelect && [...modelSelect.options].some(option => option.value === match.model_code)) { modelSelect.value = match.model_code; fill(); pickSelect.value = match.serial_number; }
      });
    } catch { /* no access or migration 018 missing: plain input stays */ }
  }
  new MutationObserver(() => { const input = document.querySelector("#m-sn"); if (input) attachSaleHelper(input); })
    .observe(document.body, { childList: true, subtree: true });

  injectPage();
  document.addEventListener("click", event => {
    const nav = event.target.closest(".nav-btn[data-page]");
    if (nav?.dataset.page === "stock") load();
    if (nav?.dataset.page === "settings") renderAccessCard();
  });
  window.WarrioStock = { parseSerials };
})();
