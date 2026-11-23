const savedOutfitsKey = 'fitcheck:saved-outfits';

function readSavedOutfits(knownIds, storage) {
  try {
    const saved = JSON.parse((storage ?? localStorage).getItem(savedOutfitsKey));
    return new Set(Array.isArray(saved) ? saved.filter((id) => knownIds.has(id)) : []);
  } catch {
    return new Set();
  }
}

function toggleSavedOutfit(saved, id) {
  const next = new Set(saved);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

function writeSavedOutfits(saved, storage) {
  try {
    (storage ?? localStorage).setItem(savedOutfitsKey, JSON.stringify([...saved]));
    return true;
  } catch {
    return false;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { readSavedOutfits, toggleSavedOutfit, writeSavedOutfits };
}
