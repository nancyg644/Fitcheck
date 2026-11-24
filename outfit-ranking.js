function rankOutfits(candidates, feedback, preferences = {}) {
  const reactions = new Map();
  const likedItems = new Map();
  const dislikedItems = new Map();
  for (const { id, itemIds, reaction } of feedback) {
    if (reaction !== 'up' && reaction !== 'down') continue;
    const items = new Set(itemIds);
    reactions.set(id, { reaction, items });
    const counts = reaction === 'up' ? likedItems : dislikedItems;
    for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return candidates.map((outfit, index) => {
    const direct = reactions.get(outfit.id);
    const liked = direct?.reaction === 'up';
    let score = direct ? (liked ? 3 : -3) : 0;
    for (const itemId of new Set(outfit.itemIds)) {
      const ownItem = direct?.items.has(itemId) ?? false;
      const otherLikes = (likedItems.get(itemId) ?? 0) - Number(ownItem && liked);
      const otherDislikes = (dislikedItems.get(itemId) ?? 0) - Number(ownItem && !liked);
      score += Number(otherLikes > 0) - Number(otherDislikes > 0);
    }

    const styles = (preferences.styles ?? []).filter((style) => outfit.styles?.includes(style));
    const colors = (preferences.colors ?? []).filter((color) => outfit.colors?.includes(color));
    const priority = preferences.priority && preferences.priority === outfit.priority
      ? preferences.priority : null;
    // A maximum 0.75-point boost can break a feedback tie without reversing a one-point lead.
    const profileBoost = 0.25 * (Number(styles.length > 0) + Number(colors.length > 0) + Number(Boolean(priority)));
    return { outfit, score: score + profileBoost, index, liked, matches: { styles, colors, priority } };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
}

if (typeof module !== 'undefined') module.exports = { rankOutfits };
