const test = require('node:test');
const assert = require('node:assert/strict');
const { wardrobeCatalog } = require('../wardrobe-catalog.js');
const { generateOutfits, resolveGeneratedOutfit } = require('../outfit-generator.js');
const { matchOutfitContext } = require('../outfit-context.js');
const { readSavedOutfits, writeSavedOutfit } = require('../saved-outfits-store.js');
const { readWearHistory, writeWearEntry, newWearEntry } = require('../wear-history-store.js');
const { rankOutfits } = require('../outfit-ranking.js');

test('generated bookmarks, wear records and shared feedback resolve outside the candidate pool', () => {
  const catalog = new Map(wardrobeCatalog.map((item) => [item.id, item]));
  const [generated] = generateOutfits(wardrobeCatalog, 'party', [], matchOutfitContext);
  const work = generateOutfits(wardrobeCatalog, 'work', [], matchOutfitContext);
  assert.equal(work.some(({ id }) => id === generated.id), false);
  const data = new Map([['fitcheck:saved-outfits', '["office-polish"]']]);
  const storage = {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index]; },
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, value); },
  };
  const known = { has: (id) => id === 'office-polish' || Boolean(resolveGeneratedOutfit(id, catalog)) };
  const wear = newWearEntry(generated.id, '2024-11-10');
  assert.equal(writeSavedOutfit(generated.id, true, storage), true);
  assert.equal(writeWearEntry(wear.id, wear, storage), true);
  assert.deepEqual([...readSavedOutfits(known, storage)], ['office-polish', generated.id]);
  assert.deepEqual(readWearHistory(known, storage), [wear]);
  const liked = resolveGeneratedOutfit(generated.id, catalog);
  const ranked = rankOutfits(work, [{ ...liked, reaction: 'up' }]);
  assert.ok(ranked.some(({ score }) => score > 0));
});
