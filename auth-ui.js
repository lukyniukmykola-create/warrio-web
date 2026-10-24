(() => {
  "use strict";

  const roleNames = { owner: "Власник", admin: "Адміністратор", dealer: "Дилер", installer: "Монтажник" };
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  let currentContext = null;

  document.body.insertAdjacentHTML("afterbegin", `
    <div class="auth-gate" id="auth-gate">
      <div class="auth-layout">
        <section class="auth-story">
          <div class="brand"><i class="logo"></i><span>Warrio</span></div>
          <h1>Гарантійний процес без таблиць і хаосу.</h1>
          <p>Продаж, активація, монтаж і перевірка гарантії працюють як один захищений процес.</p>
          <div class="auth-points">
            <div class="auth-point"><i>1</i><div><b>Один серійний номер</b><small>Система не дозволяє повторний продаж або другу активну гарантію.</small></div></div>
            <div class="auth-point"><i>2</i><div><b>Розмежування ролей</b><small>Власник, адміністратор, дилер і монтажник бачать лише дозволені дані.</small></div></div>
            <div class="auth-point"><i>3</i><div><b>Публічна перевірка без ПД</b><small>QR показує статус обладнання без імені, телефону чи адреси покупця.</small></div></div>
          </div>
        </section>
        <section class="auth-panel">
          <div class="auth-view auth-loading" data-auth-view="loading"><div class="auth-spinner"></div><h2>Перевіряємо вхід</h2><p>Безпечно відновлюємо вашу сесію Warrio…</p></div>
          <div class="auth-view" data-auth-view="login" hidden>
            <h2>Вхід до Warrio</h2><p>Увійдіть як власник, адміністратор, дилер або монтажник.</p>
            <form class="auth-form" id="login-form">
              <div class="auth-field"><label for="login-email">Email</label><input id="login-email" type="email" autocomplete="username" required placeholder="name@company.ua"></div>
              <div class="auth-field"><label for="login-password">Пароль</label><input id="login-password" type="password" autocomplete="current-password" required minlength="8" placeholder="Ваш пароль"></div>
              <button class="auth-submit" type="submit">Увійти</button>
            </form>
            <div class="auth-error" id="login-error"></div>
            <div class="auth-links"><button class="auth-link" type="button" data-auth-action="recovery">Забули пароль?</button><button class="auth-link" type="button" data-auth-action="signup">Створити акаунт</button></div>
            <div class="auth-separator">АБО</div><button class="auth-secondary" type="button" data-auth-action="demo">Переглянути демонстрацію</button>
            <p class="auth-note">Warrio не просить пароль Google. Авторизація виконується через Supabase Auth, а доступ до даних додатково обмежує RLS.</p>
          </div>
          <div class="auth-view" data-auth-view="signup" hidden>
            <h2>Створення акаунта</h2><p>Після реєстрації ви створите першу організацію Warrio.</p>
            <form class="auth-form" id="signup-form">
              <div class="auth-field"><label for="signup-name">Ім’я та прізвище</label><input id="signup-name" required maxlength="200"></div>
              <div class="auth-field"><label for="signup-email">Email</label><input id="signup-email" type="email" autocomplete="username" required></div>
              <div class="auth-field"><label for="signup-password">Пароль</label><input id="signup-password" type="password" autocomplete="new-password" required minlength="8"></div>
              <button class="auth-submit" type="submit">Створити акаунт</button>
            </form><div class="auth-error" id="signup-error"></div><div class="auth-links"><button class="auth-link" type="button" data-auth-action="login">← Повернутися до входу</button></div>
          </div>
          <div class="auth-view" data-auth-view="organization" hidden>
            <h2>Створіть організацію</h2><p>Це окремий захищений простір для вашої компанії, користувачів і гарантій.</p>
            <form class="auth-form" id="organization-form">
              <div class="auth-field"><label for="org-name">Назва компанії</label><input id="org-name" value="Warrio" required minlength="2" maxlength="160"></div>
              <div class="auth-field"><label for="org-slug">Коротка адреса</label><input id="org-slug" value="warrio" required pattern="[a-z0-9][a-z0-9-]{1,61}[a-z0-9]"></div>
              <button class="auth-submit" type="submit">Створити робочий простір</button>
            </form><div class="auth-error" id="organization-error"></div>
          </div>
          <div class="auth-view" data-auth-view="reset" hidden>
            <h2>Новий пароль</h2><p>Вкажіть новий пароль для свого акаунта Warrio.</p>
            <form class="auth-form" id="reset-form">
              <div class="auth-field"><label for="reset-password">Новий пароль</label><input id="reset-password" type="password" autocomplete="new-password" required minlength="8" maxlength="72"></div>
              <div class="auth-field"><label for="reset-password-confirm">Повторіть пароль</label><input id="reset-password-confirm" type="password" autocomplete="new-password" required minlength="8" maxlength="72"></div>
              <button class="auth-submit" type="submit">Зберегти новий пароль</button>
            </form><div class="auth-error" id="reset-error"></div>
          </div>
          <div class="auth-view" data-auth-view="message" hidden><h2 id="auth-message-title">Готово</h2><p id="auth-message-text"></p><button class="auth-secondary" type="button" data-auth-action="login">Повернутися до входу</button></div>
        </section>
      </div>
    </div>`);

  const gate = document.querySelector("#auth-gate");
  const view = name => document.querySelectorAll("[data-auth-view]").forEach(item => { item.hidden = item.dataset.authView !== name; });
  const setBusy = (form, busy) => { const button = form.querySelector("button[type=submit]"); if(!button.dataset.label)button.dataset.label=button.textContent;button.disabled = busy; button.textContent = busy ? "Зачекайте…" : button.dataset.label; };
  const errorText = error => {
    const raw = String(error?.message || "").toLowerCase();
    if (raw.includes("invalid login")) return "Неправильний email або пароль.";
    if (raw.includes("email not confirmed")) return "Спочатку підтвердьте email у листі Supabase.";
    if (raw.includes("already registered")) return "Такий email уже зареєстрований.";
    if (raw.includes("rate limit")) return "Забагато спроб. Спробуйте трохи пізніше.";
    if (raw.includes("timeout") || raw.includes("abort")) return "Supabase не відповів вчасно. Перевірте інтернет і повторіть спробу.";
    if (raw.includes("organization_slug") || raw.includes("duplicate")) return "Така коротка адреса вже зайнята. Вкажіть іншу.";
    return "Операцію не виконано. Перевірте дані та повторіть спробу.";
  };

  function updateIdentity(context) {
    const name = context.profile?.display_name || context.user?.user_metadata?.full_name || context.user?.email || "Користувач";
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
    const user = document.querySelector("#user-menu");
    if (user) user.innerHTML = `<div class="avatar">${escapeHtml(initials || "W")}</div><div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(roleNames[context.membership?.role] || "Користувач")} · ${escapeHtml(context.organization?.name || "Warrio")}</small></div><span>⌄</span>`;
  }

  function applyRoleNavigation(role) {
    const allowed = {
      owner: ["dashboard","sales","warranties","dealers","installations","customers","tasks","reports","documents","team","settings","help"],
      admin: ["dashboard","sales","warranties","dealers","installations","customers","tasks","reports","documents","team","settings","help"],
      dealer: ["dashboard","sales","warranties","customers","tasks","documents","help"],
      installer: ["dashboard","warranties","installations","tasks","help"]
    }[role] || ["dashboard","help"];
    document.querySelectorAll(".nav-btn[data-page]").forEach(button => { button.hidden = !allowed.includes(button.dataset.page); });
    document.querySelectorAll('[data-modal="sale"]').forEach(button => { button.hidden = !["owner","admin","dealer"].includes(role); });
    document.querySelectorAll('[data-page-link="activation"]').forEach(button => { button.hidden = !["owner","admin","dealer"].includes(role); });
    document.querySelectorAll('[data-modal="dealer"]').forEach(button => { button.hidden = !["owner","admin"].includes(role); });
    document.querySelectorAll('[data-modal="member"]').forEach(button => { button.hidden = role !== "owner"; });
    document.querySelectorAll('[data-modal="installation"]').forEach(button => { button.hidden = !["owner","admin","installer"].includes(role); });
    if (!allowed.includes(document.querySelector(".page.active")?.id?.replace("page-", ""))) document.querySelector('.nav-btn[data-page="dashboard"]')?.click();
  }

  async function enterLiveMode() {
    view("loading"); gate.hidden = false;
    const context = await window.WarrioData.loadContext();
    currentContext = context;
    if (!context.membership || !context.organization) { view("organization"); return; }
    const data = await window.WarrioData.loadWorkspace(context.organization.id, context.membership.role);
    updateIdentity(context);
    applyRoleNavigation(context.membership.role);
    document.body.dataset.mode = "live";
    window.applyWarrioLiveData?.(data, context);
    const status = document.querySelector("#backend-status");
    if (status) status.innerHTML = `<b><i class="online"></i> Реальні дані підключено</b><span>${escapeHtml(context.organization.name)} · ${escapeHtml(roleNames[context.membership.role] || context.membership.role)}</span>`;
    const logoutButton=document.querySelector('[data-action="logout"]');if(logoutButton)logoutButton.textContent="Вийти з акаунта";
    sessionStorage.removeItem("warrio.demo.enabled");
    gate.hidden = true;
  }

  function enterDemoMode() {
    sessionStorage.setItem("warrio.demo.enabled", "1");
    document.body.dataset.mode = "demo";
    document.querySelectorAll(".nav-btn[data-page]").forEach(button=>button.hidden=false);
    const logoutButton=document.querySelector('[data-action="logout"]');if(logoutButton)logoutButton.textContent="Увійти до Warrio";
    const status = document.querySelector("#backend-status");
    if (status) status.innerHTML = '<b><i class="online" style="background:#f2a112"></i> Демонстраційні дані</b><span>Supabase доступний, вхід не виконано</span>';
    gate.hidden = true;
  }

  document.querySelector("#login-form").addEventListener("submit", async event => {
    event.preventDefault(); const form = event.currentTarget; const error = document.querySelector("#login-error"); error.textContent = ""; setBusy(form, true);
    try { await window.WarrioAuth.signIn(document.querySelector("#login-email").value, document.querySelector("#login-password").value); await enterLiveMode(); }
    catch (cause) { error.textContent = errorText(cause); }
    finally { setBusy(form, false); }
  });

  document.querySelector("#signup-form").addEventListener("submit", async event => {
    event.preventDefault(); const form = event.currentTarget; const error = document.querySelector("#signup-error"); error.textContent = ""; setBusy(form, true);
    try {
      const result = await window.WarrioAuth.signUp(document.querySelector("#signup-email").value, document.querySelector("#signup-password").value, document.querySelector("#signup-name").value);
      if (result?.confirmationRequired) { document.querySelector("#auth-message-title").textContent = "Підтвердьте email"; document.querySelector("#auth-message-text").textContent = "Ми надіслали лист. Відкрийте його, підтвердьте адресу й поверніться до входу."; view("message"); }
      else await enterLiveMode();
    } catch (cause) { error.textContent = errorText(cause); }
    finally { setBusy(form, false); }
  });

  document.querySelector("#organization-form").addEventListener("submit", async event => {
    event.preventDefault(); const form = event.currentTarget; const error = document.querySelector("#organization-error"); error.textContent = ""; setBusy(form, true);
    try { await window.WarrioData.createOrganization(document.querySelector("#org-name").value.trim(), document.querySelector("#org-slug").value.trim().toLowerCase()); await enterLiveMode(); }
    catch (cause) { error.textContent = errorText(cause); }
    finally { setBusy(form, false); }
  });

  document.querySelector("#reset-form").addEventListener("submit", async event => {
    event.preventDefault(); const form = event.currentTarget; const error = document.querySelector("#reset-error"); error.textContent = "";
    const password = document.querySelector("#reset-password").value;
    if (password !== document.querySelector("#reset-password-confirm").value) { error.textContent = "Паролі не збігаються."; return; }
    setBusy(form, true);
    try { await window.WarrioAuth.updatePassword(password); await window.WarrioAuth.signOut(); document.querySelector("#auth-message-title").textContent = "Пароль змінено"; document.querySelector("#auth-message-text").textContent = "Увійдіть до Warrio з новим паролем."; view("message"); }
    catch (cause) { error.textContent = errorText(cause); }
    finally { setBusy(form, false); }
  });

  document.addEventListener("click", async event => {
    const action = event.target.closest("[data-auth-action]")?.dataset.authAction;
    if (action === "demo") enterDemoMode();
    if (action === "login") view("login");
    if (action === "signup") view("signup");
    if (action === "recovery") {
      const email = document.querySelector("#login-email").value.trim(); const error = document.querySelector("#login-error");
      if (!email) { error.textContent = "Спочатку введіть email."; return; }
      try { await window.WarrioAuth.sendPasswordRecovery(email); document.querySelector("#auth-message-title").textContent = "Перевірте пошту"; document.querySelector("#auth-message-text").textContent = "Ми надіслали безпечне посилання на сторінку зміни пароля."; view("message"); }
      catch (cause) { error.textContent = errorText(cause); }
    }
    if (action === "magic") {
      const email = document.querySelector("#login-email").value.trim(); const error = document.querySelector("#login-error");
      if (!email) { error.textContent = "Спочатку введіть email."; return; }
      try { await window.WarrioAuth.sendMagicLink(email); document.querySelector("#auth-message-title").textContent = "Перевірте пошту"; document.querySelector("#auth-message-text").textContent = "Посилання для входу надіслано. Воно діє обмежений час."; view("message"); }
      catch (cause) { error.textContent = errorText(cause); }
    }
    if (event.target.closest('[data-action="logout"]')) { event.preventDefault();if(window.WarrioAuth.getSession()){await window.WarrioAuth.signOut();location.reload()}else{gate.hidden=false;view("login")} }
  });

  (async () => {
    if (!window.WarrioAuth?.configured()) { view("login"); document.querySelector("#login-error").textContent = "Supabase Auth ще не налаштовано."; return; }
    if (sessionStorage.getItem("warrio.demo.enabled") === "1") { enterDemoMode(); return; }
    try { const session = await window.WarrioAuth.initialize(); if (session?.recovery) view("reset"); else if (session) await enterLiveMode(); else view("login"); }
    catch { view("login"); document.querySelector("#login-error").textContent = "Не вдалося відновити сесію. Увійдіть ще раз."; }
  })();

  window.WarrioSession = Object.freeze({ getContext: () => currentContext, enterLiveMode, enterDemoMode, showLogin:()=>{gate.hidden=false;view("login")} });
})();
