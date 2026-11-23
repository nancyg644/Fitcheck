const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readOutfitFeedback, clearOutfitFeedback } = require('../outfit-feedback.js');
const {
  readSavedOutfits, writeSavedOutfit,
} = require('../saved-outfits-store.js');

test('integration: bookmarks persist using catalog IDs and survive a feedback reset', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'outfits.html'), 'utf8');
  const known = new Set([...html.matchAll(/data-outfit-id="([^"]+)"/g)].map(([, id]) => id));
  const casual = 'everyday-casual';
  const work = 'office-polish';
  assert.equal(known.has(casual) && known.has(work), true);
  const data = new Map([[`fitcheck:outfit-feedback:${casual}`, 'down']]);
  const storage = {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); },
  };

  assert.equal(writeSavedOutfit(casual, true, storage), true);
  assert.equal(writeSavedOutfit(work, true, storage), true);
  assert.equal(readOutfitFeedback(casual, storage), 'down');
  assert.equal(readOutfitFeedback(work, storage), null);
  assert.equal(clearOutfitFeedback(storage), true);
  assert.deepEqual([...readSavedOutfits(known, storage)], [casual, work]);
  assert.equal(writeSavedOutfit(casual, false, storage), true);
  assert.deepEqual([...readSavedOutfits(known, storage)], [work]);
});
