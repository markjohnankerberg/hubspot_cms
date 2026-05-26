/* ATRI Header — Search panel open/close */

(function () {
  var panel = document.getElementById('atriSearchPanel');
  var backdrop = document.getElementById('atriBackdrop');
  var openBtn = document.getElementById('atriSearchOpen');
  var closeBtn = document.getElementById('atriSearchClose');
  var form = document.getElementById('atriSearchForm');
  var input = form ? form.querySelector('input[name="q"]') : null;

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
})();
