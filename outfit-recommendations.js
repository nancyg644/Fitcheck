(() => {
  const grid = document.querySelector('.outfit-grid');
  const outfits = [...grid.querySelectorAll('.outfit-card')].map((card) => ({
    card,
    id: card.querySelector('.outfit-feedback').dataset.outfitId,
    itemIds: [...card.querySelectorAll('[data-item-id]')].map((item) => item.dataset.itemId),
    styles: (card.dataset.styles ?? '').split(' '),
    colors: (card.dataset.colors ?? '').split(' '),
    priority: card.dataset.priority,
    context: Object.fromEntries(Object.keys(outfitContextFields).map((field) =>
      [field, (card.getAttribute(`data-${field}`) ?? '').split(' ')])),
  }));

  const candidates = outfits.filter(({ card }) => !card.hidden);
  const feedback = outfits.map(({ id, itemIds }) => ({
    id, itemIds, reaction: readOutfitFeedback(id),
  }));

  const list = new Intl.ListFormat('en');
  const preferences = readStylePreferences();
  const criteria = readOutfitContext(new URLSearchParams(window.location.search));
  const ranked = rankOutfits(candidates, feedback, preferences, criteria);
  const { results, useFallback } = selectContextResults(ranked, criteria);
  document.getElementById('context-fallback').hidden = !useFallback;
  const visible = new Set(results.map(({ outfit }) => outfit));
  for (const outfit of candidates) outfit.card.hidden = !visible.has(outfit);

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

  function renderPersonalization({ outfit: { card }, score, liked, matches, context }) {
    card.querySelector('.recommendation-label')?.remove();
    card.querySelector('.recommendation-explanation')?.remove();
    if (score > 0 && !context.missed.length) {
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

  for (const result of results) {
    const { outfit: { card }, context } = result;
    renderPersonalization(result);
    if (criteria.length) {
      const explanation = document.createElement('p');
      explanation.className = 'context-explanation';
      const notes = [];
      if (context.matched.length) notes.push(`Matches ${list.format(context.matched.map(contextPhrase))}.`);
      if (context.missed.length) notes.push(`Doesn’t match ${list.format(context.missed.map(contextPhrase))}.`);
      explanation.textContent = notes.join(' ');
      card.querySelector('h3').after(explanation);
    }
    grid.append(card);
  }

  function refreshPersonalization() {
    const currentFeedback = outfits.map(({ card, id, itemIds }) => ({
      id, itemIds, reaction: card.querySelector('[data-reaction][aria-pressed="true"]')?.dataset.reaction,
    }));
    // Recheck explanations for the current cards without changing order or context visibility.
    rankOutfits(results.map(({ outfit }) => outfit), currentFeedback, preferences, criteria)
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
})();
