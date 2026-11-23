(() => {
  const grid = document.querySelector('.outfit-grid');
  const outfits = [...grid.querySelectorAll('.outfit-card')].map((card) => ({
    card,
    id: card.querySelector('.outfit-feedback').dataset.outfitId,
    itemIds: [...card.querySelectorAll('[data-item-id]')].map((item) => item.dataset.itemId),
  }));

  const candidates = outfits.filter(({ card }) => !card.hidden);
  const feedback = outfits.map(({ id, itemIds }) => ({
    id, itemIds, reaction: readOutfitFeedback(id),
  }));

  for (const { outfit: { card }, score } of rankOutfits(candidates, feedback)) {
    if (score > 0) {
      const label = document.createElement('p');
      label.className = 'recommendation-label';
      label.textContent = 'Recommended for you';
      card.querySelector('h3').before(label);
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
