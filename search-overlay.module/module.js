/* ===== ATRI Search overlay ===== */
(function () {
  "use strict";

  var STORAGE_KEY = "atri_recent_searches";
  var SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>';
  var X_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function init(root) {
    if (root.__atriOvInit) return;
    root.__atriOvInit = true;

    var panel = root.querySelector(".atri-ov-panel");
    var backdrop = root.querySelector("[data-atri-ov-backdrop]");
    var openBtns = root.querySelectorAll("[data-atri-ov-open]");
    var closeBtn = root.querySelector("[data-atri-ov-close]");
    var form = root.querySelector("[data-atri-ov-form]");
    var input = root.querySelector("[data-atri-ov-input]");
    var recentWrap = root.querySelector("[data-atri-ov-recent]");

    var resultsPath = root.getAttribute("data-results-path") || "/search";
    var emptyText = root.getAttribute("data-empty-recent") || "No recent searches yet. Start exploring!";

    var recent = [];
    try { recent = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { recent = []; }

    function open() {
      panel.classList.add("is-open");
      backdrop.classList.add("is-open");
      document.body.style.overflow = "hidden";
      setTimeout(function () { if (input) input.focus(); }, 350);
    }
    function close() {
      panel.classList.remove("is-open");
      backdrop.classList.remove("is-open");
      document.body.style.overflow = "";
    }

    Array.prototype.forEach.call(openBtns, function (b) { b.addEventListener("click", open); });
    if (closeBtn) closeBtn.addEventListener("click", close);
    if (backdrop) backdrop.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

    // Allow an existing header search icon to open this overlay:
    //   <a onclick="window.dispatchEvent(new CustomEvent('atri:open-search'))">
    window.addEventListener("atri:open-search", open);
    window.ATRISearchOverlay = { open: open, close: close };

    function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(recent)); } catch (e) {} }

    function go(term) { window.location.href = resultsPath + "?q=" + encodeURIComponent(term); }

    function renderRecent() {
      if (!recentWrap) return;
      if (!recent.length) {
        recentWrap.innerHTML = '<p class="atri-ov-recent-empty">' + escapeHtml(emptyText) + "</p>";
        return;
      }
      var list = document.createElement("div");
      list.className = "atri-ov-recent-list";
      recent.forEach(function (term, i) {
        var item = document.createElement("button");
        item.type = "button";
        item.className = "atri-ov-recent-item";
        item.innerHTML = SEARCH_ICON + '<span class="atri-ov-term"></span><span class="atri-ov-remove" aria-label="Remove">' + X_ICON + "</span>";
        item.querySelector(".atri-ov-term").textContent = term;
        item.addEventListener("click", function () { go(term); });
        item.querySelector(".atri-ov-remove").addEventListener("click", function (e) {
          e.stopPropagation();
          recent.splice(i, 1);
          save();
          renderRecent();
        });
        list.appendChild(item);
      });
      recentWrap.innerHTML = "";
      recentWrap.appendChild(list);
    }

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var term = (input.value || "").trim();
        if (!term) return;
        recent = [term].concat(recent.filter(function (t) { return t.toLowerCase() !== term.toLowerCase(); })).slice(0, 6);
        save();
        go(term);
      });
    }

    renderRecent();
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function boot() {
    Array.prototype.forEach.call(document.querySelectorAll(".atri-ov"), init);
  }

  if (document.readyState !== "loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
