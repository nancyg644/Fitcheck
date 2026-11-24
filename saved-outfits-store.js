const savedOutfitsKey = 'fitcheck:saved-outfits';
const savedOutfitPrefix = `${savedOutfitsKey}:`;

function readSavedOutfits(knownIds, storage) {
  try {
    const store = storage ?? localStorage;
    let legacy;
    try { legacy = JSON.parse(store.getItem(savedOutfitsKey)); } catch { legacy = null; }
    const saved = new Set(Array.isArray(legacy) ? legacy.filter((id) => knownIds.has(id)) : []);
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key?.startsWith(savedOutfitPrefix)) continue;
      const id = key.slice(savedOutfitPrefix.length);
      if (!knownIds.has(id)) continue;
      const state = store.getItem(key);
      if (state === '1') saved.add(id);
      if (state === '0') saved.delete(id);
    }
    return saved;
  } catch {
    return new Set();
  }
}

function writeSavedOutfit(id, isSaved, storage) {
  try {
    // Keep explicit removals so entries from the older collection stay removed.
    (storage ?? localStorage).setItem(savedOutfitPrefix + id, isSaved ? '1' : '0');
    return true;
  } catch {
    return false;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { readSavedOutfits, writeSavedOutfit };
}
