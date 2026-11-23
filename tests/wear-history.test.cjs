const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readOutfitFeedback, clearOutfitFeedback } = require('../outfit-feedback.js');
const { readSavedOutfits, writeSavedOutfit } = require('../saved-outfits-store.js');
const { readWearHistory, newWearEntry, writeWearEntry } = require('../wear-history-store.js');

test('integration: wear history reloads using catalog IDs and is independent of bookmarks and feedback', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'outfits.html'), 'utf8');
  const catalog = new Set([...html.matchAll(/data-outfit-id="([^"]+)"/g)].map(([, id]) => id));
  const id = 'everyday-casual';
  assert.equal(catalog.has(id), true);
  const firstWear = { outfitId: id, date: '2024-11-20' };
  const data = new Map([
    [`fitcheck:outfit-feedback:${id}`, 'up'],
    ['fitcheck:wear-history', JSON.stringify([firstWear])],
    [`fitcheck:wear-history:2024-11-21:${id}`, '100'],
    [`fitcheck:wear-history:2024-11-20:${id}`, 'removed'],
  ]);
  const storage = {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); },
  };

  assert.equal(writeSavedOutfit(id, true, storage), true);
  const [legacy] = readWearHistory(catalog, storage);
  assert.equal(legacy.date, '2024-11-21');
  const entry = newWearEntry(id, legacy.date);
  assert.equal(writeWearEntry(entry.id, entry, storage), true);
  assert.deepEqual(readWearHistory(catalog, storage), [legacy, entry]);
  assert.equal(readOutfitFeedback(id, storage), 'up');
  assert.deepEqual([...readSavedOutfits(catalog, storage)], [id]);
  assert.equal(clearOutfitFeedback(storage), true);
  assert.equal(readWearHistory(catalog, storage).length, 2);
  const edited = { ...legacy, date: '2024-11-19' };
  assert.equal(writeWearEntry(legacy.id, edited, storage), true);
  assert.deepEqual(readWearHistory(catalog, storage), [edited, entry]);
  assert.equal(writeWearEntry(legacy.id, null, storage), true);
  assert.deepEqual(readWearHistory(catalog, storage), [entry]);
  assert.deepEqual([...readSavedOutfits(catalog, storage)], [id]);
});
