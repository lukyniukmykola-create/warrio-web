(() => {
  "use strict";
  const config = window.WARRIO_WEB_CONFIG || {};
  const baseUrl = String(config.supabaseUrl || "").replace(/\/$/, "");
  const apiKey = config.supabasePublishableKey || "";
  const form = document.querySelector("#activation-form");
  const message = document.querySelector("#message");
  const result = document.querySelector("#result");
  const submit = form.querySelector("button[type=submit]");
  let delivery = null;

  const params = new URLSearchParams(location.search);
  const fixedOrganization = (params.get("org") || "").toLowerCase();
  const fixedSerial = (params.get("sn") || "").toUpperCase();
  const fixedCode = params.get("code") || "";
  document.querySelector("#organization").value = fixedOrganization;
  document.querySelector("#serial").value = fixedSerial;
  document.querySelector("#activation-code").value = fixedCode;
  if (params.has("code")) history.replaceState(null, "", location.pathname);
  if (!fixedOrganization || !fixedSerial || !/^[A-Za-z0-9_-]{32,128}$/.test(fixedCode)) {
    message.textContent = "Це посилання неповне або пошкоджене. Попросіть продавця створити нове посилання активації.";
    submit.disabled = true;
  }

  function configured() {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(baseUrl) && /^sb_publishable_[A-Za-z0-9_-]+$/.test(apiKey);
  }

  async function callFunction(name, body, timeoutMs = 30000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}/functions/v1/${encodeURIComponent(name)}`, {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.error || `HTTP ${response.status}`);
        error.status = response.status;
        Object.assign(error, payload);
        throw error;
      }
      return payload;
    } finally { clearTimeout(timer); }
  }

  function activationMessage(error) {
    const value = String(error?.message || error || "");
    if (value.includes("sale_or_activation_code_not_found")) return "Продаж або код активації не знайдено. Перевірте SN і повідомлення дилера.";
    if (value.includes("warranty_already_exists")) {
      const contacts = [error?.supportPhone, error?.supportEmail].filter(Boolean).join(" · ");
      return `Гарантію для цього обладнання вже оформлено.${error?.organizationName ? ` Компанія: ${error.organizationName}.` : ""}${contacts ? ` Якщо виникла проблема, зверніться: ${contacts}.` : " Зверніться до компанії-продавця."}`;
    }
    if (value.includes("invalid_customer_data")) return "Перевірте контактні дані та адресу монтажу.";
    if (value.includes("AbortError") || value.includes("aborted")) return "Сервер не відповів вчасно. Повторіть спробу.";
    return "Активацію не виконано. Перевірте дані або зверніться до дилера.";
  }

  function verificationUrl(token) {
    const path = config.verificationPath || "../verify/index.html";
    const url = new URL(path, new URL("../", location.href));
    url.searchParams.set("token", token);
    return url.href;
  }

  async function deliverCertificate() {
    if (!delivery) return;
    const status = document.querySelector("#delivery-status");
    const retry = document.querySelector("#retry-email");
    status.textContent = "Створюємо PDF із QR-кодом і надсилаємо його на email…";
    retry.hidden = true;
    try {
      const sent = await callFunction("send-warranty-email", { warrantyId: delivery.warrantyId, publicToken: delivery.publicToken }, 45000);
      status.textContent = sent.alreadySent ? "Сертифікат уже був надісланий на ваш email." : "PDF із QR-кодом створено й надіслано на ваш email.";
    } catch {
      status.textContent = "Гарантію активовано, але PDF або email поки не доставлено. Не закривайте сторінку та повторіть.";
      retry.hidden = false;
    }
  }

  document.querySelector("#retry-email").addEventListener("click", deliverCertificate);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.className = "message"; message.textContent = "";
    if (!configured()) { message.textContent = "Warrio Web ще не підключено до Supabase."; return; }
    submit.disabled = true; submit.textContent = "Активуємо…";
    try {
      const created = await callFunction("activate-warranty", {
        organizationSlug: fixedOrganization,
        serialNumber: fixedSerial,
        activationCode: fixedCode,
        customerName: document.querySelector("#customer-name").value.trim(),
        customerPhone: document.querySelector("#customer-phone").value.trim(),
        customerEmail: document.querySelector("#customer-email").value.trim().toLowerCase(),
        installationAddress: document.querySelector("#installation-address").value.trim(),
      });
      delivery = created;
      document.querySelector("#activation-code").value = "";
      document.querySelector("#warranty-number").textContent = created.warrantyNumber;
      document.querySelector("#warranty-status").textContent = created.status === "active_installed" ? "Активна" : "Очікує монтажу";
      document.querySelector("#warranty-expiry").textContent = created.expiresOn ? new Date(`${created.expiresOn}T12:00:00`).toLocaleDateString("uk-UA") : "Не визначено";
      document.querySelector("#verify-link").href = verificationUrl(created.publicToken);
      result.classList.add("show");
      form.hidden = true;
      document.querySelector("#steps").hidden = true;
      await deliverCertificate();
    } catch (error) {
      message.textContent = activationMessage(error);
    } finally {
      submit.disabled = false; submit.textContent = "Активувати й отримати PDF";
    }
  });
})();
