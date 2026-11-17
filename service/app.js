(() => {
  "use strict";
  const config = window.WARRIO_WEB_CONFIG || {};
  const baseUrl = String(config.supabaseUrl || "").replace(/\/$/, "");
  const apiKey = config.supabasePublishableKey || "";
  const form = document.querySelector("#service-form");
  const message = document.querySelector("#message");
  const submit = form.querySelector("button[type=submit]");
  const token = new URLSearchParams(location.search).get("token") || "";
  if (location.search) history.replaceState(null, "", location.pathname);
  const valid = /^[A-Za-z0-9_-]{16,128}$/.test(token);
  if (!valid) {
    message.textContent = "Це посилання неповне. Відкрийте сторінку з QR-перевірки гарантії ще раз.";
    submit.disabled = true;
  }
  const errors = {
    too_many_open_requests: "По цьому виробу вже є кілька відкритих звернень. Зачекайте відповіді компанії.",
    invalid_photo_links: "Посилання мають починатися з https:// (не більше 5).",
    warranty_not_found: "Гарантію не знайдено. Перевірте посилання.",
    contact_required: "Вкажіть телефон, щоб компанія могла з вами зв'язатися.",
    invalid_request: "Перевірте заголовок і довжину полів."
  };
  const statusLabels = { new: "Нове", in_progress: "У роботі", waiting_parts: "Чекаємо запчастини", resolved: "Вирішено", rejected: "Відхилено" };
  function renderRequests(rows) {
    const box = document.querySelector("#my-requests");
    const list = document.querySelector("#my-requests-list");
    list.textContent = "";
    if (!Array.isArray(rows) || !rows.length) { box.style.display = "none"; return; }
    for (const row of rows) {
      const item = document.createElement("div");
      item.style.cssText = "padding:10px 0;border-top:1px solid #e4e7f0";
      const head = document.createElement("b");
      head.textContent = row.title;
      const meta = document.createElement("div");
      meta.style.cssText = "color:#68738c;font-size:13px";
      meta.textContent = `${statusLabels[row.status] || row.status} · ${new Date(row.created_at).toLocaleDateString("uk-UA")}`;
      item.append(head, meta);
      if (row.resolution) {
        const note = document.createElement("div");
        note.style.cssText = "font-size:13px;margin-top:4px";
        note.textContent = `Відповідь компанії: ${row.resolution}`;
        item.append(note);
      }
      list.append(item);
    }
    box.style.display = "";
  }
  async function loadRequests() {
    if (!valid) return;
    try {
      const response = await fetch(`${baseUrl}/rest/v1/rpc/get_warrio_buyer_service_requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ p_token: token })
      });
      if (response.ok) renderRequests(await response.json());
    } catch { /* the status list is optional */ }
  }
  loadRequests();

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!valid) return;
    submit.disabled = true;
    message.textContent = "Надсилаємо…";
    const photos = document.querySelector("#photos").value.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    try {
      const response = await fetch(`${baseUrl}/rest/v1/rpc/submit_warrio_service_request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({
          p_token: token,
          p_title: document.querySelector("#title").value,
          p_description: document.querySelector("#description").value,
          p_photo_links: photos,
          p_contact_note: document.querySelector("#contact-note").value
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        message.textContent = errors[payload?.message] || `Не вдалося надіслати звернення (${payload?.message || response.status}). Спробуйте пізніше.`;
        submit.disabled = false;
        return;
      }
      const contact = [payload?.[0]?.support_phone, payload?.[0]?.support_email].filter(Boolean).join(" · ");
      document.querySelector("#support-line").textContent = contact ? `Компанія зв'яжеться з вами. Контакти: ${contact}` : "Компанія зв'яжеться з вами.";
      form.hidden = true;
      document.querySelector("#result").style.display = "";
      loadRequests();
    } catch {
      message.textContent = "Немає зв'язку із сервером. Спробуйте пізніше.";
      submit.disabled = false;
    }
  });
})();
