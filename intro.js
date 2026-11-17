/* First-ever visit splash: runs once per browser, never on reloads. */
(function () {
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
    setTimeout(function () {
      el.classList.add("out");
      setTimeout(function () { el.remove(); root.classList.remove("intro"); }, 800);
    }, 2600);
  });
})();
