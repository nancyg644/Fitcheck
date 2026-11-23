const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readStylePreferences, saveStylePreferences } = require('../style-preferences-store.js');
const { readOutfitFeedback } = require('../outfit-feedback.js');
const { readSavedOutfits } = require('../saved-outfits-store.js');
const { readWearHistory } = require('../wear-history-store.js');
const { rankOutfits } = require('../outfit-ranking.js');

test('integration: stored profile ranks the tagged occasion catalog and reset preserves other features', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'outfits.html'), 'utf8');
  const catalog = [...html.matchAll(/data-occasions="([^"]+)" data-styles="([^"]+)" data-colors="([^"]+)" data-priority="([^"]+)"([\s\S]*?)data-outfit-id="([^"]+)"/g)]
    .map(([, occasions, styles, colors, priority, markup, id]) => ({
      id, occasions: occasions.split(' '), styles: styles.split(' '), colors: colors.split(' '), priority,
      itemIds: [...markup.matchAll(/data-item-id="([^"]+)"/g)].map(([, itemId]) => itemId),
    }));
  const id = 'smart-casual';
  const wear = { outfitId: id, date: '2026-11-23' };
  const data = new Map([
    ['fitcheck:saved-outfits', JSON.stringify([id])],
    ['fitcheck:wear-history', JSON.stringify([wear])],
  ]);
  const storage = {
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); },
  };
  const work = catalog.filter(({ occasions }) => occasions.includes('work'));
  const ranked = () => rankOutfits(work, catalog.map((outfit) => ({
    ...outfit, reaction: readOutfitFeedback(outfit.id, storage),
  })), readStylePreferences(storage)).map(({ outfit }) => outfit.id);
  assert.deepEqual(ranked(), [id, 'office-polish']);
  assert.equal(saveStylePreferences({ styles: ['minimalist'], colors: ['neutrals'], priority: 'balanced' }, storage), true);
  assert.deepEqual(ranked(), ['office-polish', id]);
  data.set(`fitcheck:outfit-feedback:${id}`, 'up');
  assert.deepEqual(ranked(), [id, 'office-polish']);
  assert.equal(saveStylePreferences(null, storage), true);
  assert.equal(readOutfitFeedback(id, storage), 'up');
  const known = new Set(catalog.map((outfit) => outfit.id));
  assert.deepEqual([...readSavedOutfits(known, storage)], [id]);
  assert.deepEqual(readWearHistory(known, storage).map(({ outfitId, date }) => ({ outfitId, date })), [wear]);
});
