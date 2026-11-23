function rankOutfits(candidates, feedback) {
  return candidates.map((outfit, index) => {
    const likedItems = new Set();
    const dislikedItems = new Set();
    let score = 0;

    for (const { id, itemIds, reaction } of feedback) {
      if (reaction !== 'up' && reaction !== 'down') continue;
      if (id === outfit.id) {
        score = reaction === 'up' ? 3 : -3;
        continue;
      }

      const items = reaction === 'up' ? likedItems : dislikedItems;
      itemIds.forEach((itemId) => items.add(itemId));
    }

    for (const itemId of new Set(outfit.itemIds)) {
      score += Number(likedItems.has(itemId)) - Number(dislikedItems.has(itemId));
    }

    return { outfit, score, index };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
}

if (typeof module !== 'undefined') module.exports = { rankOutfits };
