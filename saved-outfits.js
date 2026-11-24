(() => {
  const main = document.querySelector('main');
  const heading = main.querySelector('h1');
  const allHeading = heading.textContent;
  const occasionFilters = main.querySelector('.occasion-filters');
  const occasionEmpty = document.getElementById('occasion-empty');
  const allIsEmpty = !occasionEmpty.hidden;
  const contextControls = document.getElementById('refine-outfit');
  const contextEmpty = document.getElementById('context-empty');
  const hasNoContextMatches = !contextEmpty.hidden;
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

  const grid = main.querySelector('.outfit-grid');
  const outfits = new Map();
  const knownIds = { has: (id) => Boolean(outfitBrowse.resolve(id)) };
  const unsavedChanges = new Map();
  let saved = readSavedOutfits(knownIds);
  const { renderHistory: renderWearHistory, registerOutfit: registerWearControls } =
    setupWearHistory(outfitBrowse.resolve);

  function registerOutfit(outfit) {
    const { id, card, name } = outfit;
    if (outfits.has(id)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'feedback-button save-outfit';
    button.setAttribute('aria-label', `Save ${name}`);
    card.querySelector('.outfit-feedback').after(button);
    setBookmarkButton(button, saved.has(id));
    outfits.set(id, { card, button, id });
    registerWearControls(outfit);
    button.addEventListener('click', () => {
      const isSaved = !saved.has(id);
      if (writeSavedOutfit(id, isSaved)) unsavedChanges.delete(id);
      else unsavedChanges.set(id, isSaved);
      status.textContent = unsavedChanges.size
        ? 'Browser storage is unavailable. This change may be lost when you leave or refresh.'
        : '';
      refreshBookmarks();
      if (showingSaved() && !saved.has(id)) (saved.size ? savedLink : explore).focus();
    });
  }

  function setBookmarkButton(button, isSaved) {
    button.setAttribute('aria-pressed', String(isSaved));
    button.textContent = isSaved ? 'Saved' : 'Save';
  }

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
    contextEmpty.hidden = !allView || !hasNoContextMatches;
    recommendationSettings.hidden = !allView;
    outfitBrowse.refreshMore(allView);
    empty.hidden = !savedView || saved.size > 0;
    history.hidden = !historyView;
    if (historyView) renderWearHistory();
    for (const link of links) link.removeAttribute('aria-current');
    currentLink.setAttribute('aria-current', 'page');
    savedLink.textContent = `Saved (${saved.size})`;

    if (savedView) for (const id of saved) outfitBrowse.mount(id);
    for (const { card, button, id } of outfits.values()) {
      const isSaved = saved.has(id);
      card.hidden = historyView || (savedView ? !isSaved : !outfitBrowse.displayed.has(id));
      setBookmarkButton(button, isSaved);
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

  for (const card of grid.querySelectorAll('.outfit-card')) {
    registerOutfit(outfitBrowse.resolve(card.querySelector('.outfit-feedback').dataset.outfitId));
  }
  grid.addEventListener('fitcheck:card-added', ({ detail }) => registerOutfit(detail));
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
