/* ===== ATRI Search results ===== */
(function () {
  "use strict";

  var GRAD = {
    woocommerce: "linear-gradient(135deg,#7a5418,#3a280c)",
    hubspot: "linear-gradient(135deg,#1f4a45,#0e2421)",
    _default: "linear-gradient(135deg,#444,#222)"
  };
  var TYPE_ICON = {
    woocommerce: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M6 7h12l1 13H5L6 7z"/><path d="M9 7a3 3 0 016 0"/></svg>',
    hubspot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M12 6c-2-1.5-5-1.5-7-1v12c2-.5 5-.5 7 1 2-1.5 5-1.5 7-1V5c-2-.5-5-.5-7 1z"/><path d="M12 6v13"/></svg>'
  };
  var FILTERS = [
    { label: "All", source: "" },
    { label: "Articles", source: "hubspot" },
    { label: "Store", source: "woocommerce" }
  ];

  // Fallback sample data (shaped exactly like the API response items)
  var SAMPLE = [
    { id: 1, source: "hubspot", source_id: "a1", title: "Bible Study Made Easy: The Surprising Benefits of the Inductive Method", body: "Inductive study trains you to observe the text before you interpret it, so meaning rises out of Scripture itself.", url: "#", image_url: "", metadata: { author_name: "John Ankerberg", publish_date: "2026-04-02T12:00:00Z" } },
    { id: 2, source: "hubspot", source_id: "a2", title: "Prophetic Messages from the Bible — Truth and Reliability Revealed", body: "A look at fulfilled prophecy as evidence for the reliability of Scripture.", url: "#", image_url: "", metadata: { author_name: "ATRI Staff", publish_date: "2026-03-18T12:00:00Z" } },
    { id: 3, source: "hubspot", source_id: "a3", title: "Living the Ordinary to Make the Bible Extraordinary for Our Kids", body: "Practical rhythms for bringing Scripture into everyday family life.", url: "#", image_url: "", metadata: { author_name: "ATRI Staff", publish_date: "2026-03-05T12:00:00Z" } },
    { id: 4, source: "woocommerce", source_id: "p1", title: "How to Study the Bible (Paperback)", body: "A practical, step-by-step guide to reading and understanding Scripture.", url: "#", image_url: "", metadata: { price: "14.99", regular_price: "21.99", sale_price: "14.99", categories: ["Books", "Bible Study"] } },
    { id: 5, source: "woocommerce", source_id: "p2", title: "Audio Bible — Community Edition", body: "Boxed audio Bible designed for sharing with communities.", url: "#", image_url: "", metadata: { price: "24.99", regular_price: "24.99", sale_price: "", categories: ["Audio"] } },
    { id: 6, source: "hubspot", source_id: "a4", title: "Why the Bible Still Matters in a Skeptical Age", body: "Responding to common objections with clarity and grace.", url: "#", image_url: "", metadata: { author_name: "John Ankerberg", publish_date: "2026-02-20T12:00:00Z" } }
  ];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function stripTags(htmlStr) {
    var d = document.createElement("div");
    d.innerHTML = htmlStr || "";
    return (d.textContent || d.innerText || "").trim();
  }
  function truncate(s, n) {
    s = s || "";
    return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "").trim() + "…" : s;
  }
  function formatDate(s) {
    if (!s) return "";
    var d = new Date(s);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function init(root) {
    if (root.__atriSrInit) return;
    root.__atriSrInit = true;

    var apiBase = (root.getAttribute("data-api-base") || "").replace(/\/+$/, "");
    var perPage = parseInt(root.getAttribute("data-per-page"), 10) || 12;
    var currency = root.getAttribute("data-currency") || "$";
    var showFilters = root.getAttribute("data-show-filters") === "true";
    var allowFallback = root.getAttribute("data-fallback") === "true";

    var headEl = root.querySelector("[data-sr-head]");
    var filtersEl = root.querySelector("[data-sr-filters]");
    var gridEl = root.querySelector("[data-sr-grid]");
    var pagerEl = root.querySelector("[data-sr-pager]");

    function getState() {
      var p = new URLSearchParams(window.location.search);
      return { q: p.get("q") || "", source: p.get("source") || "", page: parseInt(p.get("page"), 10) || 1 };
    }
    function pushState(st) {
      var p = new URLSearchParams(window.location.search);
      st.q ? p.set("q", st.q) : p.delete("q");
      st.source ? p.set("source", st.source) : p.delete("source");
      (st.page && st.page > 1) ? p.set("page", st.page) : p.delete("page");
      var qs = p.toString();
      history.pushState({}, "", window.location.pathname + (qs ? "?" + qs : ""));
    }

    function renderFilters(active) {
      if (!showFilters) { filtersEl.innerHTML = ""; return; }
      filtersEl.innerHTML = FILTERS.map(function (f) {
        var on = f.source === active;
        return '<button type="button" role="tab" aria-selected="' + on + '" class="atri-sr-pill' + (on ? " is-active" : "") +
          '" data-source="' + f.source + '">' + f.label + "</button>";
      }).join("");
    }

    function cardHTML(r) {
      var src = r.source;
      var meta = r.metadata || {};
      var thumbInner = r.image_url
        ? '<img class="atri-sr-img" src="' + esc(r.image_url) + '" alt="" loading="lazy">'
        : '<span class="atri-sr-ghost">' + (TYPE_ICON[src] || "") + "</span>";
      var chip = src === "woocommerce" ? "Store" : (src === "hubspot" ? "Article" : esc(src));

      var badge = "", price = "";
      if (src === "woocommerce") {
        var sale = meta.sale_price && parseFloat(meta.sale_price) > 0 &&
                   parseFloat(meta.sale_price) < parseFloat(meta.regular_price || "0");
        if (sale) {
          badge = '<span class="atri-sr-badge">Sale</span>';
          price = '<div class="atri-sr-price">' + currency + esc(meta.price) +
                  "<s>" + currency + esc(meta.regular_price) + "</s></div>";
        } else if (meta.price) {
          price = '<div class="atri-sr-price">' + currency + esc(meta.price) + "</div>";
        }
      }

      var kicker = "";
      if (src === "hubspot") {
        kicker = [meta.author_name, formatDate(meta.publish_date)].filter(Boolean).join(" · ");
      } else if (src === "woocommerce") {
        kicker = (meta.categories || []).slice(0, 2).join(" · ");
      }

      var excerpt = "";
      if (src === "hubspot") {
        excerpt = '<p class="atri-sr-excerpt">' + esc(truncate(stripTags(r.body), 120)) + "</p>";
      }

      var href = esc(r.url || "#");
      return '<article class="atri-sr-card">' +
        '<a class="atri-sr-thumb" href="' + href + '" style="--g:' + (GRAD[src] || GRAD._default) + '">' +
        '<span class="atri-sr-chip">' + chip + "</span>" + badge + thumbInner + "</a>" +
        '<div class="atri-sr-cbody">' +
        (kicker ? '<span class="atri-sr-kicker">' + esc(kicker) + "</span>" : "") +
        '<h3 class="atri-sr-title"><a href="' + href + '">' + esc(r.title) + "</a></h3>" +
        excerpt + price + "</div></article>";
    }

    function pageWindow(cur, pages) {
      var range = [], out = [], last = 0;
      for (var i = 1; i <= pages; i++) {
        if (i === 1 || i === pages || (i >= cur - 1 && i <= cur + 1)) range.push(i);
      }
      range.forEach(function (i) {
        if (i - last > 1) out.push("…");
        out.push(i);
        last = i;
      });
      return out;
    }
    function renderPager(total, st) {
      var pages = Math.max(1, Math.ceil((total || 0) / perPage));
      if (pages <= 1) { pagerEl.innerHTML = ""; return; }
      var cur = st.page;
      var html = '<button class="atri-sr-pg" data-page="' + (cur - 1) + '" aria-label="Previous"' + (cur <= 1 ? " disabled" : "") + ">‹</button>";
      pageWindow(cur, pages).forEach(function (n) {
        html += n === "…"
          ? '<span class="atri-sr-gap">…</span>'
          : '<button class="atri-sr-pg' + (n === cur ? " is-active" : "") + '" data-page="' + n + '">' + n + "</button>";
      });
      html += '<button class="atri-sr-pg" data-page="' + (cur + 1) + '" aria-label="Next"' + (cur >= pages ? " disabled" : "") + ">›</button>";
      pagerEl.innerHTML = html;
    }

    function renderResults(data, st, isSample) {
      var total = typeof data.total === "number" ? data.total : (data.results || []).length;
      var results = data.results || [];
      var notice = isSample ? '<div class="atri-sr-notice">Showing sample data — the Search API was unreachable.</div>' : "";
      var forQ = st.q ? ' for <span class="atri-sr-q">“' + esc(st.q) + "”</span>" : "";

      if (!results.length) {
        headEl.innerHTML = notice + '<p class="atri-sr-count">No results' + forQ + "</p>";
        gridEl.innerHTML = '<div class="atri-sr-empty"><h3>Nothing found</h3><p>Try a different keyword or browse the menu above.</p></div>';
        pagerEl.innerHTML = "";
        return;
      }
      var start = (st.page - 1) * perPage + 1;
      var end = Math.min(st.page * perPage, total);
      headEl.innerHTML = notice +
        '<p class="atri-sr-count">Showing <strong>' + start + "–" + end + "</strong> of <strong>" + total + "</strong> results" + forQ + "</p>";
      gridEl.innerHTML = results.map(cardHTML).join("");
      renderPager(total, st);
    }

    function skeleton() {
      var s = "";
      for (var i = 0; i < perPage; i++) s += '<div class="atri-sr-skel"></div>';
      return s;
    }

    function sampleResponse(st) {
      var filtered = SAMPLE.filter(function (r) {
        var srcOk = !st.source || r.source === st.source;
        var qOk = !st.q || (r.title + " " + r.body).toLowerCase().indexOf(st.q.toLowerCase()) >= 0;
        return srcOk && qOk;
      });
      return {
        results: filtered.slice((st.page - 1) * perPage, st.page * perPage),
        total: filtered.length, page: st.page, per_page: perPage
      };
    }

    function load() {
      var st = getState();
      renderFilters(st.source);
      headEl.innerHTML = '<p class="atri-sr-count atri-sr-muted">Searching…</p>';
      gridEl.innerHTML = skeleton();
      pagerEl.innerHTML = "";

      if (!apiBase) { renderResults(sampleResponse(st), st, true); return; }

      var qs = new URLSearchParams({ q: st.q, source: st.source, page: st.page, per_page: perPage }).toString();
      fetch(apiBase + "/api/search/?" + qs, { headers: { Accept: "application/json" } })
        .then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
        .then(function (data) { renderResults(data, st, false); })
        .catch(function (err) {
          if (allowFallback) { renderResults(sampleResponse(st), st, true); return; }
          headEl.innerHTML = "";
          gridEl.innerHTML = '<div class="atri-sr-empty"><h3>Something went wrong</h3><p>' + esc(err.message) + "</p></div>";
          pagerEl.innerHTML = "";
        });
    }

    function scrollToTop() {
      var top = root.getBoundingClientRect().top + window.pageYOffset - 20;
      window.scrollTo({ top: top, behavior: "smooth" });
    }

    filtersEl.addEventListener("click", function (e) {
      var b = e.target.closest(".atri-sr-pill");
      if (!b) return;
      var st = getState();
      st.source = b.getAttribute("data-source");
      st.page = 1;
      pushState(st);
      load();
      scrollToTop();
    });
    pagerEl.addEventListener("click", function (e) {
      var b = e.target.closest(".atri-sr-pg");
      if (!b || b.disabled) return;
      var st = getState();
      st.page = parseInt(b.getAttribute("data-page"), 10) || 1;
      pushState(st);
      load();
      scrollToTop();
    });
    window.addEventListener("popstate", load);

    load();
  }

  function boot() {
    Array.prototype.forEach.call(document.querySelectorAll(".atri-sr"), init);
  }
  if (document.readyState !== "loading") boot();
  else document.addEventListener("DOMContentLoaded", boot);
})();
