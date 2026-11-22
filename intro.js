/* First-ever visit splash: runs once per browser, never on reloads. */
(function () {
  // Hide the app until auth-ui.js has put the sign-in / restoring cover in place (no flash of demo data).
  var html = document.documentElement;
  html.classList.add("pre-auth");
  try { if (localStorage.getItem("warrio-theme") === "dark") html.dataset.theme = "dark"; } catch (e) { /* ignore */ }
  setTimeout(function () { html.classList.remove("pre-auth"); }, 6000);
  try {
    if (localStorage.getItem("warrio-intro")) return;
    localStorage.setItem("warrio-intro", "1");
  } catch (e) { return; }
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var root = document.documentElement;
  root.classList.add("intro");
  document.addEventListener("DOMContentLoaded", function () {
    var el = document.getElementById("warrio-intro");
    if (!el) { root.classList.remove("intro"); return; }
    var closed = false;
    function close() {
      if (closed) return; closed = true;
      el.classList.add("out");
      setTimeout(function () { el.remove(); root.classList.remove("intro"); }, 1000);
    }
    el.addEventListener("click", close);
    setTimeout(close, 3300);
  });
})();
