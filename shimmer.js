(function () {
  'use strict';

  function attachShimmer(el) {
    el.addEventListener('mouseenter', () => {
      el.style.setProperty('--card-opacity', '1');
    });

    el.addEventListener('mousemove', e => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width)  * 100;
      const y = ((e.clientY - rect.top)  / rect.height) * 100;
      el.style.setProperty('--mx', x + '%');
      el.style.setProperty('--my', y + '%');
    });

    el.addEventListener('mouseleave', () => {
      el.style.setProperty('--card-opacity', '0');
    });
  }

  function init() {
    // Profile page cards
    document.querySelectorAll('.card').forEach(attachShimmer);
    // Login page wrapper
    const loginWrapper = document.querySelector('.login-wrapper');
    if (loginWrapper) attachShimmer(loginWrapper);
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();