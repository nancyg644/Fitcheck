(() => {
  const occasion = new URLSearchParams(window.location.search).get('occasion');
  if (!occasion) return;

  const filters = document.querySelectorAll('.occasion-filters a');
  const selected = [...filters].find((link) =>
    new URL(link.href).searchParams.get('occasion') === occasion);
  filters[0].removeAttribute('aria-current');

  const heading = document.querySelector('main h1');
  if (selected) {
    selected.setAttribute('aria-current', 'page');
    heading.textContent = `${selected.textContent} outfit ideas`;
  } else {
    heading.textContent = 'Occasion unavailable';
  }

  let hasMatch = false;
  document.querySelectorAll('.outfit-card').forEach((card) => {
    const matches = Boolean(selected) && card.dataset.occasions.split(' ').includes(occasion);
    card.hidden = !matches;
    hasMatch ||= matches;
  });
  document.getElementById('occasion-empty').hidden = hasMatch;
})();
