const test = require('node:test');
const assert = require('node:assert/strict');
const {
  readSavedOutfits, toggleSavedOutfit, writeSavedOutfits,
} = require('../saved-outfits-store.js');

test('saved selection toggles by outfit ID without mutating the original set', () => {
  const initial = new Set(['everyday-casual']);
  const saved = toggleSavedOutfit(initial, 'office-polish');
  assert.deepEqual([...initial], ['everyday-casual']);
  assert.deepEqual([...saved], ['everyday-casual', 'office-polish']);
  assert.deepEqual([...toggleSavedOutfit(saved, 'everyday-casual')], ['office-polish']);
});

test('saved data ignores malformed values, unknown IDs, and duplicates', () => {
  const known = new Set(['everyday-casual']);
  for (const value of [null, 'invalid JSON', '{}', '"everyday-casual"']) {
    assert.deepEqual([...readSavedOutfits(known, { getItem: () => value })], []);
  }
  const mixed = { getItem: () => '["everyday-casual","everyday-casual","unknown",1,null]' };
  assert.deepEqual([...readSavedOutfits(known, mixed)], ['everyday-casual']);
});

test('unavailable storage leaves saving usable in memory', () => {
  const blocked = {
    getItem() { throw new Error('Blocked'); },
    setItem() { throw new Error('Blocked'); },
  };
  const saved = toggleSavedOutfit(readSavedOutfits(new Set(['office-polish']), blocked), 'office-polish');
  assert.equal(writeSavedOutfits(saved, blocked), false);
  assert.deepEqual([...saved], ['office-polish']);
});
