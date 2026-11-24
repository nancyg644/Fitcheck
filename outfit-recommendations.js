const outfitBrowse = (() => {
  const grid = document.querySelector('.outfit-grid');
  const more = document.getElementById('show-more-outfits');
  const catalog = new Map(wardrobeCatalog.map((item) => [item.id, item]));
  const displayed = new Set();
  const outfits = [...grid.querySelectorAll('.outfit-card')].map((card) => ({
    card,
    id: card.querySelector('.outfit-feedback').dataset.outfitId,
    name: card.querySelector('h3').textContent,
    itemIds: [...card.querySelectorAll('[data-item-id]')].map((item) => item.dataset.itemId),
    styles: (card.dataset.styles ?? '').split(' '),
    colors: (card.dataset.colors ?? '').split(' '),
    priority: card.dataset.priority,
    context: Object.fromEntries(Object.keys(outfitContextFields).map((field) =>
      [field, (card.getAttribute(`data-${field}`) ?? '').split(' ')])),
  }));
  for (const outfit of outfits) {
    outfit.items = outfit.itemIds.map((id) => catalog.get(id));
    outfit.base = outfit.items.filter(({ category }) => ['tops', 'bottoms', 'dresses'].includes(category))
      .map(({ id }) => id).join('+');
    outfit.quality = 3;
  }
  const registry = new Map(outfits.map((outfit) => [outfit.id, outfit]));
  const predefinedSignatures = new Set(outfits.map(({ itemIds }) => outfitSignature(itemIds)));
  const criteria = readOutfitContext(new URLSearchParams(window.location.search));
  const occasion = new URLSearchParams(window.location.search).get('occasion');
  const initialFeedback = readFeedback();
  const likedIds = new Set(initialFeedback.filter(({ reaction }) => reaction === 'up').map(({ id }) => id));
  const generated = generateOutfits(wardrobeCatalog, occasion, criteria, matchOutfitContext, likedIds)
    .filter(({ itemIds }) => !predefinedSignatures.has(outfitSignature(itemIds)));
  const candidates = outfits.filter(({ card }) => !card.hidden);
  const eligible = [...filterOutfitsByContext(candidates, criteria), ...generated.map((outfit) => ({
    ...outfit, generated: true,
  }))];
  for (const outfit of eligible) registry.set(outfit.id, outfit);

  function resolve(id) {
    if (typeof id !== 'string') return null;
    return registry.get(id) ?? resolveGeneratedOutfit(id, catalog);
  }

  function readFeedback() {
    const feedback = new Map();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(outfitFeedbackPrefix)) continue;
        const id = key.slice(outfitFeedbackPrefix.length);
        const outfit = resolve(id);
        if (outfit) feedback.set(id, { id, itemIds: outfit.itemIds, reaction: readOutfitFeedback(id) });
      }
    } catch {
      // Mounted buttons still carry reactions when storage is unavailable.
    }
    for (const { card, id, itemIds } of registry.values()) {
      if (!card) continue;
      const reaction = card.querySelector('[data-reaction][aria-pressed="true"]')?.dataset.reaction;
      feedback.set(id, { id, itemIds, reaction });
    }
    return [...feedback.values()];
  }

  const list = new Intl.ListFormat('en');
  const preferences = readStylePreferences();
  const results = variedOutfitOrder(rankOutfits(eligible, initialFeedback, preferences));
  const invalidOccasion = Boolean(occasion && !Object.hasOwn(occasionNames, occasion));
  document.getElementById('occasion-empty').hidden = !invalidOccasion &&
    (eligible.length > 0 || criteria.length > 0 || candidates.length > 0);
  document.getElementById('context-empty').hidden = invalidOccasion || !criteria.length || eligible.length > 0;
  for (const outfit of outfits) outfit.card.hidden = true;

  function contextPhrase({ field, value }) {
    const option = outfitContextFields[field].options[value].toLowerCase();
    switch (field) {
      case 'weather': return `${option} weather`;
      case 'dress-code': return `a ${option} dress code`;
      case 'setting':
        if (value === 'both') return 'indoor and outdoor settings';
        return value === 'indoors' ? 'an indoor setting' : 'an outdoor setting';
      default: return value === 'seated' ? 'mostly seated plans' : 'plans with lots of walking';
    }
  }

  function renderPersonalization({ outfit: { card }, score, liked, matches }) {
    card.querySelector('.recommendation-label')?.remove();
    card.querySelector('.recommendation-explanation')?.remove();
    if (score > 0) {
      const label = document.createElement('p');
      label.className = 'recommendation-label';
      label.textContent = 'Recommended for you';
      const explanation = document.createElement('p');
      explanation.className = 'recommendation-explanation';
      const reasons = [];
      if (matches.styles.length) {
        const styles = matches.styles.map((style) => stylePreferenceOptions.styles[style].toLowerCase());
        reasons.push(`${list.format(styles)} styles`);
      }
      for (const color of matches.colors) {
        reasons.push(color === 'neutrals' ? 'neutral colors' : stylePreferenceOptions.colors[color].toLowerCase());
      }
      if (matches.priority) reasons.push(`${matches.priority} outfits`);
      explanation.textContent = reasons.length
        ? `Matches your preferences for ${list.format(reasons)}.`
        : liked ? 'You liked this outfit.' : 'Shares pieces with outfits you liked.';
      card.querySelector('h3').before(label, explanation);
    }
  }

  function mount(id) {
    const outfit = resolve(id);
    if (!outfit) return null;
    if (outfit.card) return outfit.card;
    outfit.card = createGeneratedOutfitCard(outfit);
    outfit.card.hidden = true;
    registry.set(id, outfit);
    grid.append(outfit.card);
    grid.dispatchEvent(new CustomEvent('fitcheck:card-added', { detail: outfit }));
    return outfit.card;
  }

  function showMore() {
    const moveFocus = document.activeElement === more;
    const next = results.slice(displayed.size, displayed.size + 6);
    for (const result of next) {
      const { outfit } = result;
      displayed.add(outfit.id);
      const card = mount(outfit.id);
      card.hidden = false;
      if (criteria.length || outfit.generated) {
        const explanation = document.createElement('p');
        explanation.className = 'context-explanation';
        const matches = criteria.length ? `Matches ${list.format(criteria.map(contextPhrase))}.` : '';
        const occasionNote = outfit.generated && occasion ? `Suitable for ${occasionNames[occasion]}.` : '';
        explanation.textContent = [occasionNote, matches].filter(Boolean).join(' ');
        if (explanation.textContent) card.querySelector('h3').after(explanation);
      }
      grid.append(card);
    }
    refreshPersonalization();
    refreshMore();
    if (next.length && moveFocus) {
      next[0].outfit.card.querySelector('h3').tabIndex = -1;
      next[0].outfit.card.querySelector('h3').focus();
    }
  }

  function refreshMore(showRecommendations = true) {
    more.hidden = !showRecommendations || displayed.size >= results.length;
  }

  more.addEventListener('click', showMore);
  showMore();

  function refreshPersonalization() {
    // Recheck explanations for the current cards without changing order or context visibility.
    rankOutfits(eligible.filter(({ id }) => displayed.has(id)), readFeedback(), preferences)
      .forEach(renderPersonalization);
  }

  grid.addEventListener('click', (event) => {
    if (event.target.closest('[data-reaction]')) refreshPersonalization();
  });
  window.addEventListener('storage', ({ key }) => {
    if (key === null || key.startsWith(outfitFeedbackPrefix)) refreshPersonalization();
  });

  document.getElementById('reset-recommendations').addEventListener('click', () => {
    if (!window.confirm('Clear all saved outfit Likes and Dislikes in this browser?')) return;
    if (clearOutfitFeedback()) {
      window.location.reload();
    } else {
      document.getElementById('recommendation-status').textContent =
        'Could not clear all feedback. Check browser storage settings and try again.';
    }
  });

  // A restored history entry can still contain reactions from an earlier visit.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload();
  });
  return { resolve, mount, displayed, refreshMore };
})();
