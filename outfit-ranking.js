const matchContext = typeof module !== 'undefined'
  ? require('./outfit-context.js').matchOutfitContext
  : matchOutfitContext;

function rankOutfits(candidates, feedback, preferences = {}, criteria = []) {
  return candidates.map((outfit, index) => {
    const likedItems = new Set();
    const dislikedItems = new Set();
    let score = 0;
    let liked = false;

    for (const { id, itemIds, reaction } of feedback) {
      if (reaction !== 'up' && reaction !== 'down') continue;
      if (id === outfit.id) {
        liked = reaction === 'up';
        score = reaction === 'up' ? 3 : -3;
        continue;
      }

      const items = reaction === 'up' ? likedItems : dislikedItems;
      itemIds.forEach((itemId) => items.add(itemId));
    }

    for (const itemId of new Set(outfit.itemIds)) {
      score += Number(likedItems.has(itemId)) - Number(dislikedItems.has(itemId));
    }

    const styles = (preferences.styles ?? []).filter((style) => outfit.styles?.includes(style));
    const colors = (preferences.colors ?? []).filter((color) => outfit.colors?.includes(color));
    const priority = preferences.priority && preferences.priority === outfit.priority
      ? preferences.priority : null;
    // A maximum 0.75-point boost can break a feedback tie without reversing a one-point lead.
    const profileBoost = 0.25 * (Number(styles.length > 0) + Number(colors.length > 0) + Number(Boolean(priority)));
    const context = matchContext(outfit.context, criteria);
    return { outfit, score: score + profileBoost, index, liked, matches: { styles, colors, priority }, context };
  }).sort((a, b) => b.context.matched.length - a.context.matched.length ||
    b.score - a.score || a.index - b.index);
}

function selectContextResults(ranked, criteria) {
  const bestCount = ranked[0]?.context.matched.length;
  const useFallback = ranked.length > 0 && bestCount < criteria.length;
  return {
    useFallback,
    results: useFallback ? ranked.filter(({ context }) => context.matched.length === bestCount) : ranked,
  };
}

if (typeof module !== 'undefined') module.exports = { rankOutfits, selectContextResults };
