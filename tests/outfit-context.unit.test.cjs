const test = require('node:test');
const assert = require('node:assert/strict');
const { readOutfitContext, matchOutfitContext } = require('../outfit-context.js');
const { rankOutfits, selectContextResults } = require('../outfit-ranking.js');

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

test('context outranks positive feedback and profile matches, which still break context ties', () => {
  const preferred = { id: 'preferred', itemIds: [], styles: ['classic'], context: { weather: ['warm'] } };
  const warmCoat = { id: 'coat', itemIds: [], context: { weather: ['cold'] } };
  const feedback = [{ ...preferred, reaction: 'up' }, { ...warmCoat, reaction: 'down' }];
  const profile = { styles: ['classic'] };
  const selected = criteria('weather=cold');
  const ranked = rankOutfits([preferred, warmCoat], feedback, profile, selected);
  assert.deepEqual(ranked.map(({ outfit }) => outfit.id), ['coat', 'preferred']);
  assert.deepEqual(selectContextResults(ranked, selected), { useFallback: false, results: ranked });

  const unmatched = criteria('weather=hot');
  const fallback = rankOutfits([warmCoat, preferred], feedback, profile, unmatched);
  assert.deepEqual(selectContextResults(fallback, unmatched), { useFallback: true, results: fallback });
  assert.deepEqual(fallback.map(({ outfit }) => outfit.id), ['preferred', 'coat']);
});

test('when no outfit meets all criteria, only the closest alternatives are shown', () => {
  const selected = criteria('weather=cold&activity=walking');
  const coat = { id: 'coat', itemIds: [], context: { weather: ['cold'], activity: ['seated'] } };
  const evening = { id: 'evening', itemIds: [], context: { weather: ['warm'], activity: ['seated'] } };
  const ranked = rankOutfits([evening, coat], [{ ...evening, reaction: 'up' }], {}, selected);
  assert.deepEqual(selectContextResults(ranked, selected), { useFallback: true, results: [ranked[0]] });
  assert.deepEqual(ranked[0].context.missed, [{ field: 'activity', value: 'walking' }]);
  assert.deepEqual(selectContextResults([], selected), { useFallback: false, results: [] });
});
