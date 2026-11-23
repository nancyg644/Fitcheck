const test = require('node:test');
const assert = require('node:assert/strict');
const { rankOutfits } = require('../outfit-ranking.js');

const outfit = (id, itemIds, reaction) => ({ id, itemIds, reaction });
const scores = (candidates, feedback) => rankOutfits(candidates, feedback)
  .map(({ outfit: { id }, score }) => [id, score]);

test('direct reactions score three points and do not count their own items', () => {
  const liked = outfit('liked', ['tee', 'jeans'], 'up');
  const disliked = outfit('disliked', ['dress', 'boots'], 'down');
  const neutral = outfit('neutral', ['scarf']);
  assert.deepEqual(scores([disliked, liked, neutral], [liked, disliked]), [
    ['liked', 3], ['neutral', 0], ['disliked', -3],
  ]);
});

test('shared items count once per item and reaction, and opposing reactions cancel', () => {
  const candidate = outfit('candidate', ['tee', 'tee', 'jeans', 'boots', 'scarf']);
  const feedback = [
    outfit('first-like', ['tee', 'jeans', 'boots'], 'up'),
    outfit('second-like', ['tee'], 'up'),
    outfit('dislike', ['jeans', 'boots', 'scarf'], 'down'),
  ];
  assert.deepEqual(scores([candidate], feedback), [['candidate', 0]]);
  assert.deepEqual(scores([candidate], feedback.slice(0, 2)), [['candidate', 3]]);
  assert.deepEqual(scores([candidate], feedback.slice(2)), [['candidate', -3]]);
});

test('missing or invalid reactions preserve the original order of tied cards', () => {
  const candidates = [outfit('b', ['tee']), outfit('a', ['tee'])];
  assert.deepEqual(scores(candidates, []), [['b', 0], ['a', 0]]);
  assert.deepEqual(scores(candidates, [
    outfit('invalid', ['tee'], 'unknown'), outfit('unrated', ['tee']),
    outfit('liked', ['tee'], 'up'),
  ]), [['b', 1], ['a', 1]]);
});
