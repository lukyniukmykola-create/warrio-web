(() => {
  "use strict";
  const message = document.querySelector("#message");
  const content = document.querySelector("#content");
  const date = value => value ? new Date(value).toLocaleDateString("uk-UA") : "—";

  function cell(row, text) {
    const td = document.createElement("td");
    td.textContent = text;
    row.append(td);
    return td;
  }

  function render(rows) {
    const body = document.querySelector("#rows");
    body.textContent = "";
    const sum = key => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
    document.querySelector("#total-orgs").textContent = String(rows.length);
    document.querySelector("#total-sales").textContent = String(sum("sales"));
    document.querySelector("#total-warranties").textContent = String(sum("warranties"));
    document.querySelector("#total-service").textContent = String(sum("open_service_requests"));
    for (const item of rows) {
      const tr = document.createElement("tr");
      const name = cell(tr, item.name);
      const slug = document.createElement("small");
      slug.style.cssText = "display:block;color:#68738c";
      slug.textContent = item.slug;
      name.append(slug);
      cell(tr, date(item.created_at));
      cell(tr, item.max_members ? `${item.members} / ${item.max_members}` : String(item.members));
      cell(tr, item.max_dealers !== undefined ? `${item.dealers} / ${item.max_dealers}` : String(item.dealers));
      cell(tr, String(item.sales));
      cell(tr, String(item.warranties));
      cell(tr, String(item.open_service_requests));
      cell(tr, date(item.last_activity));
      body.append(tr);
    }
    content.hidden = false;
    message.textContent = rows.length ? "" : "Компаній ще немає.";
  }

  async function start() {
    try {
      await window.WarrioAuth.initialize();
      if (!window.WarrioAuth.getSession()) {
        message.textContent = "Спершу увійдіть у кабінет Warrio, потім відкрийте цю сторінку знову.";
        return;
      }
      render(await window.WarrioData.rpc("get_warrio_platform_overview"));
    } catch (error) {
      message.textContent = String(error?.message || "").includes("permission_denied")
        ? "Немає доступу: ця сторінка лише для адміністраторів платформи."
        : "Не вдалося завантажити дані. Спробуйте пізніше.";
    }
  }
  start();
})();
