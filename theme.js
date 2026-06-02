/* RoamCircle — light / dark theme toggle */
(function () {
  "use strict";

  const STORAGE_KEY = "rc_theme";

  function getPreferred() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function updateToggleUi(theme) {
    const btn = document.getElementById("rc-theme-toggle");
    if (!btn) return;
    btn.setAttribute("data-theme-state", theme);
    btn.setAttribute(
      "aria-label",
      theme === "light" ? "Switch to dark mode" : "Switch to light mode"
    );
    const label = btn.querySelector(".theme-toggle-label");
    if (label) label.textContent = theme === "light" ? "Dark" : "Light";
  }

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
    updateToggleUi(theme);
  }

  apply(getPreferred());

  window.RC_setTheme   = apply;
  window.RC_toggleTheme = function () {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    apply(cur === "light" ? "dark" : "light");
  };

  function buildToggle() {
    if (document.getElementById("rc-theme-toggle")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "rc-theme-toggle";
    btn.className = "theme-toggle";
    btn.innerHTML = `
      <span class="theme-toggle-track" aria-hidden="true">
        <span class="theme-toggle-thumb"></span>
      </span>
      <span class="theme-toggle-label">Light</span>
      <span class="theme-toggle-sr">Toggle color theme</span>`;
    btn.addEventListener("click", window.RC_toggleTheme);

    const nav = document.querySelector(".topbar .nav");
    if (nav) {
      nav.appendChild(btn);
      updateToggleUi(document.documentElement.getAttribute("data-theme") || "dark");
      return;
    }

    const topbar = document.querySelector(".topbar");
    if (topbar) {
      const wrap = document.createElement("div");
      wrap.className = "theme-toggle-wrap";
      wrap.appendChild(btn);
      topbar.appendChild(wrap);
      updateToggleUi(document.documentElement.getAttribute("data-theme") || "dark");
      return;
    }

    const authCard = document.querySelector(".auth-card");
    if (authCard) {
      btn.classList.add("theme-toggle--auth");
      authCard.insertBefore(btn, authCard.firstChild);
      updateToggleUi(document.documentElement.getAttribute("data-theme") || "dark");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildToggle);
  } else {
    buildToggle();
  }

  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", e => {
    if (!localStorage.getItem(STORAGE_KEY)) apply(e.matches ? "light" : "dark");
  });
})();
