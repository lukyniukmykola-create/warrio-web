// Warrio service requests (repairs) page + optional service_manager switch.
// Self-contained: degrades gracefully if migrations 012-014 are not applied yet.
(() => {
  "use strict";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const STATUS = {
    new: ["Нове", "amber"],
    in_progress: ["У роботі", "violet"],
    waiting_parts: ["Чекаємо запчастини", "amber"],
    resolved: ["Вирішено", "green"],
    rejected: ["Відхилено", "red"]
  };
  const ERRORS = {
    permission_denied: "У вашої ролі немає доступу до цієї дії.",
    resolution_required: "Для закриття звернення опишіть рішення або причину відмови.",
    invalid_photo_links: "Посилання на фото мають починатися з https:// (максимум 5).",
    warranty_not_found: "Гарантію не знайдено.",
    service_request_not_found: "Звернення не знайдено."
  };
  const context = () => window.WarrioSession?.getContext?.();
  const errorText = error => ERRORS[String(error?.message || "")] || (/PGRST205|42P01|404/.test(`${error?.code} ${error?.status}`)
    ? "Сервісний модуль ще не активовано в базі (потрібні міграції 012–014)."
    : "Не вдалося виконати дію. Спробуйте ще раз.");

  function injectPage() {
    if (document.querySelector("#page-service")) return;
    document.querySelector('.nav-btn[data-page="tasks"]')?.insertAdjacentHTML("afterend",
      '<button class="nav-btn" data-page="service" hidden><span class="ico" data-icon="wrench"></span><span>Сервіс</span></button>');
    document.querySelector("#page-tasks")?.insertAdjacentHTML("afterend", `
      <section class="page" id="page-service">
        <div class="page-head"><div><h1>Сервісні звернення</h1><p>Гарантійні й післягарантійні звернення по проданому обладнанню.</p></div></div>
        <p id="service-msg" role="status" style="color:var(--muted);font-size:13px"></p>
        <div class="card settings-card" id="service-form-card"><h3>Нове звернення</h3>
          <div class="form-grid">
            <div class="form-group full"><label for="service-warranty">Гарантія (серійний номер)</label><select id="service-warranty"></select></div>
            <div class="form-group full"><label for="service-title">Коротко про проблему</label><input id="service-title" maxlength="200"></div>
            <div class="form-group full"><label for="service-description">Опис</label><textarea id="service-description" rows="3" maxlength="4000"></textarea></div>
            <div class="form-group full"><label for="service-photos">Посилання на фото (по одному в рядку, до 5, https://)</label><textarea id="service-photos" rows="2"></textarea></div>
          </div>
          <button class="btn primary" id="service-create" type="button">Створити звернення</button>
        </div>
        <div class="card table-card" style="margin-top:18px"><div class="table-wrap"><table class="table"><thead><tr><th>Звернення</th><th>Гарантія</th><th>Статус</th><th>Рішення</th><th></th></tr></thead><tbody id="service-body"></tbody></table></div></div>
      </section>`);
    document.querySelector("#service-create").addEventListener("click", createRequest);
    document.querySelector("#service-body").addEventListener("click", event => {
      const button = event.target.closest("[data-service-save]");
      if (button) saveRequest(button.dataset.serviceSave);
    });
  }

  function message(text) { const el = document.querySelector("#service-msg"); if (el) el.textContent = text || ""; }

  async function load() {
    const ctx = context();
    const orgId = ctx?.organization?.id;
    if (!orgId) { message("Сервісні звернення доступні після входу в робочий простір."); return; }
    const filter = { organization_id: `eq.${orgId}` };
    try {
      const [requests, warranties, sales, products] = await Promise.all([
        window.WarrioData.queryAll("service_requests", { select: "id,warranty_id,status,title,description,resolution,photo_links,contact_note,source,is_warranty_case,created_at,closed_at", ...filter, order: "created_at.desc" }),
        window.WarrioData.queryAll("warranties", { select: "id,warranty_number,sale_id", ...filter, order: "created_at.desc" }),
        window.WarrioData.queryAll("sales", { select: "id,product_id", ...filter, order: "created_at.desc" }),
        window.WarrioData.queryAll("products", { select: "id,serial_number", ...filter, order: "created_at.desc" })
      ]);
      const productSerial = new Map(products.map(product => [product.id, product.serial_number]));
      const serial = new Map(sales.map(sale => [sale.id, productSerial.get(sale.product_id)]));
      const label = new Map(warranties.map(w => [w.id, `${serial.get(w.sale_id) || "—"} · ${w.warranty_number}`]));
      document.querySelector("#service-warranty").innerHTML = warranties.map(w => `<option value="${esc(w.id)}">${esc(label.get(w.id))}</option>`).join("");
      document.querySelector("#service-form-card").hidden = !["owner", "admin", "dealer", "service_manager"].includes(ctx.membership?.role);
      document.querySelector("#service-body").innerHTML = requests.map(r => {
        const [statusLabel, statusClass] = STATUS[r.status] || [r.status, "violet"];
        const photos = (r.photo_links || []).filter(link => /^https:\/\//.test(link)).map((link, i) => `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">фото ${i + 1}</a>`).join(" · ");
        const options = Object.entries(STATUS).map(([value, [text]]) => `<option value="${value}"${value === r.status ? " selected" : ""}>${esc(text)}</option>`).join("");
        return `<tr><td><b>${esc(r.title)}</b><small style="display:block;color:var(--muted)">${esc(r.description)}</small>${r.source === "buyer" ? `<small style="display:block">Від покупця${r.contact_note ? `: ${esc(r.contact_note)}` : ""}</small>` : ""}${photos ? `<small>${photos}</small>` : ""}</td>
          <td class="mono">${esc(label.get(r.warranty_id) || "—")}<small style="display:block">${r.is_warranty_case ? "Гарантійний випадок" : "Поза гарантією"}</small></td>
          <td><span class="status ${statusClass}">${esc(statusLabel)}</span><select class="select" id="svc-status-${esc(r.id)}">${options}</select></td>
          <td><textarea class="field" id="svc-res-${esc(r.id)}" rows="2" maxlength="4000">${esc(r.resolution)}</textarea></td>
          <td><button class="btn small" type="button" data-service-save="${esc(r.id)}">Зберегти</button></td></tr>`;
      }).join("") || '<tr><td colspan="5" class="empty">Звернень ще немає</td></tr>';
      message("");
    } catch (error) {
      document.querySelector("#service-body").innerHTML = '<tr><td colspan="5" class="empty">—</td></tr>';
      message(errorText(error));
    }
  }

  async function createRequest() {
    const title = document.querySelector("#service-title").value.trim();
    const warrantyId = document.querySelector("#service-warranty").value;
    if (!warrantyId || title.length < 2) { message("Оберіть гарантію та коротко опишіть проблему."); return; }
    const photos = document.querySelector("#service-photos").value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    try {
      await window.WarrioData.rpc("create_warrio_service_request", {
        p_warranty_id: warrantyId, p_title: title,
        p_description: document.querySelector("#service-description").value.trim(), p_photo_links: photos
      });
      ["#service-title", "#service-description", "#service-photos"].forEach(sel => { document.querySelector(sel).value = ""; });
      await load();
      message("Звернення створено.");
    } catch (error) { message(errorText(error)); }
  }

  async function saveRequest(id) {
    try {
      await window.WarrioData.rpc("update_warrio_service_request", {
        p_request_id: id,
        p_status: document.querySelector(`#svc-status-${CSS.escape(id)}`).value,
        p_resolution: document.querySelector(`#svc-res-${CSS.escape(id)}`).value
      });
      await load();
      message("Збережено.");
    } catch (error) { message(errorText(error)); }
  }

  // ---- owner setting: optional service_manager role ----
  async function renderRoleSwitch() {
    const ctx = context();
    const grid = document.querySelector("#page-settings .settings-grid");
    if (!grid || ctx?.membership?.role !== "owner" || !ctx.organization?.id) return;
    let card = document.querySelector("#service-role-card");
    if (!card) {
      grid.insertAdjacentHTML("beforeend", `<div class="card settings-card" id="service-role-card" hidden><h3>Сервісний менеджер</h3>
        <p>Додаткова роль, яка бачить усі сервісні звернення компанії. Дилер завжди бачить звернення по своїх продажах.</p>
        <label class="switch-row"><span><b>Увімкнути роль «Сервісний менеджер»</b><small id="service-role-msg"></small></span><input type="checkbox" id="service-role-toggle"></label></div>`);
      card = document.querySelector("#service-role-card");
      document.querySelector("#service-role-toggle").addEventListener("change", async event => {
        const checkbox = event.target;
        try {
          await window.WarrioData.rpc("set_warrio_service_manager_enabled", { p_organization_id: context().organization.id, p_enabled: checkbox.checked });
          document.querySelector("#service-role-msg").textContent = checkbox.checked ? "Увімкнено." : "Вимкнено.";
        } catch (error) { checkbox.checked = !checkbox.checked; document.querySelector("#service-role-msg").textContent = errorText(error); }
      });
    }
    try {
      const rows = await window.WarrioData.query("organizations", { select: "service_manager_enabled", id: `eq.${ctx.organization.id}`, limit: 1 });
      document.querySelector("#service-role-toggle").checked = Boolean(rows?.[0]?.service_manager_enabled);
      card.hidden = false;
    } catch { card.hidden = true; /* migration 014 not applied yet */ }
  }

  injectPage();
  document.addEventListener("click", event => {
    const nav = event.target.closest(".nav-btn[data-page]");
    if (!nav) return;
    if (nav.dataset.page === "service") load();
    if (nav.dataset.page === "settings") renderRoleSwitch();
  });
})();
