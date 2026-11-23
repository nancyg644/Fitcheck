const test = require('node:test');
const assert = require('node:assert/strict');
const {
  readSavedOutfits, writeSavedOutfit,
} = require('../saved-outfits-store.js');

test('bookmark writes change only the selected ID and can remove legacy bookmarks', () => {
  const data = new Map([['fitcheck:saved-outfits', '["everyday-casual"]']]);
  const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
  const known = new Set(['everyday-casual', 'office-polish']);
  assert.equal(writeSavedOutfit('office-polish', true, storage), true);
  assert.deepEqual([...readSavedOutfits(known, storage)], ['everyday-casual', 'office-polish']);
  assert.equal(writeSavedOutfit('everyday-casual', false, storage), true);
  assert.deepEqual([...readSavedOutfits(known, storage)], ['office-polish']);
  assert.equal(data.get('fitcheck:saved-outfits'), '["everyday-casual"]');
});

test('saved data ignores malformed values, unknown IDs, and duplicates', () => {
  const known = new Set(['everyday-casual']);
  for (const value of [null, 'invalid JSON', '{}', '"everyday-casual"']) {
    assert.deepEqual([...readSavedOutfits(known, { getItem: () => value })], []);
  }
  const mixed = { getItem: () => '["everyday-casual","everyday-casual","unknown",1,null]' };
  assert.deepEqual([...readSavedOutfits(known, mixed)], ['everyday-casual']);
});

test('unavailable storage reports a failed bookmark write', () => {
  const blocked = {
    getItem() { throw new Error('Blocked'); },
    setItem() { throw new Error('Blocked'); },
  };
  assert.equal(writeSavedOutfit('office-polish', true, blocked), false);
  assert.deepEqual([...readSavedOutfits(new Set(['office-polish']), blocked)], []);
});
