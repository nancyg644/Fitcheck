(() => {
  const nav = document.querySelector('.bottom-nav');
  document.addEventListener('focusin', ({ target }) => {
    if (!target.matches(':focus-visible') || nav.contains(target)) return;
    requestAnimationFrame(() => {
      if (document.activeElement !== target) return;
      const bottom = target.getBoundingClientRect().bottom;
      const navTop = nav.getBoundingClientRect().top;
      if (bottom > navTop - 8) window.scrollBy(0, bottom - navTop + 8);
    });
  });
})();
