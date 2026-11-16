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
    invalid_request: "Перевірте заголовок і довжину полів."
  };
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
        message.textContent = errors[payload?.message] || "Не вдалося надіслати звернення. Спробуйте пізніше.";
        submit.disabled = false;
        return;
      }
      const contact = [payload?.[0]?.support_phone, payload?.[0]?.support_email].filter(Boolean).join(" · ");
      document.querySelector("#support-line").textContent = contact ? `Компанія зв'яжеться з вами. Контакти: ${contact}` : "Компанія зв'яжеться з вами.";
      form.hidden = true;
      document.querySelector("#result").style.display = "";
    } catch {
      message.textContent = "Немає зв'язку із сервером. Спробуйте пізніше.";
      submit.disabled = false;
    }
  });
})();
