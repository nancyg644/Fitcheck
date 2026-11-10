const test = require('node:test');
const assert = require('node:assert/strict');
const { nextSelection } = require('../outfit-feedback.js');

test('unit: Like selects up; Dislike replaces Like with down', () => {
  const liked = nextSelection(null, 'up');
  assert.equal(liked, 'up');
  assert.equal(nextSelection(liked, 'down'), 'down');
  // Preserve the existing click-again-to-clear behavior.
  assert.equal(nextSelection(liked, 'up'), null);
});
