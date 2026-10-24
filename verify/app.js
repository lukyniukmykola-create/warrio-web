(() => {
  "use strict";
  const config = window.WARRIO_CONFIG || { demo: true };
  const byId = id => document.getElementById(id);
  const form = byId("lookup-form");
  const tokenInput = byId("token");
  const loading = byId("loading");
  const result = byId("result");
  const notFound = byId("not-found");
  const formError = byId("form-error");
  const lookupHeader = byId("lookup-header");
  const publishableKey = config.supabasePublishableKey || config.supabaseAnonKey;
  const demo = config.demo !== false || !config.supabaseUrl || !publishableKey;
  byId("demo-banner").hidden = !demo;

  const setVisible = target => {
    for (const element of [loading, result, notFound]) element.hidden = element !== target;
  };
  const safeText = (id, value) => { byId(id).textContent = value || "Не вказано"; };
  const formatDate = value => {
    if (!value) return "";
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
  };
  const validToken = value => /^[A-Za-z0-9_-]{16,128}$/.test(value);
  const warrantyNumber = value => /^WRR-\d{4}-\d{3,10}$/i.test(value);
  const extractToken = value => {
    const trimmed = String(value || "").trim();
    if (!/^https?:\/\//i.test(trimmed)) return trimmed;
    try { return new URL(trimmed).searchParams.get("token")?.trim() || ""; }
    catch { return ""; }
  };
  const statuses = {
    active_pending_installation: { label: "Активна · очікує монтажу", tone: "verified", title: "Гарантію підтверджено", message: "Гарантія активна, підтвердження монтажу ще очікується." },
    active_installed: { label: "Активна", tone: "verified", title: "Гарантію підтверджено", message: "Обладнання має активну гарантію та підтверджений монтаж." },
    pending_buyer: { label: "Очікує активації", tone: "warning", title: "Реєстрацію ще не завершено", message: "Продаж зареєстрований, але покупець ще не активував гарантію." },
    suspended: { label: "Призупинена", tone: "danger", title: "Гарантію призупинено", message: "Зверніться до продавця або служби підтримки Warrio." },
    expired: { label: "Завершена", tone: "danger", title: "Строк гарантії завершено", message: "Гарантійний строк цього обладнання закінчився." },
    cancelled: { label: "Скасована", tone: "danger", title: "Гарантію скасовано", message: "Ця гарантія більше не є активною." }
  };
  const statusInfo = rawValue => {
    const raw = String(rawValue || "");
    if (statuses[raw]) return statuses[raw];
    if (/призуп|скас|заверш|закінч/i.test(raw)) return { label: raw, tone: "danger", title: "Гарантія не активна", message: "Зверніться до продавця або служби підтримки Warrio." };
    if (/актив/i.test(raw)) return { label: raw, tone: "verified", title: "Гарантію підтверджено", message: "Обладнання має активну гарантію Warrio." };
    return { label: raw || "Невідомий", tone: "warning", title: "Статус гарантії отримано", message: "Для уточнення зверніться до служби підтримки Warrio." };
  };

  async function timedFetch(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch(url, { ...options, signal: controller.signal }); }
    finally { clearTimeout(timer); }
  }

  async function findWarranty(token) {
    if (demo) {
      const response = await timedFetch("data/demo-public-registry.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Демонстраційний реєстр недоступний.");
      const registry = await response.json();
      const entry = registry.warranties.find(item => item.token === token);
      return entry ? entry.warranty : null;
    }

    const base = config.supabaseUrl.replace(/\/$/, "");
    const response = await timedFetch(`${base}/rest/v1/rpc/get_public_warranty`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: publishableKey
      },
      body: JSON.stringify({ lookup_token: token })
    });
    if (!response.ok) throw new Error("Сервіс перевірки тимчасово недоступний.");
    const payload = await response.json();
    return Array.isArray(payload) ? payload[0] || null : payload;
  }

  async function lookup(input) {
    formError.textContent = "";
    tokenInput.value = input;
    const token = extractToken(input);
    if (warrantyNumber(token)) {
      setVisible(null);
      formError.textContent = "Це номер гарантії, а не захищений код. У кабінеті знайдіть його через «Гарантії», а для публічної перевірки відкрийте QR або посилання з email/PDF.";
      return;
    }
    if (!validToken(token)) {
      setVisible(null);
      formError.textContent = "Вставте повне посилання з email/PDF або захищений код із QR (16–128 символів).";
      return;
    }
    setVisible(loading);
    try {
      const warranty = await findWarranty(token);
      if (!warranty) return setVisible(notFound);
      const installationRequired = (warranty.installationRequired ?? warranty.installation_required) !== false;
      const status = { ...statusInfo(warranty.status) };
      if (!installationRequired && warranty.status === "active_installed") {
        status.message = "Обладнання має активну гарантію; окреме підтвердження монтажу за правилами компанії не вимагається.";
      }
      safeText("status", status.label);
      byId("status").className = `status-pill ${status.tone === "verified" ? "" : status.tone}`;
      byId("result-shield").className = `shield ${status.tone}`;
      byId("result-shield").textContent = status.tone === "danger" ? "!" : "✓";
      safeText("result-title", status.title);
      safeText("result-message", status.message);
      safeText("warranty-number", warranty.warrantyNumber ?? warranty.warranty_number);
      safeText("model", warranty.model);
      safeText("serial", warranty.serialNumber ?? warranty.serial_number);
      safeText("sale-date", formatDate(warranty.saleDate ?? warranty.sale_date));
      const installDate = warranty.installDate ?? warranty.install_date;
      safeText("installation-status", !installationRequired ? "Не вимагається" : installDate ? "Підтверджено" : "Очікує підтвердження");
      safeText("timeline-sale", formatDate(warranty.saleDate ?? warranty.sale_date));
      safeText("timeline-install", formatDate(installDate));
      byId("timeline-install-row").hidden = !installDate;
      lookupHeader.hidden = true;
      form.hidden = true;
      setVisible(result);
    } catch (error) {
      console.error(error);
      setVisible(null);
      formError.textContent = "Не вдалося виконати перевірку. Спробуйте пізніше.";
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const input = tokenInput.value.trim();
    const token = extractToken(input);
    history.replaceState(null, "", `?token=${encodeURIComponent(token)}`);
    lookup(input);
  });

  byId("check-another").addEventListener("click", () => {
    history.replaceState(null, "", location.pathname);
    lookupHeader.hidden = false;
    form.hidden = false;
    tokenInput.value = "";
    formError.textContent = "";
    setVisible(null);
    tokenInput.focus();
  });

  const initial = new URLSearchParams(location.search).get("token")?.trim();
  if (initial) lookup(initial);
})();
