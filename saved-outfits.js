(() => {
  const main = document.querySelector('main');
  const heading = main.querySelector('h1');
  const allHeading = heading.textContent;
  const occasionFilters = main.querySelector('.occasion-filters');
  const occasionEmpty = document.getElementById('occasion-empty');
  const allIsEmpty = !occasionEmpty.hidden;
  const contextControls = document.getElementById('refine-outfit');
  const contextFallback = document.getElementById('context-fallback');
  const hasContextFallback = !contextFallback.hidden;
  const recommendationSettings = main.querySelector('.recommendation-settings');
  const views = document.getElementById('outfit-views');
  const allLink = document.getElementById('view-all-outfits');
  const savedLink = document.getElementById('view-saved-outfits');
  const historyLink = document.getElementById('view-wear-history');
  const history = document.getElementById('wear-history-view');
  const links = [allLink, savedLink, historyLink];
  const empty = document.getElementById('saved-outfits-empty');
  const explore = document.getElementById('explore-outfits');
  const status = document.getElementById('saved-outfits-status');

  // Capture the already filtered and ranked search. Switching views only changes visibility.
  const outfits = [...main.querySelectorAll('.outfit-card')].map((card) => {
    const feedback = card.querySelector('.outfit-feedback');
    const name = card.querySelector('h3').textContent;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'feedback-button save-outfit';
    button.setAttribute('aria-label', `Save ${name}`);
    feedback.after(button);
    return { card, button, id: feedback.dataset.outfitId, showsInAll: !card.hidden };
  });
  const knownIds = new Set(outfits.map(({ id }) => id));
  const unsavedChanges = new Map();
  let saved = readSavedOutfits(knownIds);
  const renderWearHistory = setupWearHistory(outfits);

  function showingSaved() {
    return window.location.hash === '#saved';
  }

  function render() {
    const savedView = showingSaved();
    const historyView = window.location.hash === '#wear-history';
    const allView = !savedView && !historyView;
    const currentLink = historyView ? historyLink : savedView ? savedLink : allLink;
    main.dataset.outfitView = historyView ? 'history' : savedView ? 'saved' : 'all';
    heading.textContent = historyView ? 'Wear History' : savedView ? 'Saved outfits' : allHeading;
    occasionFilters.hidden = !allView;
    occasionEmpty.hidden = !allView || !allIsEmpty;
    contextControls.hidden = !allView;
    contextFallback.hidden = !allView || !hasContextFallback;
    recommendationSettings.hidden = !allView;
    empty.hidden = !savedView || saved.size > 0;
    history.hidden = !historyView;
    if (historyView) renderWearHistory();
    for (const link of links) link.removeAttribute('aria-current');
    currentLink.setAttribute('aria-current', 'page');
    savedLink.textContent = `Saved (${saved.size})`;

    for (const { card, button, id, showsInAll } of outfits) {
      const isSaved = saved.has(id);
      card.hidden = historyView || (savedView ? !isSaved : !showsInAll);
      button.setAttribute('aria-pressed', String(isSaved));
      button.textContent = isSaved ? 'Saved' : 'Save';
    }
  }

  function refreshBookmarks() {
    saved = readSavedOutfits(knownIds);
    for (const [id, isSaved] of unsavedChanges) {
      if (isSaved) saved.add(id);
      else saved.delete(id);
    }
    render();
  }

  for (const { button, id } of outfits) {
    button.addEventListener('click', () => {
      const isSaved = !saved.has(id);
      if (writeSavedOutfit(id, isSaved)) unsavedChanges.delete(id);
      else unsavedChanges.set(id, isSaved);
      status.textContent = unsavedChanges.size
        ? 'Browser storage is unavailable. This change may be lost when you leave or refresh.'
        : '';
      refreshBookmarks();
      if (showingSaved() && !saved.has(id)) {
        (saved.size ? savedLink : explore).focus();
      }
    });
  }
  window.addEventListener('storage', ({ key }) => {
    if (key === null || key === savedOutfitsKey || key.startsWith(savedOutfitPrefix)) refreshBookmarks();
  });

  for (const exploreButton of [explore, document.getElementById('explore-wear-outfits')]) {
    exploreButton.addEventListener('click', () => {
      allLink.click();
      allLink.focus();
    });
  }
  window.addEventListener('hashchange', render);
  views.hidden = false;
  render();
})();
