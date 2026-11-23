const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readOutfitContext, filterOutfitsByContext } = require('../outfit-context.js');
const { rankOutfits } = require('../outfit-ranking.js');
const { readOutfitFeedback } = require('../outfit-feedback.js');
const { readStylePreferences } = require('../style-preferences-store.js');

test('integration: catalog context stays within the occasion and clearing restores personalization', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'outfits.html'), 'utf8');
  const catalog = [...html.matchAll(/<div class="outfit-card"([^>]+)>([\s\S]*?)data-outfit-id="([^"]+)"/g)]
    .map(([, attributes, markup, id]) => {
      const tags = Object.fromEntries([...attributes.matchAll(/data-([\w-]+)="([^"]+)"/g)]
        .map(([, key, value]) => [key, value.split(' ')]));
      return {
        id, context: tags, occasions: tags.occasions, styles: tags.styles,
        itemIds: [...markup.matchAll(/data-item-id="([^"]+)"/g)].map(([, id]) => id),
      };
    });
  const data = new Map([
    ['fitcheck:outfit-feedback:everyday-casual', 'up'],
    ['fitcheck:style-preferences', '{"styles":["classic"]}'],
  ]);
  const storage = { getItem: (key) => data.get(key) ?? null };
  const feedback = catalog.map((outfit) => ({ ...outfit, reaction: readOutfitFeedback(outfit.id, storage) }));
  const preferences = readStylePreferences(storage);
  const search = (query) => {
    const params = new URLSearchParams(query);
    const criteria = readOutfitContext(params);
    const candidates = catalog.filter(({ occasions }) => occasions.includes(params.get('occasion')));
    return rankOutfits(filterOutfitsByContext(candidates, criteria), feedback, preferences);
  };
  const ids = (results) => results.map(({ outfit }) => outfit.id);
  assert.deepEqual(ids(search('occasion=casual-weekend')), ['everyday-casual', 'weekend-outing']);
  assert.deepEqual(ids(search('occasion=casual-weekend&weather=hot')), ['weekend-outing']);
  assert.deepEqual(ids(search('occasion=casual-weekend&weather=hot&dress-code=dressy')), []);
  assert.deepEqual(ids(search('occasion=dinner-out&weather=cool&dress-code=dressy&setting=outdoors')), []);
  assert.deepEqual(ids(search('occasion=casual-weekend&weather=&dress-code=')), ['everyday-casual', 'weekend-outing']);
  assert.deepEqual(readStylePreferences(storage), preferences);
});
