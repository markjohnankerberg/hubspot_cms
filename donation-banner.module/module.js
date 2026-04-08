(function () {
  var bar = document.getElementById('announcement-bar');
  if (!bar) return;

  var apiUrl = 'https://fundraiser-data-stream-ee995d78ca1d.herokuapp.com';
  var showSkus = bar.getAttribute('data-show-skus') === 'true';

  var totalEl  = document.getElementById('donation-total');
  var treesEl  = document.getElementById('trees-planted');

  var currentTotal = null;
  var sseSource = null;
  var reconnectDelay = 5000;

  function bump() {
    if (!totalEl) return;
    totalEl.classList.remove('announcement-bar__total--bump');
    // Force reflow so the class removal registers before re-adding
    void totalEl.offsetWidth;
    totalEl.classList.add('announcement-bar__total--bump');
    setTimeout(function () {
      totalEl.classList.remove('announcement-bar__total--bump');
    }, 300);
  }

  function update(data) {
    if (!data || typeof data.total_dollars === 'undefined') return;

    if (totalEl) {
      var isIncrement = currentTotal !== null && data.total_dollars > currentTotal;
      totalEl.textContent = data.total_dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
      if (isIncrement) bump();
    }

    currentTotal = data.total_dollars;

    if (treesEl && typeof data.total !== 'undefined') {
      treesEl.textContent = data.total.toLocaleString();
    }

    if (data.skus) {
      var skuBreakdownEl = document.getElementById('sku-breakdown');
      if (skuBreakdownEl) {
        var SKU_ICON_MAP = {
          'FR16-30':   'https://dl.dropboxusercontent.com/scl/fi/840angbujoiw8wgw14lbw/MicroSD-Card-600x600.png?rlkey=ac7qpw4smq8pyubg07snhnyls&raw=1',
          'FR16-100':  'https://dl.dropboxusercontent.com/scl/fi/fncc17ae3dzdjzx468wze/Audio-Bible-Micro-Proclaimer-600x600.png?rlkey=x1s5c5icvgarfqbajubk6rgg6&raw=1',
          'FR16-500':  'https://dl.dropboxusercontent.com/scl/fi/1dx2i0aw3kmzwh4uvvbxx/Proclaimer-600x600.png?rlkey=f359uj1dbsr86sdacmecm6gnt&raw=1',
          'FR16-1000': 'https://dl.dropboxusercontent.com/scl/fi/uowkz7ngxjkhg84xf27wm/Audio-Bible-Bundle-600x600.png?rlkey=ynpwop1ao29mfti83x9p3l4wi&raw=1',
          'FR16030':   'https://dl.dropboxusercontent.com/scl/fi/840angbujoiw8wgw14lbw/MicroSD-Card-600x600.png?rlkey=ac7qpw4smq8pyubg07snhnyls&raw=1',
          'FR16100':   'https://dl.dropboxusercontent.com/scl/fi/fncc17ae3dzdjzx468wze/Audio-Bible-Micro-Proclaimer-600x600.png?rlkey=x1s5c5icvgarfqbajubk6rgg6&raw=1',
          'FR16500':   'https://dl.dropboxusercontent.com/scl/fi/1dx2i0aw3kmzwh4uvvbxx/Proclaimer-600x600.png?rlkey=f359uj1dbsr86sdacmecm6gnt&raw=1',
          'FR161000':  'https://www.dropbox.com/scl/fi/idj56wp0u6jsy2zbz1xnd/Proclaimer-Bundle-600x600-no-shadow.png?rlkey=1ppzlnhpjemkr7kcobv346zzt&st=v0mo61k9&dl=0'
        };
        function getSkuBase(sku) {
          var m = sku.match(/FR16-(\d+)/i);
          return m ? parseInt(m[1], 10) : 9999;
        }
        var sortedSkus = Object.keys(data.skus).filter(function (sku) {
          return sku.toUpperCase().trim() !== 'FR16-C';
        }).sort(function (a, b) {
          return getSkuBase(a) - getSkuBase(b);
        });
        skuBreakdownEl.innerHTML = sortedSkus.map(function (sku) {
          var m = sku.match(/FR16-(\d+)/i);
          var baseKey = m ? 'FR16-' + m[1] : sku.toUpperCase();
          var iconUrl = SKU_ICON_MAP[baseKey.toUpperCase()];
          var icon = iconUrl ? '<img class="announcement-bar__sku-icon" src="' + iconUrl + '" alt="' + sku + '" />' : '';
          var count = data.skus[sku] != null ? data.skus[sku].toLocaleString() : '—';
          return '<span class="announcement-bar__stat announcement-bar__skus">' + icon + '<strong>' + count + '</strong></span>';
        }).join('');
      }
    }
  }

  function fetchInitial() {
    fetch(apiUrl + '/donations/counts')
      .then(function (res) { return res.json(); })
      .then(update)
      .catch(function (err) {
        console.warn('[donation-banner] Failed to fetch initial counts:', err);
      });
  }

  function openStream() {
    if (sseSource) sseSource.close();

    sseSource = new EventSource(apiUrl + '/donations/stream');

    sseSource.onmessage = function (event) {
      try {
        update(JSON.parse(event.data));
      } catch (e) {
        console.warn('[donation-banner] Failed to parse SSE data:', e);
      }
    };

    sseSource.onerror = function () {
      sseSource.close();
      sseSource = null;
      setTimeout(openStream, reconnectDelay);
    };
  }

  var closeBtn = bar.querySelector('.announcement-bar__close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      var bannerHeight = bar.offsetHeight;
      bar.classList.add('announcement-bar--hidden');
      if (sseSource) sseSource.close();

      // Walk up the DOM hiding ancestor wrappers HubSpot adds around the module
      // until we reach a node that contains other content (siblings present)
      var el = bar;
      while (el.parentElement && el.parentElement !== document.body) {
        el = el.parentElement;
        if (el.children.length > 1) break;
        el.style.display = 'none';
      }

      // Remove whatever top spacing the page template added for the fixed banner
      var bodyPadding = parseInt(window.getComputedStyle(document.body).paddingTop, 10) || 0;
      if (bodyPadding >= bannerHeight) {
        document.body.style.paddingTop = (bodyPadding - bannerHeight) + 'px';
      }
      var bodyMargin = parseInt(window.getComputedStyle(document.body).marginTop, 10) || 0;
      if (bodyMargin >= bannerHeight) {
        document.body.style.marginTop = (bodyMargin - bannerHeight) + 'px';
      }
    });
  }

  fetchInitial();
  openStream();
})();
