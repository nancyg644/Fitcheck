const test = require('node:test');
const assert = require('node:assert/strict');
const { readOutfitContext, matchOutfitContext, filterOutfitsByContext } = require('../outfit-context.js');
const { rankOutfits } = require('../outfit-ranking.js');

const criteria = (query) => readOutfitContext(new URLSearchParams(query));

test('individually selected context fields match outfit tags and ignore unsupported values', () => {
  const tags = { weather: ['warm', 'cool'], 'dress-code': ['casual'], setting: ['outdoors'], activity: ['walking'] };
  for (const query of ['weather=cool', 'dress-code=casual', 'setting=outdoors', 'activity=walking']) {
    assert.deepEqual(matchOutfitContext(tags, criteria(query)), { matched: criteria(query), missed: [] });
  }
  assert.deepEqual(criteria('weather=freezing&dress-code=&activity=no-preference&occasion=work'), []);
  assert.deepEqual(matchOutfitContext({}, criteria('weather=cool')),
    { matched: [], missed: [{ field: 'weather', value: 'cool' }] });
});

test('combined context counts one match per criterion, and Both requires both settings', () => {
  const selected = criteria('weather=cool&dress-code=dressy&setting=both&activity=seated');
  const tags = { weather: ['cool'], 'dress-code': ['smart-casual'], setting: ['indoors', 'outdoors'], activity: ['seated'] };
  assert.deepEqual(matchOutfitContext(tags, selected), {
    matched: [selected[0], selected[2], selected[3]], missed: [selected[1]],
  });
  assert.deepEqual(matchOutfitContext({ setting: ['indoors'] }, criteria('setting=both')).matched, []);
});

test('context excludes even a liked outfit and personalization ranks the remaining outfits', () => {
  const preferred = { id: 'preferred', itemIds: [], styles: ['classic'], context: { weather: ['warm'] } };
  const warmCoat = { id: 'coat', itemIds: [], context: { weather: ['cold'] } };
  const parka = { id: 'parka', itemIds: [], styles: ['classic'], context: { weather: ['cold'] } };
  const feedback = [{ ...preferred, reaction: 'up' }, { ...warmCoat, reaction: 'down' }];
  const profile = { styles: ['classic'] };
  const selected = criteria('weather=cold');
  const ranked = rankOutfits(filterOutfitsByContext([preferred, warmCoat, parka], selected), feedback, profile);
  assert.deepEqual(ranked.map(({ outfit }) => outfit.id), ['parka', 'coat']);
});

test('a partial match is excluded, and no selections preserve all outfits', () => {
  const selected = criteria('weather=cold&activity=walking');
  const coat = { id: 'coat', itemIds: [], context: { weather: ['cold'], activity: ['seated'] } };
  const evening = { id: 'evening', itemIds: [], context: { weather: ['warm'], activity: ['seated'] } };
  assert.deepEqual(filterOutfitsByContext([evening, coat], selected), []);
  assert.deepEqual(filterOutfitsByContext([evening, coat], []), [evening, coat]);
});
