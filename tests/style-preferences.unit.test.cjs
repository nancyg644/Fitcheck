const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeStylePreferences, readStylePreferences, saveStylePreferences,
} = require('../style-preferences-store.js');
const { rankOutfits } = require('../outfit-ranking.js');

test('style preferences accept multiple supported styles and colors and one priority', () => {
  const result = normalizeStylePreferences({
    styles: ['classic', 'bold', 'classic', 'unknown', null],
    colors: ['neutrals', 'pastels', 'neutrals', 'constructor'],
    priority: 'style-first',
  });
  assert.deepEqual(result, {
    styles: ['classic', 'bold'], colors: ['neutrals', 'pastels'], priority: 'style-first',
  });
  assert.deepEqual(normalizeStylePreferences({ styles: 'classic', priority: ['balanced'] }),
    { styles: [], colors: [], priority: null });
});

test('invalid or blocked storage falls back to an empty profile', () => {
  const empty = { styles: [], colors: [], priority: null };
  for (const value of [null, 'broken{', '[]', 'null', 'false']) {
    assert.deepEqual(readStylePreferences({ getItem: () => value }), empty);
  }
  const blocked = {
    getItem() { throw Error('Blocked'); },
    setItem() { throw Error('Blocked'); },
    removeItem() { throw Error('Blocked'); },
  };
  assert.deepEqual(readStylePreferences(blocked), empty);
  assert.equal(saveStylePreferences(empty, blocked), false);
  assert.equal(saveStylePreferences(null, blocked), false);
});

test('profile matches break feedback ties and stay below a single shared-item point', () => {
  const match = {
    id: 'profile-match', itemIds: ['loafers'],
    styles: ['classic', 'minimalist'], colors: ['neutrals'], priority: 'balanced',
  };
  const other = { id: 'other', itemIds: ['jeans'] };
  const preferences = {
    styles: ['classic', 'minimalist', 'bold'], colors: ['neutrals', 'pastels'], priority: 'balanced',
  };
  const tied = rankOutfits([other, match], [], preferences);
  assert.deepEqual(tied.map(({ outfit, score }) => [outfit.id, score]), [['profile-match', 0.75], ['other', 0]]);
  assert.deepEqual(tied[0].matches, { styles: ['classic', 'minimalist'], colors: ['neutrals'], priority: 'balanced' });
  const feedback = [{ id: 'related', itemIds: ['jeans'], reaction: 'up' }];
  assert.deepEqual(rankOutfits([match, other], feedback, preferences).map(({ score }) => score), [1, 0.75]);
  assert.equal(rankOutfits([match], [{ ...match, reaction: 'down' }], preferences)[0].score, -2.25);
});
