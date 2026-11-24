const test = require('node:test');
const assert = require('node:assert/strict');
const { wardrobeCatalog } = require('../wardrobe-catalog.js');
const { generateOutfits, generatedOutfitId, resolveGeneratedOutfit, coordinatedColors } = require('../outfit-generator.js');
const { matchOutfitContext, readOutfitContext } = require('../outfit-context.js');
const { rankOutfits } = require('../outfit-ranking.js');
const { variedOutfitOrder } = require('../outfit-variety.js');

const catalog = new Map(wardrobeCatalog.map((item) => [item.id, item]));
const query = (value) => readOutfitContext(new URLSearchParams(value));
const generate = (occasion, criteria = []) => generateOutfits(wardrobeCatalog, occasion, criteria, matchOutfitContext);

test('wardrobe IDs are unique and all 51 pieces have recommendation attributes', () => {
  assert.equal(wardrobeCatalog.length, 51);
  assert.equal(catalog.size, 51);
  for (const item of wardrobeCatalog) {
    assert.ok(item.name && item.color && item.shape);
    for (const key of ['occasions', 'dressCodes', 'styles', 'setting', 'activity', 'weather', 'seasons', 'places']) {
      assert.ok(item[key].length, `${item.id} lacks ${key}`);
    }
  }
});

test('generated outfits have a wearable base and footwear, without clashing palettes or double denim', () => {
  const outfits = generate('');
  assert.ok(outfits.length > 0 && outfits.length <= 2 * (12 * 11 + 6));
  assert.equal(new Set(outfits.map(({ id }) => id)).size, outfits.length);
  assert.ok(outfits.some(({ items }) => items.some(({ category }) => category === 'outerwear')));
  assert.ok(outfits.some(({ items }) => items.some(({ category }) => category === 'dresses')));
  assert.ok(outfits.some(({ items }) => items.some(({ category }) => category === 'accessories')));
  for (const { items, context } of outfits) {
    const slots = items.map(({ category }) => category);
    assert.equal(slots.includes('shoes'), true);
    assert.equal(slots.includes('dresses'), !slots.includes('tops'));
    assert.equal(slots.includes('tops'), slots.includes('bottoms'));
    assert.equal(items.filter(({ color }) => color === 'denim').length <= 1, true);
    assert.equal(coordinatedColors(items), true);
    assert.ok(context['dress-code'].length && context.weather.length && context.setting.length);
    if (items.some(({ shape }) => shape === 'gown')) assert.ok(items.some(({ shape }) => shape === 'heel'));
  }
  assert.equal(coordinatedColors([catalog.get('pink-blouse'), catalog.get('olive-cargo-pants')]), false);
});

test('strict contextual filters apply together, including walking-friendly shoes and Both settings', () => {
  const criteria = query('weather=cool&dress-code=casual&setting=both&activity=walking');
  const results = generate('casual-weekend', criteria);
  assert.ok(results.length > 0);
  for (const outfit of results) {
    assert.ok(outfit.occasions.includes('casual-weekend'));
    assert.deepEqual(matchOutfitContext(outfit.context, criteria).missed, []);
    assert.ok(outfit.items.find(({ category }) => category === 'shoes').activity.includes('walking'));
  }
  assert.deepEqual(generate('dinner-out', query('weather=cool&dress-code=dressy&setting=outdoors')), []);
  assert.deepEqual(generate('party', query('weather=cold')), []);
});

test('stable IDs resolve outside the current query and reject invalid combinations', () => {
  const [outfit] = generate('party');
  assert.equal(generatedOutfitId([...outfit.items].reverse()), outfit.id);
  assert.deepEqual(resolveGeneratedOutfit(outfit.id, catalog).itemIds, outfit.itemIds);
  assert.equal(resolveGeneratedOutfit('gen-v1:white-tshirt+blue-jeans', catalog), null);
  assert.equal(resolveGeneratedOutfit('gen-v1:unknown+white-sneakers', catalog), null);
});

test('the preferred outfit remains first and variety suppresses repeated bases deterministically', () => {
  const outfits = generate('work').map((outfit) => ({ ...outfit, generated: true }));
  const chosen = outfits.at(-1);
  const feedback = [{ ...chosen, reaction: 'up' }];
  const rank = () => variedOutfitOrder(rankOutfits(outfits, feedback, { styles: ['classic'] }))
    .map(({ outfit }) => outfit);
  const ordered = rank();
  assert.equal(ordered[0].id, chosen.id);
  assert.deepEqual(ordered.map(({ id }) => id), rank().map(({ id }) => id));
  assert.equal(new Set(ordered.map(({ base }) => base)).size, ordered.length);
  assert.ok(new Set(ordered.slice(0, 6).map(({ items }) => items[0].id)).size >= 3);
});

test('a liked Work variant survives the cap only while it passes compatibility and every filter', () => {
  const id = 'gen-v1:pink-blouse+sand-linen-trousers+white-sneakers+pearl-drop-earrings';
  const incompatible = 'gen-v1:pink-blouse+sand-linen-trousers+black-running-shoes';
  const liked = new Set([id, incompatible]);
  const contains = (occasion, criteria) =>
    generateOutfits(wardrobeCatalog, occasion, criteria, matchOutfitContext, liked).some((outfit) => outfit.id === id);
  assert.ok(generate('work', query('activity=walking')).some((outfit) => outfit.id === id));
  assert.equal(generate('work').some((outfit) => outfit.id === id), false);
  assert.equal(contains('work', []), true);
  assert.equal(contains('work', query('setting=indoors&dress-code=dressy')), false);
  assert.equal(contains('party', []), false);
  assert.equal(generateOutfits(wardrobeCatalog, 'work', [], matchOutfitContext, liked)
    .some((outfit) => outfit.id === incompatible), false);
});

test('extra liked variants remain available after the distinct garment bases', () => {
  const outfits = generate('work');
  const variants = outfits.filter(({ base }) => base === outfits[0].base);
  assert.equal(variants.length, 2);
  const results = variedOutfitOrder(rankOutfits(outfits.map((outfit) => ({ ...outfit, generated: true })),
    variants.map((outfit) => ({ ...outfit, reaction: 'up' }))));
  assert.equal(new Set(results.slice(0, -1).map(({ outfit }) => outfit.base)).size, results.length - 1);
  assert.equal(results.filter(({ outfit }) => outfit.base === variants[0].base).length, 2);
});
