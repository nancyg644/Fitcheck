const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readOutfitFeedback, clearOutfitFeedback } = require('../outfit-feedback.js');
const { readSavedOutfits, writeSavedOutfit } = require('../saved-outfits-store.js');
const { readWearHistory, writeWearRecord } = require('../wear-history-store.js');

test('integration: wear history reloads using catalog IDs and is independent of bookmarks and feedback', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'outfits.html'), 'utf8');
  const catalog = new Set([...html.matchAll(/data-outfit-id="([^"]+)"/g)].map(([, id]) => id));
  const id = 'everyday-casual';
  assert.equal(catalog.has(id), true);
  const firstWear = { outfitId: id, date: '2026-11-22' };
  const data = new Map([
    [`fitcheck:outfit-feedback:${id}`, 'up'],
    ['fitcheck:wear-history', JSON.stringify([firstWear])],
  ]);
  const storage = {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); },
  };

  assert.equal(writeSavedOutfit(id, true, storage), true);
  assert.equal(writeWearRecord(id, '2026-11-23', true, storage), true);
  assert.deepEqual(readWearHistory(catalog, storage), [firstWear, { outfitId: id, date: '2026-11-23' }]);
  assert.equal(readOutfitFeedback(id, storage), 'up');
  assert.deepEqual([...readSavedOutfits(catalog, storage)], [id]);
  assert.equal(clearOutfitFeedback(storage), true);
  assert.equal(readWearHistory(catalog, storage).length, 2);
  assert.equal(writeWearRecord(id, '2026-11-23', false, storage), true);
  assert.deepEqual(readWearHistory(catalog, storage), [firstWear]);
  assert.equal(writeWearRecord(id, firstWear.date, false, storage), true);
  assert.deepEqual(readWearHistory(catalog, storage), []);
  assert.deepEqual([...readSavedOutfits(catalog, storage)], [id]);
});
