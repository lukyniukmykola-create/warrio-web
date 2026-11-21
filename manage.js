// Warrio: fix mistakes (edit / delete with confirmation), plan installations, find warranties,
// and human-readable event names. Works on top of app.js through window.WarrioApp.
(() => {
  "use strict";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const app = () => window.WarrioApp || {};
  const live = () => window.__warrioLiveData || {};
  const ctx = () => app().context?.() || window.WarrioSession?.getContext?.();
  const orgId = () => ctx()?.organization?.id;
  const isAdmin = () => ["owner", "admin"].includes(ctx()?.membership?.role);
  const dateUa = value => value ? new Date(String(value).length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("uk-UA") : "—";
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  // ---------- human-readable journal ----------
  const EVENTS = {
    "member.created": "Додано користувача", "member.invited": "Запрошено користувача",
    "organization.created": "Створено компанію", "organization.settings_updated": "Змінено налаштування компанії",
    "organization.warranty_policy_updated": "Змінено правила гарантії", "organization.access_settings_changed": "Змінено доступи",
    "organization.service_manager_toggled": "Змінено роль сервісного менеджера",
    "product_model.created": "Додано модель", "product_model.updated": "Змінено модель", "product_model.warranty_updated": "Змінено гарантію моделі",
    "sale.registered": "Зареєстровано продаж", "sale.activation_code_issued": "Створено посилання активації",
    "sale.archived": "Видалено продаж",
    "warranty.activated": "Гарантію активовано", "warranty.activated_by_buyer": "Покупець активував гарантію",
    "warranty.email_sent": "Гарантію надіслано клієнту на email", "warranty.archived": "Видалено гарантію",
    "service_request.created": "Створено сервісне звернення", "service_request.created_by_buyer": "Покупець створив звернення",
    "service_request.status_changed": "Змінено статус звернення",
    "stock.received": "Товар прийнято на склад", "stock.deleted": "Товар видалено зі складу", "stock.written_off": "Товар списано",
    "work_item.created": "Створено завдання", "work_item.status_changed": "Змінено статус завдання",
    "installation.planned": "Заплановано монтаж", "installation.confirmed": "Монтаж підтверджено",
    "dealer.created": "Додано дилера", "dealer.updated": "Змінено дилера", "dealer.deleted": "Видалено дилера", "dealer.deactivated": "Дилера вимкнено",
    "customer.updated": "Змінено дані клієнта", "customer.deleted": "Видалено клієнта"
  };
  const ENTITIES = {
    organization_member: "Користувач", organization: "Компанія", product_model: "Модель", sale: "Продаж", warranty: "Гарантія",
    service_request: "Звернення", product: "Товар", work_item: "Завдання", dealer: "Дилер", customer: "Клієнт", installation: "Монтаж"
  };
  const STATUSES = {
    open: "відкрите", in_progress: "у роботі", done: "виконано", cancelled: "скасовано",
    new: "нове", waiting_parts: "очікує запчастини", resolved: "вирішено", rejected: "відхилено"
  };
  const eventLabel = type => EVENTS[type] || String(type || "").replace(/[._]/g, " ");
  const entityLabel = type => ENTITIES[type] || String(type || "—");
  const eventDetail = (type, meta = {}) => {
    const parts = [];
    if (meta.serial_number) parts.push(`SN ${meta.serial_number}`);
    if (meta.warranty_number) parts.push(`гарантія ${meta.warranty_number}`);
    if (meta.number) parts.push(`№${meta.number}`);
    if (meta.status) parts.push(STATUSES[meta.status] || meta.status);
    return parts.join(" · ") || "—";
  };

  // ---------- dialogs ----------
  function mount(html) {
    document.querySelector("#wm-overlay")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "wm-overlay";
    overlay.className = "wm-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML = `<div class="card wm-card">${html}</div>`;
    document.body.appendChild(overlay);
    return overlay;
  }
  const unmount = () => document.querySelector("#wm-overlay")?.remove();

  // ask({title,text,confirm,danger,reason:{label,placeholder}}) -> false | true | reason string (min 5 chars)
  function ask({ title, text, confirm = "Так", danger = false, reason = null }) {
    return new Promise(resolve => {
      const reasonHtml = reason ? `<div class="form-group wm-reason"><label for="wm-reason">${esc(reason.label || "Причина")}</label><textarea id="wm-reason" rows="2" maxlength="500" placeholder="${esc(reason.placeholder || "Наприклад: помилковий запис")}"></textarea></div><p class="wm-error" role="alert" hidden></p>` : "";
      const overlay = mount(`<h3>${esc(title)}</h3><p class="wm-text">${esc(text)}</p>${reasonHtml}<div class="wm-foot"><button class="btn" type="button" data-wm="no">Скасувати</button><button class="btn ${danger ? "danger" : "primary"}" type="button" data-wm="yes">${esc(confirm)}</button></div>`);
      const done = value => { document.removeEventListener("keydown", onKey); unmount(); resolve(value); };
      const onKey = event => { if (event.key === "Escape") done(false); };
      document.addEventListener("keydown", onKey);
      overlay.addEventListener("click", event => {
        const target = event.target.closest("[data-wm]");
        if (!target) { if (event.target === overlay) done(false); return; }
        if (target.dataset.wm !== "yes") return done(false);
        if (!reason) return done(true);
        const value = overlay.querySelector("#wm-reason").value.trim();
        if (value.length < 5) {
          const err = overlay.querySelector(".wm-error");
          err.textContent = "Вкажіть причину (щонайменше 5 символів).";
          err.hidden = false;
          overlay.querySelector("#wm-reason").focus();
          return;
        }
        done(value);
      });
      (reason ? overlay.querySelector("#wm-reason") : overlay.querySelector('[data-wm="no"]')).focus();
    });
  }

  // read-only dialog (history etc.): html must already be escaped
  function info({ title, html, close = "Закрити" }) {
    return new Promise(resolve => {
      const overlay = mount(`<h3>${esc(title)}</h3><div class="wm-body">${html}</div><div class="wm-foot"><button class="btn primary" type="button" data-wm="no">${esc(close)}</button></div>`);
      const done = () => { document.removeEventListener("keydown", onKey); unmount(); resolve(); };
      const onKey = event => { if (event.key === "Escape") done(); };
      document.addEventListener("keydown", onKey);
      overlay.addEventListener("click", event => { if (event.target === overlay || event.target.closest("[data-wm]")) done(); });
      overlay.querySelector('[data-wm="no"]').focus();
    });
  }

  // fields: {id,label,type,value,options:[value | [value,label]],full,placeholder,showWhen:[fieldId,value]}
  function form({ title, fields, submit = "Зберегти", note = "", onSubmit }) {
    return new Promise(resolve => {
      const control = field => {
        const common = `id="wm-${esc(field.id)}" ${field.placeholder ? `placeholder="${esc(field.placeholder)}"` : ""}`;
        if (field.type === "select") {
          return `<select ${common}>${field.options.map(option => {
            const [value, label] = Array.isArray(option) ? option : [option, option];
            return `<option value="${esc(value)}" ${String(value) === String(field.value ?? "") ? "selected" : ""}>${esc(label)}</option>`;
          }).join("")}</select>`;
        }
        if (field.type === "textarea") return `<textarea ${common} rows="3">${esc(field.value || "")}</textarea>`;
        return `<input ${common} type="${esc(field.type || "text")}" value="${esc(field.value || "")}">`;
      };
      const overlay = mount(`<h3>${esc(title)}</h3>${note ? `<p class="wm-text">${esc(note)}</p>` : ""}<div class="form-grid">${fields.map(field =>
        `<div class="form-group ${field.full ? "full" : ""}" data-wm-field="${esc(field.id)}"><label for="wm-${esc(field.id)}">${esc(field.label)}</label>${control(field)}</div>`).join("")}</div>
        <p class="wm-error" role="alert" hidden></p><div class="wm-foot"><button class="btn" type="button" data-wm="no">Скасувати</button><button class="btn primary" type="button" data-wm="yes">${esc(submit)}</button></div>`);
      const read = () => Object.fromEntries(fields.map(field => [field.id, (overlay.querySelector(`#wm-${field.id}`)?.value || "").trim()]));
      const refresh = () => {
        const values = read();
        for (const field of fields) {
          if (!field.showWhen) continue;
          overlay.querySelector(`[data-wm-field="${field.id}"]`).hidden = values[field.showWhen[0]] !== field.showWhen[1];
        }
      };
      const done = value => { document.removeEventListener("keydown", onKey); unmount(); resolve(value); };
      const onKey = event => { if (event.key === "Escape") done(null); };
      document.addEventListener("keydown", onKey);
      overlay.addEventListener("change", refresh);
      refresh();
      const errorEl = overlay.querySelector(".wm-error");
      overlay.addEventListener("click", async event => {
        const target = event.target.closest("[data-wm]");
        if (!target) { if (event.target === overlay) done(null); return; }
        if (target.dataset.wm === "no") return done(null);
        const values = Object.fromEntries(Object.entries(read()).filter(([id]) => !overlay.querySelector(`[data-wm-field="${id}"]`).hidden));
        if (!onSubmit) return done(values);
        target.disabled = true;
        errorEl.hidden = true;
        try { await onSubmit(values); done(values); }
        catch (error) { errorEl.textContent = errorText(error); errorEl.hidden = false; target.disabled = false; }
      });
      overlay.querySelector("input,select,textarea")?.focus();
    });
  }

  const ERRORS = {
    permission_denied: "У вашої ролі немає доступу до цієї дії.",
    invalid_dealer: "Вкажіть назву дилера (2–120 символів).",
    dealer_not_found: "Дилера не знайдено.",
    invalid_customer: "Вкажіть ім’я клієнта та телефон (щонайменше 5 символів).",
    customer_not_found: "Клієнта не знайдено.",
    customer_has_warranties: "У клієнта є гарантії, тому видалити його не можна. Спершу видаліть відповідні продажі (картка продажу → «Видалити продаж»), якщо вони створені помилково.",
    warranty_not_found: "Гарантію не знайдено.",
    installation_already_exists: "Монтаж для цієї гарантії вже підтверджено.",
    installation_already_planned: "Монтаж для цієї гарантії вже заплановано.",
    assignee_not_found: "Монтажника не знайдено або він вимкнений.",
    executor_required: "Вкажіть ім’я та телефон виконавця.",
    work_item_not_found: "Монтаж не знайдено.",
    work_item_closed: "Цей монтаж уже закрито.",
    product_already_sold: "Проданий виріб змінити не можна.",
    model_not_found: "Модель не знайдено.",
    reason_required: "Вкажіть причину (щонайменше 5 символів)."
  };
  function errorText(error) {
    const code = String(error?.message || "");
    if (ERRORS[code]) return ERRORS[code];
    if (String(error?.code) === "23505") return "Такий запис уже існує.";
    if (String(error?.code) === "23503") return "Запис пов’язаний з іншими даними, тому його не можна видалити.";
    return "Не вдалося виконати дію. Спробуйте ще раз.";
  }
  const notify = (title, text) => (app().toast || (() => {}))(title, text);
  async function refresh() { await app().refresh?.(); }
  async function run(work, doneTitle, doneText) {
    try { const result = await work(); await refresh(); notify(doneTitle, doneText); return result; }
    catch (error) { notify("Не виконано", errorText(error)); return null; }
  }

  // ---------- dealers ----------
  async function editDealer(id) {
    const dealer = (live().dealers || []).find(item => item.id === id);
    if (!dealer) return;
    await form({
      title: `Змінити дилера`, submit: "Зберегти",
      fields: [
        { id: "name", label: "Назва дилера", value: dealer.name, full: true },
        { id: "code", label: "Код / місто", value: dealer.code || "" },
        { id: "phone", label: "Телефон", value: dealer.phone || "" },
        { id: "email", label: "Email", type: "email", value: dealer.email || "" },
        { id: "active", label: "Статус", type: "select", value: dealer.is_active ? "1" : "0", options: [["1", "Активний"], ["0", "Вимкнений (не показується у продажах)"]] }
      ],
      onSubmit: async values => {
        await window.WarrioData.updateDealer({ organizationId: orgId(), dealerId: id, name: values.name, code: values.code.toUpperCase(), phone: values.phone, email: values.email, isActive: values.active === "1" });
        await refresh();
        notify("Дилера збережено");
      }
    });
  }
  async function deleteDealer(id) {
    const dealer = (live().dealers || []).find(item => item.id === id);
    if (!dealer) return;
    const hasSales = (live().sales || []).some(sale => sale.dealer_id === id);
    const ok = await ask({
      title: `Видалити дилера «${dealer.name}»?`, danger: true, confirm: "Так, видалити", reason: { label: "Чому видаляєте дилера?" },
      text: hasSales ? "У дилера є продажі. Щоб не втратити історію, його буде вимкнено (не показуватиметься у нових продажах). Продовжити?" : "Дилера буде видалено без можливості відновлення. Продовжити?"
    });
    if (!ok) return;
    const result = await run(() => window.WarrioData.deleteDealer({ organizationId: orgId(), dealerId: id, reason: ok }), "Готово");
    if (result === "deactivated") notify("Дилера вимкнено", "Є історія продажів, тому запис збережено як неактивний.");
    else if (result) notify("Дилера видалено");
  }

  // ---------- customers ----------
  async function editCustomer(id) {
    const customer = (live().customers || []).find(item => item.id === id);
    if (!customer) return;
    await form({
      title: "Змінити клієнта", submit: "Зберегти",
      fields: [
        { id: "name", label: "ПІБ", value: customer.full_name, full: true },
        { id: "phone", label: "Телефон", value: customer.phone },
        { id: "email", label: "Email", type: "email", value: customer.email || "" },
        { id: "address", label: "Адреса монтажу", value: customer.installation_address || "", full: true }
      ],
      onSubmit: async values => {
        await window.WarrioData.updateCustomer({ organizationId: orgId(), customerId: id, fullName: values.name, phone: values.phone, email: values.email, address: values.address });
        await refresh();
        notify("Клієнта збережено");
      }
    });
  }
  async function deleteCustomer(id) {
    const customer = (live().customers || []).find(item => item.id === id);
    if (!customer) return;
    const ok = await ask({ title: `Видалити клієнта «${customer.full_name}»?`, text: "Контактні дані клієнта буде видалено без можливості відновлення.", confirm: "Так, видалити", danger: true, reason: { label: "Чому видаляєте клієнта?" } });
    if (!ok) return;
    if (await run(() => window.WarrioData.deleteCustomer({ organizationId: orgId(), customerId: id, reason: ok }), "Клієнта видалено")) document.querySelector("#modal-overlay")?.classList.remove("open");
  }

  // ---------- installations ----------
  function installerOptions() {
    const directory = live().teamDirectory || [];
    return directory.filter(member => member.role === "installer" && member.isActive).map(member => [member.userId, member.displayName || member.email || "Монтажник"]);
  }
  function pendingWarranties() {
    const planned = new Set((live().workItems || []).filter(item => item.item_type === "installation" && ["open", "in_progress"].includes(item.status)).map(item => item.warranty_id));
    return (live().warranties || []).filter(item => item.status === "active_pending_installation" && !item.installation && !planned.has(item.id));
  }
  async function planInstall(serial) {
    const candidates = pendingWarranties();
    if (!candidates.length) return notify("Нема що планувати", "Усі гарантії вже мають монтаж або ще не активовані покупцем.");
    const picked = candidates.find(item => item.sale?.product?.serial_number === serial) || candidates[0];
    const installers = installerOptions();
    const custom = "__custom";
    await form({
      title: "Запланувати монтаж", submit: "Запланувати",
      note: "Монтажнику призначається номер. Потім монтаж можна швидко підтвердити кнопкою на картці.",
      fields: [
        { id: "warranty", label: "Обладнання (гарантія)", type: "select", full: true, value: picked.id, options: candidates.map(item => [item.id, `${item.warranty_number} · ${item.sale?.product?.serial_number || "—"} · ${item.customer?.full_name || "клієнт"}`]) },
        { id: "date", label: "Дата монтажу", type: "date", value: today() },
        { id: "executor", label: "Виконавець", type: "select", value: installers[0]?.[0] || custom, options: [...installers, [custom, "Свій варіант (ім’я та телефон)"]] },
        { id: "name", label: "Ім’я виконавця", showWhen: ["executor", custom], placeholder: "Прізвище та ім’я" },
        { id: "phone", label: "Телефон", showWhen: ["executor", custom], placeholder: "+380…" },
        { id: "company", label: "Бренд / компанія (необов’язково)", showWhen: ["executor", custom], full: true },
        { id: "note", label: "Примітка", type: "textarea", full: true }
      ],
      onSubmit: async values => {
        const own = values.executor === custom;
        const result = await window.WarrioData.planInstallation({
          organizationId: orgId(), warrantyId: values.warranty, plannedFor: values.date || null,
          assignedUserId: own ? null : values.executor, executorName: own ? values.name : null,
          executorPhone: own ? values.phone : null, executorCompany: own ? values.company : null, note: values.note
        });
        await refresh();
        notify(`Монтаж №${result?.[0]?.number ?? ""} заплановано`, "Підтвердити його можна на вкладці «Монтажі».");
      }
    });
  }
  async function confirmInstall(workItemId) {
    const item = (live().workItems || []).find(row => row.id === workItemId);
    if (!item) return;
    await form({
      title: `Підтвердити монтаж №${item.item_no ?? ""}`, submit: "✓ Підтвердити",
      fields: [
        { id: "date", label: "Дата монтажу", type: "date", value: today() },
        { id: "comment", label: "Коментар (необов’язково)", full: true }
      ],
      onSubmit: async values => {
        await window.WarrioData.confirmInstallationItem({ organizationId: orgId(), workItemId, installedOn: values.date, comment: values.comment });
        await refresh();
        notify("Монтаж підтверджено", "Гарантію оновлено.");
      }
    });
  }

  // ---------- find a warranty: by number, serial, client phone or name ----------
  const digits = value => String(value || "").replace(/\D+/g, "");
  function findWarranties(query) {
    const text = String(query || "").trim().toLowerCase();
    if (text.length < 2) return [];
    const wanted = digits(text);
    return (live().warranties || []).filter(item => {
      const hay = `${item.warranty_number} ${item.sale?.product?.serial_number || ""} ${item.customer?.full_name || ""} ${item.customer?.email || ""}`.toLowerCase();
      return hay.includes(text) || (wanted.length >= 4 && digits(item.customer?.phone).includes(wanted));
    });
  }
  function openFinder() {
    const overlay = mount(`<h3>Знайти гарантію</h3><p class="wm-text">Введіть номер гарантії (WRR-…), серійний номер, телефон або ім’я клієнта — побачите всі гарантії клієнта.</p>
      <div class="form-group"><input id="wm-find" type="search" placeholder="WRR-…, N600-…, +380… або ім’я" autocomplete="off"></div>
      <div id="wm-find-list" class="wm-list"></div>
      <p class="wm-text wm-small">Захищений код із QR зберігається лише у вигляді відбитка, тому повторно його показати неможливо. Клієнт відкриває публічну сторінку за QR із PDF; тут шукайте за номером, SN або телефоном.</p>
      <div class="wm-foot"><button class="btn" type="button" data-wm="no">Закрити</button></div>`);
    const input = overlay.querySelector("#wm-find"), list = overlay.querySelector("#wm-find-list");
    const render = () => {
      const rows = findWarranties(input.value);
      list.innerHTML = input.value.trim().length < 2 ? "" : rows.map(item => `<div class="wm-row"><div><b>${esc(item.warranty_number)}</b><small>${esc(item.sale?.product?.model?.name || "—")} · ${esc(item.sale?.product?.serial_number || "—")}</small><small>${esc(item.customer?.full_name || "—")} · ${esc(item.customer?.phone || "")}</small></div><button class="btn small" type="button" data-wm-open="${esc(item.warranty_number)}">Відкрити</button></div>`).join("")
        || '<p class="wm-text">Нічого не знайдено. Перевірте номер або спробуйте останні цифри телефону.</p>';
    };
    input.addEventListener("input", render);
    overlay.addEventListener("click", event => {
      const open = event.target.closest("[data-wm-open]");
      if (open) { unmount(); window.demoWarranty?.(open.dataset.wmOpen); return; }
      if (event.target.closest('[data-wm="no"]') || event.target === overlay) unmount();
    });
    document.addEventListener("keydown", function onKey(event) { if (event.key === "Escape") { unmount(); document.removeEventListener("keydown", onKey); } });
    input.focus();
  }

  // ---------- wiring ----------
  document.addEventListener("click", event => {
    const target = event.target.closest("[data-manage]");
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    const id = target.dataset.id;
    ({
      "dealer-edit": editDealer, "dealer-delete": deleteDealer,
      "customer-edit": editCustomer, "customer-delete": deleteCustomer,
      "plan-install": () => planInstall(target.dataset.sn), "confirm-install": confirmInstall,
      "find-warranty": openFinder
    })[target.dataset.manage]?.(id);
  }, true);

  window.WarrioManage = { ask, info, form, eventLabel, entityLabel, eventDetail, findWarranties, digits, canManage: isAdmin };
})();
