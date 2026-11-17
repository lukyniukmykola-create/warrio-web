// Warrio interface language switcher (Ukrainian <-> English).
// Exact-text dictionary applied to the DOM; unknown strings (data, free text) stay as they are.
(() => {
  "use strict";
  const EN = {
    "Огляд": "Overview", "Продажі": "Sales", "Гарантії": "Warranties", "Дилери": "Dealers", "Монтажі": "Installations",
    "Клієнти": "Customers", "Завдання": "Tasks", "Сервіс": "Service", "Склад": "Warehouse", "Звіти": "Reports",
    "Документи": "Documents", "Команда": "Team", "Налаштування": "Settings", "Допомога": "Help", "МЕНЮ": "MENU", "ЗАГАЛЬНЕ": "GENERAL",
    "Активація гарантії": "Warranty activation", "CRM-завдання та журнал": "CRM tasks and log", "Звіти й аналітика": "Reports and analytics",
    "Команда та доступ": "Team and access", "Сервісні звернення": "Service requests",
    "Контроль гарантій, продажів і монтажів Warrio в одному місці.": "Warranties, sales and installations in one place.",
    "Реєстрація обладнання дилерами та контроль активації.": "Equipment registration by dealers and activation control.",
    "Повний життєвий цикл гарантії від продажу до монтажу.": "The full warranty lifecycle from sale to installation.",
    "Перевірте продаж, внесіть дані покупця та створіть сертифікат.": "Check the sale, enter the buyer's details and create the certificate.",
    "Партнерська мережа, активність та якість реєстрацій.": "Partner network, activity and registration quality.",
    "Планування, призначення монтажників та підтвердження робіт.": "Scheduling, assigning installers and confirming work.",
    "Контроль наступних дій, прострочень і операцій команди.": "Follow-ups, overdue items and team operations.",
    "Динаміка продажів, гарантій, моделей та партнерів.": "Trends in sales, warranties, models and partners.",
    "Хто керує Warrio і які розділи доступні кожній ролі.": "Who manages Warrio and which sections each role can open.",
    "Робочий профіль компанії та гарантійні правила.": "Company profile and warranty rules.",
    "Прийом товару за серійними номерами, наявність і повна історія кожного виробу.": "Receive goods by serial number, see stock and the full history of every item.",
    "Гарантійні й післягарантійні звернення по проданому обладнанню.": "Warranty and post-warranty requests for sold equipment.",
    "↻ Синхронізувати": "↻ Sync", "＋ Зареєструвати продаж": "＋ Register a sale", "＋ Новий продаж": "＋ New sale", "＋ Додати дилера": "＋ Add dealer",
    "＋ Запланувати": "＋ Schedule", "＋ Нове завдання": "＋ New task", "＋ Запросити користувача": "＋ Invite user", "＋ Модель": "＋ Model",
    "⇩ Експорт": "⇩ Export", "⇩ Експорт CSV": "⇩ Export CSV", "⇩ Завантажити звіт": "⇩ Download report", "⇩ CSV": "⇩ CSV",
    "✓ Підтвердити монтаж": "✓ Confirm installation", "← До гарантій": "← Back to warranties",
    "Переглянути все": "View all", "Усі дилери": "All dealers", "Зберегти": "Save", "Зберегти зміни": "Save changes", "Закрити": "Close",
    "Швидкі дії": "Quick actions", "Останні події": "Recent events", "Потребує уваги": "Needs attention", "Найкращі дилери": "Top dealers",
    "Журнал подій": "Event log", "Пошук у журналі": "Search the log", "Ефективність дилерів": "Dealer performance",
    "Активні гарантії": "Active warranties", "Очікують покупця": "Awaiting buyer", "Очікує покупця": "Awaiting buyer", "Очікують активації": "Awaiting activation",
    "Монтаж підтверджено": "Installation confirmed", "Продано обладнання": "Equipment sold", "Відкриті завдання": "Open tasks",
    "Прострочені": "Overdue", "Термінові": "Urgent", "Високі": "High", "Звичайні": "Normal", "Відкриті": "Open", "Виконані": "Done",
    "Усі": "All", "Усі статуси": "All statuses", "Усі пріоритети": "All priorities", "Статус": "Status", "Статуси гарантій": "Warranty statuses",
    "Серійний номер": "Serial number", "Модель": "Model", "Дилер": "Dealer", "Дата продажу": "Sale date", "Гарантія": "Warranty", "Клієнт": "Customer",
    "Телефон": "Phone", "Місто": "City", "Обладнання": "Equipment", "Тип": "Type", "Пріоритет": "Priority", "Термін": "Due", "Час": "Time",
    "Подія": "Event", "Сутність": "Entity", "Деталі": "Details", "Звернення": "Request", "Рішення": "Resolution", "Монтаж": "Installation",
    "Активація": "Activation", "Прийнято": "Received", "Дилер / гарантія": "Dealer / warranty", "Опис": "Description", "Адреса": "Address",
    "Назва компанії": "Company name", "Email підтримки": "Support email", "Пароль": "Password", "Новий пароль": "New password",
    "Повторіть пароль": "Repeat password", "Забули пароль?": "Forgot your password?", "Увійти": "Sign in", "Увійти до Warrio": "Sign in to Warrio",
    "Вхід до Warrio": "Sign in to Warrio", "Створити акаунт": "Create account", "Створення акаунта": "Create account", "Вийти з акаунта": "Sign out",
    "Створити робочий простір": "Create workspace", "Створіть організацію": "Create your organization", "Перевірте пошту": "Check your email",
    "Підтвердьте email": "Confirm your email", "Повернутися до входу": "Back to sign in", "← Повернутися до входу": "← Back to sign in",
    "Зберегти новий пароль": "Save new password", "Пароль змінено": "Password changed", "Ваш пароль": "Your password",
    "Ім’я та прізвище": "Full name", "Назва вашої компанії": "Your company name", "Коротка адреса": "Short address",
    "Неправильний email або пароль.": "Wrong email or password.", "Паролі не збігаються.": "Passwords do not match.",
    "Такий email уже зареєстрований.": "This email is already registered.", "Забагато спроб. Спробуйте трохи пізніше.": "Too many attempts. Try again later.",
    "Спочатку введіть email.": "Enter your email first.", "Зачекайте…": "Please wait…",
    "Власник": "Owner", "Адміністратор": "Administrator", "Монтажник": "Installer", "Сервісний менеджер": "Service manager", "Користувач": "User",
    "Власник · Warrio": "Owner · Warrio", "Мій профіль і команда": "My profile and team", "Налаштування компанії": "Company settings",
    "Моделі обладнання": "Equipment models", "Профіль компанії": "Company profile", "Гарантійні правила": "Warranty rules",
    "Початок гарантії": "Warranty start", "Підтвердження монтажу": "Installation confirmation", "Умови гарантії": "Warranty terms",
    "Обов’язкове": "Required", "Не вимагається": "Not required", "Дата активації": "Activation date", "Дата монтажу": "Installation date",
    "Сповіщення": "Notifications", "Інтеграції": "Integrations", "Автоматизація": "Automation", "Підключено": "Connected", "Працює": "Working",
    "Заплановано": "Planned", "Підтверджено": "Confirmed", "Очікують призначення": "Awaiting assignment",
    "Потрібна допомога?": "Need help?", "Поширені питання": "FAQ", "Швидка діагностика": "Quick diagnostics", "База даних": "Database",
    "Перевірка продажу": "Sale check", "Дані покупця": "Buyer details", "Активувати гарантію": "Activate warranty", "Процес активації": "Activation process",
    "Перевірити SN": "Check SN", "Перевірити код": "Check code", "Продаж знайдено": "Sale found", "Готово": "Done", "Історія гарантії": "Warranty history",
    "Гарантію підтверджено": "Warranty confirmed", "Номер гарантії": "Warranty number", "Статус гарантії": "Warranty status", "Модель обладнання": "Equipment model",
    "Перевірка гарантії": "Warranty check", "Активно": "Active", "Активна": "Active", "Призупинена": "Suspended",
    "Прийняти товар": "Receive goods", "Прийняти на склад": "Receive into stock", "Пошук серійного номера": "Search serial number",
    "Примітка (накладна, партія)": "Note (invoice, batch)", "Або завантажте CSV / TXT файл": "Or upload a CSV / TXT file",
    "Серійні номери: по одному в рядку або через кому. Можна вставити з Excel.": "Serial numbers: one per line or comma-separated. You can paste from Excel.",
    "На складі": "In stock", "Продано": "Sold", "У сервісі": "In service", "Списано": "Written off", "Списати": "Write off", "Історія": "History",
    "Нічого не знайдено": "Nothing found", "Подій ще немає.": "No events yet.", "Прийнято на склад": "Received into stock", "Видано гарантію": "Warranty issued",
    "Відкрито звернення": "Request opened", "Звернення закрито": "Request closed", "Продаж зареєстровано": "Sale registered", "Гарантію активовано": "Warranty activated",
    "Нове звернення": "New request", "Створити звернення": "Create request", "Коротко про проблему": "Short description of the problem",
    "Гарантія (серійний номер)": "Warranty (serial number)", "Звернень ще немає": "No requests yet", "Гарантійний випадок": "Warranty case", "Поза гарантією": "Out of warranty",
    "Нове": "New", "У роботі": "In progress", "Чекаємо запчастини": "Waiting for parts", "Вирішено": "Resolved", "Відхилено": "Rejected",
    "Збережено.": "Saved.", "Звернення створено.": "Request created.", "Виріб списано.": "Item written off.",
    "Увімкнути роль «Сервісний менеджер»": "Enable the “Service manager” role",
    "У вашої ролі немає доступу до цієї дії.": "Your role has no access to this action.", "У вашої ролі немає доступу до складу.": "Your role has no access to the warehouse.",
    "Не вдалося виконати дію. Спробуйте ще раз.": "The action failed. Please try again.",
    "Завантажуємо актуальні дані": "Loading the latest data", "Завантажуємо робочі записи…": "Loading records…", "Зачекайте кілька секунд…": "Please wait a few seconds…",
    "Перевіряємо вхід": "Checking sign-in", "Перевіряємо Supabase": "Checking Supabase", "Безпечно відновлюємо вашу сесію Warrio…": "Securely restoring your Warrio session…",
    "Пошук за гарантією, SN, клієнтом або дилером…": "Search by warranty, SN, customer or dealer…", "ПІБ, телефон, email або SN": "Name, phone, email or SN",
    "Номер гарантії або SN": "Warranty number or SN", "SN, модель або дилер": "SN, model or dealer", "Назва, тип або опис": "Title, type or description",
    "Warrio — гарантійна платформа": "Warrio — warranty platform", "Гарантійний сертифікат": "Warranty certificate",
    "Публічна перевірка без ПД": "Public check without personal data", "Реальні дані підключено": "Live data connected",
    "Демонстраційні дані": "Demo data", "MVP DEMO · демонстраційні дані": "MVP DEMO · demo data"
  };
  const ATTRS = ["placeholder", "title", "aria-label"];
  const texts = new WeakMap();
  const attrs = new WeakMap();
  let language = "uk";
  let observer;

  const read = () => { try { return localStorage.getItem("warrio-language"); } catch { return null; } };
  const save = value => { try { localStorage.setItem("warrio-language", value); } catch { /* storage unavailable */ } };

  function translateText(node) {
    const value = node.nodeValue;
    const key = value.trim();
    if (!key || !(key in EN)) return;
    texts.set(node, value);
    node.nodeValue = value.replace(key, EN[key]);
  }
  function translateAttrs(element) {
    for (const name of ATTRS) {
      const value = element.getAttribute?.(name);
      if (!value || !(value.trim() in EN)) continue;
      const saved = attrs.get(element) || {};
      saved[name] = value;
      attrs.set(element, saved);
      element.setAttribute(name, EN[value.trim()]);
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { translateText(root); return; }
    if (root.nodeType !== 1 || ["SCRIPT", "STYLE", "TEXTAREA"].includes(root.tagName)) return;
    translateAttrs(root);
    for (const child of root.childNodes) walk(child);
  }
  function restore(root) {
    if (root.nodeType === 3) { if (texts.has(root)) { root.nodeValue = texts.get(root); texts.delete(root); } return; }
    if (root.nodeType !== 1) return;
    const saved = attrs.get(root);
    if (saved) { for (const [name, value] of Object.entries(saved)) root.setAttribute(name, value); attrs.delete(root); }
    for (const child of root.childNodes) restore(child);
  }

  function apply(next) {
    language = next;
    save(next);
    document.documentElement.lang = next === "en" ? "en" : "uk";
    const button = document.querySelector("#lang-switch");
    if (button) button.textContent = next === "en" ? "UA" : "EN";
    observer?.disconnect();
    if (next === "en") walk(document.body); else restore(document.body);
    if (next === "en") {
      observer = new MutationObserver(mutations => {
        observer.disconnect();
        for (const mutation of mutations) {
          if (mutation.type === "characterData") translateText(mutation.target);
          for (const added of mutation.addedNodes) walk(added);
        }
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }

  function injectSwitch() {
    if (document.querySelector("#lang-switch")) return;
    const button = document.createElement("button");
    button.id = "lang-switch";
    button.type = "button";
    button.setAttribute("aria-label", "Language");
    button.style.cssText = "position:fixed;left:14px;bottom:14px;z-index:2147483000;padding:6px 12px;border-radius:999px;border:1px solid #d5d9e6;background:#fff;color:#141b2f;font:600 13px Inter,Segoe UI,Arial,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgba(20,27,47,.12)";
    button.textContent = "EN";
    button.addEventListener("click", () => apply(language === "en" ? "uk" : "en"));
    document.body.appendChild(button);
  }

  injectSwitch();
  if (read() === "en") apply("en");
  window.WarrioI18n = { apply, dictionary: EN };
})();
