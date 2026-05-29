/* ATRI Header — Search panel: open/close + live results from the ATRI Search API */

(function () {
  var panel = document.getElementById('atriSearchPanel');
  var backdrop = document.getElementById('atriBackdrop');
  var openBtn = document.getElementById('atriSearchOpen');
  var closeBtn = document.getElementById('atriSearchClose');
  var form = document.getElementById('atriSearchForm');
  var input = form ? form.querySelector('input[name="q"]') : null;
  var filters = document.getElementById('atriSearchFilters');
  var statusEl = document.getElementById('atriSearchStatus');
  var resultsEl = document.getElementById('atriSearchResults');
  var moreBtn = document.getElementById('atriSearchMore');

  if (!panel) return;

  // Move the panel and backdrop to <body> so that position:fixed is always
  // relative to the viewport. HubSpot column wrappers can have CSS transforms
  // applied which create a new containing block, trapping fixed children inside
  // the column instead of overlaying the full page.
  if (panel.parentNode !== document.body) document.body.appendChild(panel);
  if (backdrop && backdrop.parentNode !== document.body) document.body.appendChild(backdrop);

  // ----- Config (from HubL via data attributes) -----
  var apiBase = (panel.getAttribute('data-api-base') || '').replace(/\/+$/, '');
  var perPage = parseInt(panel.getAttribute('data-per-page'), 10) || 12;

  // ----- Search state -----
  var state = {
    query: '',
    source: '', // '' = all, 'hubspot' = articles, 'woocommerce' = store
    page: 1,
    total: 0,
    loaded: 0,
    reqId: 0 // guards against out-of-order responses
  };

  // ===== Panel open/close =====
  function openSearch() {
    panel.classList.add('open');
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(function () {
      if (input) input.focus();
    }, 350);
  }

  function closeSearch() {
    panel.classList.remove('open');
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (openBtn) openBtn.addEventListener('click', openSearch);
  if (closeBtn) closeBtn.addEventListener('click', closeSearch);
  if (backdrop) backdrop.addEventListener('click', closeSearch);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSearch();
  });

  // ===== Helpers =====
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // WooCommerce bodies may contain HTML; strip tags, then truncate plain text.
  function stripHtml(html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = String(html == null ? '' : html);
    return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function truncate(text, max) {
    if (text.length <= max) return text;
    return text.slice(0, max).replace(/\s+\S*$/, '') + '…';
  }

  function setStatus(msg, modifier) {
    statusEl.textContent = msg || '';
    statusEl.className = 'atri-header__search-status' +
      (modifier ? ' atri-header__search-status--' + modifier : '');
  }

  function formatPrice(value) {
    var n = Number(value);
    if (!isFinite(n)) return '';
    return '$' + n.toFixed(2);
  }

  // ===== Card renderers =====
  function productMeta(m) {
    var parts = [];
    var onSale = m.sale_price && Number(m.sale_price) < Number(m.regular_price);
    if (onSale) {
      parts.push('<span class="atri-result__price">' + escapeHtml(formatPrice(m.price)) + '</span>');
      parts.push('<span class="atri-result__price-was">' + escapeHtml(formatPrice(m.regular_price)) + '</span>');
      parts.push('<span class="atri-result__badge">Sale</span>');
    } else if (m.price) {
      parts.push('<span class="atri-result__price">' + escapeHtml(formatPrice(m.price)) + '</span>');
    }
    return parts.length ? '<div class="atri-result__meta">' + parts.join('') + '</div>' : '';
  }

  function articleMeta(m) {
    var parts = [];
    if (m.author_name) parts.push(escapeHtml(m.author_name));
    if (m.publish_date) {
      var d = new Date(m.publish_date);
      if (!isNaN(d)) {
        parts.push(d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }));
      }
    }
    return parts.length ? '<div class="atri-result__meta">' + parts.join(' · ') + '</div>' : '';
  }

  function renderResult(item) {
    var m = item.metadata || {};
    var isProduct = item.source === 'woocommerce';
    var label = isProduct ? 'Store' : 'Article';
    var body = truncate(stripHtml(item.body), 140);

    var thumb = item.image_url
      ? '<span class="atri-result__thumb" style="background-image:url(' + encodeURI(item.image_url) + ')"></span>'
      : '<span class="atri-result__thumb atri-result__thumb--placeholder"></span>';

    var meta = isProduct ? productMeta(m) : articleMeta(m);
    var href = item.url || '#';

    return '' +
      '<li class="atri-result atri-result--' + escapeHtml(item.source) + '">' +
        '<a class="atri-result__link" href="' + escapeHtml(href) + '">' +
          thumb +
          '<span class="atri-result__content">' +
            '<span class="atri-result__kind">' + escapeHtml(label) + '</span>' +
            '<span class="atri-result__title">' + escapeHtml(item.title) + '</span>' +
            (body ? '<span class="atri-result__excerpt">' + escapeHtml(body) + '</span>' : '') +
            meta +
          '</span>' +
        '</a>' +
      '</li>';
  }

  // ===== API call =====
  function buildUrl() {
    var params = new URLSearchParams();
    params.set('q', state.query);
    if (state.source) params.set('source', state.source);
    params.set('page', String(state.page));
    params.set('per_page', String(perPage));
    return apiBase + '/api/search/?' + params.toString();
  }

  function runSearch(append) {
    if (!apiBase) {
      setStatus('Search is not configured yet.', 'error');
      return;
    }

    var myReqId = ++state.reqId;
    if (!append) {
      state.page = 1;
      state.loaded = 0;
      resultsEl.innerHTML = '';
      moreBtn.style.display = 'none';
    }
    setStatus(append ? 'Loading more…' : 'Searching…', 'loading');

    fetch(buildUrl(), { headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        // Ignore responses superseded by a newer request.
        if (myReqId !== state.reqId) return;

        state.total = data.total || 0;
        var items = data.results || [];
        state.loaded += items.length;

        var html = items.map(renderResult).join('');
        resultsEl.insertAdjacentHTML('beforeend', html);

        if (state.loaded === 0) {
          setStatus(state.query ? 'No results for “' + state.query + '”.' : 'No results found.', 'empty');
        } else {
          setStatus(state.total + ' result' + (state.total === 1 ? '' : 's') + '.', 'done');
        }

        moreBtn.style.display = state.loaded >= state.total ? 'none' : '';
      })
      .catch(function () {
        if (myReqId !== state.reqId) return;
        setStatus('Something went wrong. Please try again.', 'error');
        moreBtn.style.display = 'none';
      });
  }

  // ===== Wiring =====
  var debounceTimer;
  function debouncedSearch() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      state.query = input ? input.value.trim() : '';
      runSearch(false);
    }, 300);
  }

  if (input) input.addEventListener('input', debouncedSearch);

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearTimeout(debounceTimer);
      state.query = input ? input.value.trim() : '';
      runSearch(false);
    });
  }

  if (filters) {
    filters.addEventListener('click', function (e) {
      var pill = e.target.closest('.atri-header__filter-pill');
      if (!pill) return;
      var pills = filters.querySelectorAll('.atri-header__filter-pill');
      for (var i = 0; i < pills.length; i++) {
        pills[i].classList.remove('is-active');
        pills[i].setAttribute('aria-selected', 'false');
      }
      pill.classList.add('is-active');
      pill.setAttribute('aria-selected', 'true');
      state.source = pill.getAttribute('data-source') || '';
      runSearch(false);
    });
  }

  if (moreBtn) {
    moreBtn.addEventListener('click', function () {
      state.page += 1;
      runSearch(true);
    });
  }
})();
