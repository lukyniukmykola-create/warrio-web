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

  function injectPage() {
    if ($("#page-stock")) return;
    document.querySelector('.nav-btn[data-page="service"]')?.insertAdjacentHTML("afterend",
      '<button class="nav-btn" data-page="stock" hidden><span class="ico" data-icon="box"></span><span>Склад</span></button>');
    $("#page-service")?.insertAdjacentHTML("afterend", `
      <section class="page" id="page-stock">
        <div class="page-head"><div><h1>Склад</h1><p>Прийом товару за серійними номерами, наявність і повна історія кожного виробу.</p></div></div>
        <p id="stock-msg" role="status" style="color:var(--muted);font-size:13px"></p>
        <div class="card settings-card" id="stock-receive-card"><h3>Прийняти товар</h3>
          <div class="form-grid">
            <div class="form-group"><label for="stock-model">Модель</label><select id="stock-model"></select></div>
            <div class="form-group"><label for="stock-note">Примітка (накладна, партія)</label><input id="stock-note" maxlength="300"></div>
            <div class="form-group full"><label for="stock-serials">Серійні номери: по одному в рядку або через кому. Можна вставити з Excel.</label><textarea id="stock-serials" rows="5" placeholder="N600-26-00128&#10;N600-26-00129"></textarea></div>
            <div class="form-group full"><label for="stock-file">Або завантажте CSV / TXT файл</label><input id="stock-file" type="file" accept=".csv,.txt,text/csv,text/plain"></div>
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
        <div class="card settings-card" id="stock-history" style="margin-top:18px" hidden><h3 id="stock-history-title">Історія</h3><ol id="stock-history-list" style="padding-left:18px;line-height:1.7"></ol></div>
      </section>`);
    $("#stock-receive").addEventListener("click", receive);
    $("#stock-file").addEventListener("change", readFile);
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

  function message(text) { const el = $("#stock-msg"); if (el) el.textContent = text || ""; }

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
      const isAdmin = ["owner", "admin"].includes(ctx.membership?.role);
      $("#stock-receive-card").hidden = !isAdmin;
      $("#stock-body").innerHTML = (rows || []).map(row => {
        const [label, css] = STATUS[row.status] || [row.status, "violet"];
        const extra = [row.dealer, row.warranty_number].filter(Boolean).map(esc).join(" · ") || "—";
        const service = row.open_service_requests > 0 ? `<small style="display:block">Відкритих звернень: ${esc(row.open_service_requests)}</small>` : "";
        const off = isAdmin && row.status === "in_stock" ? `<button class="btn small" type="button" data-stock-writeoff="${esc(row.product_id)}">Списати</button> ` : "";
        return `<tr><td class="mono"><b>${esc(row.serial_number)}</b></td><td>${esc(row.model_name)}<small style="display:block;color:var(--muted)">${esc(row.model_code)}</small></td>
          <td>${esc(dateText(row.received_at))}</td><td><span class="status ${css}">${esc(label)}</span>${service}</td><td>${extra}</td>
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
      if (!problems.length) { $("#stock-serials").value = ""; $("#stock-file").value = ""; }
      message("");
      await loadList();
    } catch (error) { message(errorText(error)); }
    finally { button.disabled = false; }
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
      $("#stock-history").hidden = false;
      $("#stock-history").scrollIntoView({ behavior: "smooth", block: "nearest" });
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

  injectPage();
  document.addEventListener("click", event => {
    const nav = event.target.closest(".nav-btn[data-page]");
    if (nav?.dataset.page === "stock") load();
  });
  window.WarrioStock = { parseSerials };
})();
