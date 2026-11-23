(() => {
  const main = document.querySelector('main');
  const heading = main.querySelector('h1');
  const allHeading = heading.textContent;
  const occasionFilters = main.querySelector('.occasion-filters');
  const occasionEmpty = document.getElementById('occasion-empty');
  const allIsEmpty = !occasionEmpty.hidden;
  const recommendationSettings = main.querySelector('.recommendation-settings');
  const views = document.getElementById('outfit-views');
  const allLink = document.getElementById('view-all-outfits');
  const savedLink = document.getElementById('view-saved-outfits');
  const empty = document.getElementById('saved-outfits-empty');
  const explore = document.getElementById('explore-outfits');
  const status = document.getElementById('saved-outfits-status');

  // Capture the already filtered and ranked view. Switching views only changes visibility.
  const outfits = [...main.querySelectorAll('.outfit-card')].map((card) => {
    const feedback = card.querySelector('.outfit-feedback');
    const name = card.querySelector('h3').textContent;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'feedback-button save-outfit';
    button.setAttribute('aria-label', `Save ${name}`);
    feedback.after(button);
    return { card, button, id: feedback.dataset.outfitId, matchesOccasion: !card.hidden };
  });
  let saved = readSavedOutfits(new Set(outfits.map(({ id }) => id)));

  function showingSaved() {
    return window.location.hash === '#saved';
  }

  function render() {
    const savedView = showingSaved();
    main.dataset.outfitView = savedView ? 'saved' : 'all';
    heading.textContent = savedView ? 'Saved outfits' : allHeading;
    occasionFilters.hidden = savedView;
    occasionEmpty.hidden = savedView || !allIsEmpty;
    recommendationSettings.hidden = savedView;
    empty.hidden = !savedView || saved.size > 0;
    (savedView ? allLink : savedLink).removeAttribute('aria-current');
    (savedView ? savedLink : allLink).setAttribute('aria-current', 'page');
    savedLink.textContent = `Saved (${saved.size})`;

    for (const { card, button, id, matchesOccasion } of outfits) {
      const isSaved = saved.has(id);
      card.hidden = savedView ? !isSaved : !matchesOccasion;
      button.setAttribute('aria-pressed', String(isSaved));
      button.textContent = isSaved ? 'Saved' : 'Save';
    }
  }

  for (const { button, id } of outfits) {
    button.addEventListener('click', () => {
      saved = toggleSavedOutfit(saved, id);
      status.textContent = writeSavedOutfits(saved) ? '' :
        'Browser storage is unavailable. This change may be lost when you leave or refresh.';
      render();
      if (showingSaved() && !saved.has(id)) {
        (saved.size ? savedLink : explore).focus();
      }
    });
  }

  explore.addEventListener('click', () => {
    allLink.click();
    allLink.focus();
  });
  window.addEventListener('hashchange', render);
  views.hidden = false;
  render();
})();
