const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readOutfitFeedback, clearOutfitFeedback } = require('../outfit-feedback.js');
const { readSavedOutfits, writeSavedOutfits } = require('../saved-outfits-store.js');
const { readWearHistory, recordWear, undoWear, writeWearHistory } = require('../wear-history-store.js');

test('integration: wear history reloads using catalog IDs and is independent of bookmarks and feedback', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'outfits.html'), 'utf8');
  const catalog = new Set([...html.matchAll(/data-outfit-id="([^"]+)"/g)].map(([, id]) => id));
  const id = 'everyday-casual';
  assert.equal(catalog.has(id), true);
  const data = new Map([[`fitcheck:outfit-feedback:${id}`, 'up']]);
  const storage = {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); },
  };

  assert.equal(writeSavedOutfits(new Set([id]), storage), true);
  const dayOne = recordWear(readWearHistory(catalog, storage), id, '2026-11-22');
  assert.equal(writeWearHistory(dayOne, storage), true);
  const dayTwo = recordWear(readWearHistory(catalog, storage), id, '2026-11-23');
  assert.equal(writeWearHistory(dayTwo, storage), true);
  assert.equal(readOutfitFeedback(id, storage), 'up');
  assert.deepEqual([...readSavedOutfits(catalog, storage)], [id]);
  assert.equal(clearOutfitFeedback(storage), true);
  assert.deepEqual(readWearHistory(catalog, storage), dayTwo);
  assert.equal(writeWearHistory(undoWear(readWearHistory(catalog, storage), id, '2026-11-23'), storage), true);
  assert.deepEqual(readWearHistory(catalog, storage), dayOne);
  assert.deepEqual([...readSavedOutfits(catalog, storage)], [id]);
});
