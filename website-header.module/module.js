// Website header variables

const menuParentItems = document.querySelectorAll(
  '.header__menu--desktop .header__menu-item--has-submenu'
);
const openToggle = document.querySelectorAll('.header__menu-toggle--open');
const closeToggle = document.querySelectorAll('.header__menu-toggle--close');
const mobileChildToggle = document.querySelectorAll(
  '.header__menu--mobile .header__menu-child-toggle'
);
const langToggle = document.querySelectorAll(
  '.header__language-switcher-child-toggle'
);

// Helpers
function closeSubmenu(node) {
  node.classList.remove('header__menu-item--open');
  node.querySelector('a').setAttribute('aria-expanded', 'false');
  node.querySelector('button').setAttribute('aria-expanded', 'false');
}

function openSubmenu(node) {
  node.classList.add('header__menu-item--open');
  node.querySelector('a').setAttribute('aria-expanded', 'true');
  node.querySelector('button').setAttribute('aria-expanded', 'true');
}

function resetMobileSubmenuToggles(openTogglesArray) {
  if (!openTogglesArray.length) {
    return;
  }

  openTogglesArray.forEach(toggle => {
    toggle.classList.remove('header__menu-child-toggle--open');
  });
}

function closeMenuBranch(topNode) {
  closeSubmenu(topNode);
  resetMobileSubmenuToggles(
    topNode.querySelectorAll('.header__menu-child-toggle--open')
  );
  topNode.querySelectorAll('.header__menu-item--open').forEach(menu => {
    closeSubmenu(menu);
  });
}

function closeAllSubmenus() {
  document.querySelectorAll('.header__menu-item--open').forEach(menu => {
    closeSubmenu(menu);
  });
}

// keyboard controller for mobile and desktop navigation
const navA11yController = (function () {
  let isFocusing = false;
  let activeBranch;
  let currentView = 'mobile' | 'desktop';

  const setIsFocusing = bool => {
    isFocusing = bool;
  };

  const desktopMenuInFocus = () => {
    const onDesktopMenu = document
      .querySelector('.header__menu--desktop')
      .contains(document.activeElement);

    if (onDesktopMenu) {
      currentView = 'desktop';
    }

    return onDesktopMenu;
  };

  const mobileMenuInFocus = () => {
    const onMobileMenu = document
      .querySelector('.header__menu--mobile')
      .contains(document.activeElement);
    if (onMobileMenu) {
      currentView = 'mobile';
    }

    return onMobileMenu;
  };

  const isNavInFocus = () => desktopMenuInFocus() || mobileMenuInFocus();

  const setActiveBranch = node => {
    if (activeBranch && !activeBranch.isSameNode(node)) {
      /*
       * If nav is open already and a new branch is selected
       * Close the old branch
       */

      closeMenuBranch(activeBranch);
    }
    // Set the new active branch
    activeBranch = node;
  };
  const watchNav = () => {
    if (isFocusing) {
      // If the nav is in a focused state
      if (isNavInFocus()) {
        return;
      }

      /*
       * If current active item is outside of nav and nav was in focus
       * Close all submenus
       */

      closeAllSubmenus();
      setIsFocusing(false);
      setActiveBranch(null);
      if (currentView === 'mobile') {
        closeToggle[0].click();
      }
      return;
    } else if (!isFocusing && isNavInFocus()) {
      setIsFocusing(true);
      return;
    }
  };

  return {
    watchNav,
    setActiveBranch,
  };
})();

// Desktop Menu

if (menuParentItems) {
  document.addEventListener('keyup', e => {
    if (e.key === 'Tab') {
      navA11yController.watchNav();
    }
  });

  Array.prototype.forEach.call(menuParentItems, function (el) {
    // Link variables

    const childToggle = el.querySelector('.header__menu-child-toggle');

    // Handles hover over

    el.addEventListener('mouseover', function () {
      openSubmenu(this);
    });

    // Handles hover out

    el.addEventListener('mouseout', function () {
      closeSubmenu(this);
    });

    // Handles toggle for submenus

    childToggle.addEventListener('click', function () {
      if (this.parentNode.classList.contains('header__menu-item--open')) {
        closeSubmenu(this.parentNode);
      } else {
        const clickedOriginParentEl = this.closest(
          '.header__menu-item--depth-1'
        );
        openSubmenu(this.parentNode);
        navA11yController.setActiveBranch(clickedOriginParentEl);
      }
    });
  });
}

// Mobile menu

// Opens mobile menu

Array.prototype.forEach.call(openToggle, function (el) {
  const closeToggle = el.parentElement.querySelector(
    '.header__menu-toggle--close'
  );
  const mobileMenu = el.parentElement.querySelector('.header__menu--mobile');

  el.addEventListener('click', function () {
    this.classList.toggle('header__menu-toggle--show');
    closeToggle.classList.toggle('header__menu-toggle--show');
    mobileMenu.classList.toggle('header__menu--show');
  });
});

// Closes mobile menu

Array.prototype.forEach.call(closeToggle, function (el) {
  const openToggle = el.parentElement.querySelector(
    '.header__menu-toggle--open'
  );
  const mobileMenu = el.parentElement.querySelector('.header__menu--mobile');

  el.addEventListener('click', function () {
    this.classList.toggle('header__menu-toggle--show');
    openToggle.classList.toggle('header__menu-toggle--show');
    mobileMenu.classList.toggle('header__menu--show');
  });
});

// Handles toggle for submenus

if (mobileChildToggle) {
  Array.prototype.forEach.call(mobileChildToggle, function (el) {
    el.addEventListener('click', function () {
      this.classList.toggle('header__menu-child-toggle--open');
      if (this.parentNode.classList.contains('header__menu-item--open')) {
        closeSubmenu(this.parentNode);
      } else {
        const clickedOriginParentEl = this.closest(
          '.header__menu-item--depth-1'
        );
        openSubmenu(this.parentNode);
        navA11yController.setActiveBranch(clickedOriginParentEl);
      }
    });
  });
}

// Language switcher

// Handles toggle for language switcher submenu

if (langToggle) {
  Array.prototype.forEach.call(langToggle, function (el) {
    el.addEventListener('click', function () {
      this.classList.toggle('header__language-switcher-child-toggle--open');
      this.parentElement.parentElement.classList.toggle(
        'header__language-switcher-label--open'
      );
    });
  });
}
