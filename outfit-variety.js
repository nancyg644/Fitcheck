function outfitSignature(itemIds) {
  return [...itemIds].sort().join('+');
}

function variedOutfitOrder(ranked) {
  const predefinedBases = new Set(ranked.filter(({ outfit }) => !outfit.generated).map(({ outfit }) => outfit.base));
  const pending = ranked.filter(({ outfit }) => !outfit.generated || !predefinedBases.has(outfit.base));
  const ordered = [];
  const usedBases = new Set();
  const usedPieces = new Map();
  const usedPalettes = new Map();
  while (pending.length) {
    let best = -1;
    let bestScore = -Infinity;
    for (const [index, { score, liked, outfit }] of pending.entries()) {
      if (usedBases.has(outfit.base)) continue;
      const repeated = outfit.itemIds.reduce((sum, id) => sum + Math.min(2, usedPieces.get(id) ?? 0), 0);
      const palette = outfit.colors.slice().sort().join('+');
      const varietyPenalty = Math.min(0.65, repeated * 0.09 + (usedPalettes.get(palette) ?? 0) * 0.06);
      const adjusted = score + (liked ? 0.12 : 0) + (outfit.quality ?? 0) * 0.03 - varietyPenalty;
      if (adjusted > bestScore) {
        best = index;
        bestScore = adjusted;
      }
    }
    if (best === -1) break;
    const [chosen] = pending.splice(best, 1);
    const { outfit } = chosen;
    ordered.push(chosen);
    usedBases.add(outfit.base);
    for (const id of outfit.itemIds) usedPieces.set(id, (usedPieces.get(id) ?? 0) + 1);
    const palette = outfit.colors.slice().sort().join('+');
    usedPalettes.set(palette, (usedPalettes.get(palette) ?? 0) + 1);
  }
  return ordered;
}

if (typeof module !== 'undefined') module.exports = { outfitSignature, variedOutfitOrder };
