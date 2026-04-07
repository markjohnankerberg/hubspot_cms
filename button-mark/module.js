document.querySelectorAll('.dropdown').forEach(function (dropdown) {
  var toggle = dropdown.querySelector('.dropdown-toggle');
  var menu = dropdown.querySelector('.dropdown-menu');

  toggle.addEventListener('click', function () {
    var isOpen = menu.classList.contains('is-open');
    menu.classList.toggle('is-open', !isOpen);
    toggle.setAttribute('aria-expanded', String(!isOpen));
  });

  document.addEventListener('click', function (e) {
    if (!dropdown.contains(e.target)) {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
});
