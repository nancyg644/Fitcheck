(() => {
  const grid = document.querySelector('.outfit-grid');
  const outfits = [...grid.querySelectorAll('.outfit-card')].map((card) => ({
    card,
    id: card.querySelector('.outfit-feedback').dataset.outfitId,
    itemIds: [...card.querySelectorAll('[data-item-id]')].map((item) => item.dataset.itemId),
    styles: (card.dataset.styles ?? '').split(' '),
    colors: (card.dataset.colors ?? '').split(' '),
    priority: card.dataset.priority,
  }));

  const candidates = outfits.filter(({ card }) => !card.hidden);
  const feedback = outfits.map(({ id, itemIds }) => ({
    id, itemIds, reaction: readOutfitFeedback(id),
  }));

  const list = new Intl.ListFormat('en');
  const preferences = readStylePreferences();
  for (const { outfit: { card }, score, liked, matches } of rankOutfits(candidates, feedback, preferences)) {
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
    grid.append(card);
  }

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
