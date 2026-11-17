// Settings card "Telegram": link this account to the Warrio bot to receive notifications.
(function () {
  "use strict";
  const context = () => window.WarrioSession?.getContext?.();
  const $ = selector => document.querySelector(selector);
  const botName = () => String(window.WARRIO_WEB_CONFIG?.telegramBot || "").replace(/^@/, "");

  function ensureCard() {
    const ctx = context();
    const grid = $("#page-settings .settings-grid");
    if (!grid || !ctx?.organization?.id || $("#telegram-card")) return !!$("#telegram-card");
    grid.insertAdjacentHTML("beforeend", `<div class="card settings-card" id="telegram-card" hidden>
      <h3>Сповіщення в Telegram</h3>
      <p>Нові звернення в сервіс і завдання приходитимуть вам у Telegram.</p>
      <div id="telegram-state" style="margin:10px 0;color:var(--muted)"></div>
      <div id="telegram-code" style="display:none;margin:10px 0;padding:12px;border-radius:14px;background:var(--soft)"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" id="telegram-connect" type="button">Підключити Telegram</button><button class="btn" id="telegram-off" type="button" hidden>Відключити</button></div>
    </div>`);
    $("#telegram-connect").addEventListener("click", connect);
    $("#telegram-off").addEventListener("click", disconnect);
    return true;
  }

  async function refresh() {
    const ctx = context();
    if (!ensureCard()) return;
    const card = $("#telegram-card");
    try {
      const rows = await window.WarrioData.query("telegram_links", { select: "username,created_at", organization_id: `eq.${ctx.organization.id}`, user_id: `eq.${ctx.user?.id}`, limit: 1 });
      const linked = !!rows?.length;
      $("#telegram-state").textContent = linked ? `Підключено${rows[0].username ? ` (@${rows[0].username})` : ""}.` : "Не підключено.";
      $("#telegram-connect").textContent = linked ? "Підключити інший чат" : "Підключити Telegram";
      $("#telegram-off").hidden = !linked;
      card.hidden = false;
    } catch { card.hidden = true; /* migration 024 not applied */ }
  }

  async function connect() {
    const box = $("#telegram-code");
    try {
      const code = await window.WarrioData.rpc("create_warrio_telegram_link_code", { p_organization_id: context().organization.id });
      const bot = botName();
      box.textContent = "";
      const head = document.createElement("div");
      head.textContent = "Код діє 15 хвилин. Надішліть боту команду:";
      const cmd = document.createElement("b");
      cmd.style.cssText = "display:block;font-size:20px;margin:6px 0;letter-spacing:.06em";
      cmd.textContent = `/start ${code}`;
      box.append(head, cmd);
      if (bot) {
        const link = document.createElement("a");
        link.href = `https://t.me/${encodeURIComponent(bot)}?start=${encodeURIComponent(code)}`;
        link.target = "_blank"; link.rel = "noopener noreferrer";
        link.textContent = "Відкрити бота в Telegram";
        box.append(link);
      } else {
        const note = document.createElement("small");
        note.textContent = "Бот ще не підключений адміністратором Warrio.";
        box.append(note);
      }
      box.style.display = "block";
    } catch { box.textContent = "Не вдалося створити код. Спробуйте ще раз."; box.style.display = "block"; }
  }

  async function disconnect() {
    try {
      await window.WarrioData.rpc("unlink_warrio_telegram", { p_organization_id: context().organization.id });
      $("#telegram-code").style.display = "none";
      refresh();
    } catch { $("#telegram-state").textContent = "Не вдалося відключити."; }
  }

  document.addEventListener("click", event => { if (event.target.closest('[data-page="settings"],[data-page-link="settings"]')) setTimeout(refresh, 300); });
  setInterval(() => { if (!$("#telegram-card")) refresh(); }, 2500);
})();
