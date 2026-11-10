const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'outfit-feedback.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'outfits.html'), 'utf8');
const key = (id) => `fitcheck:outfit-feedback:${id}`;

// A tiny stand-in for the browser lets us run the real script without dependencies.
// Read the actual HTML so the tests also check that every outfit has its controls.
function loadPage(saved = new Map(), storageBlocked = false) {
  const groups = [...html.matchAll(/<div class="outfit-feedback"[^>]*data-outfit-id="([^"]+)"[^>]*>([\s\S]*?)<\/div>/g)].map((match) => {
    const buttons = [...match[2].matchAll(/<button[^>]*data-reaction="([^"]+)"[^>]*>/g)].map(([tag, reaction]) => ({
      dataset: { reaction },
      pressed: 'false',
      setAttribute(name, value) { assert.equal(name, 'aria-pressed'); this.pressed = value; },
      addEventListener(event, handler) { assert.equal(event, 'click'); this.click = handler; },
      tag,
    }));
    return { dataset: { outfitId: match[1] }, buttons, querySelectorAll: () => buttons };
  });
  const localStorage = {
    getItem(id) { if (storageBlocked) throw Error('Blocked'); return saved.get(id) ?? null; },
    setItem(id, value) { if (storageBlocked) throw Error('Blocked'); saved.set(id, value); },
    removeItem(id) { if (storageBlocked) throw Error('Blocked'); saved.delete(id); },
  };
  vm.runInNewContext(script, { document: { querySelectorAll: () => groups }, localStorage });
  return groups;
}

function states(group) { return group.buttons.map((button) => button.pressed); }

test('integration: Like, switch to Dislike, and restore saved selection on page initialization', () => {
  const saved = new Map();
  const group = loadPage(saved)[0];
  group.buttons[0].click();
  assert.deepEqual(states(group), ['true', 'false']);
  assert.equal(saved.get(key('everyday-casual')), 'up');
  group.buttons[1].click();
  assert.deepEqual(states(group), ['false', 'true']);
  assert.equal(saved.get(key('everyday-casual')), 'down');
  assert.deepEqual(states(loadPage(saved)[0]), ['false', 'true']);
});

test('every existing outfit has two labeled, initially unselected buttons', () => {
  const groups = loadPage();
  assert.equal(groups.length, (html.match(/class="outfit-card"/g) || []).length);
  assert.equal(groups.length, 3);
  assert.equal(new Set(groups.map((group) => group.dataset.outfitId)).size, 3);
  assert.match(html, /<script src="outfit-feedback.js"><\/script>/);
  groups.forEach((group) => {
    assert.deepEqual(group.buttons.map((button) => button.dataset.reaction), ['up', 'down']);
    assert.deepEqual(states(group), ['false', 'false']);
    group.buttons.forEach((button) => {
      assert.match(button.tag, /type="button"/);
      assert.match(button.tag, /aria-label="Thumbs (up|down) for [^"]+"/);
      assert.match(button.tag, /aria-pressed="false"/);
    });
  });
});

for (const [index, reaction] of ['up', 'down'].entries()) {
  test(`${reaction}: select, restore after refresh, and click again to remove`, () => {
    const saved = new Map();
    let group = loadPage(saved)[0];
    group.buttons[index].click();
    assert.equal(saved.get(key('everyday-casual')), reaction);
    assert.equal(group.buttons[index].pressed, 'true');
    group = loadPage(saved)[0];
    assert.equal(group.buttons[index].pressed, 'true');
    group.buttons[index].click();
    assert.deepEqual(states(group), ['false', 'false']);
    assert.equal(saved.has(key('everyday-casual')), false);
    assert.deepEqual(states(loadPage(saved)[0]), ['false', 'false']);
  });
}

test('switching reactions replaces the previous selection in both directions', () => {
  const saved = new Map();
  const group = loadPage(saved)[0];
  group.buttons[0].click();
  group.buttons[1].click();
  assert.deepEqual(states(group), ['false', 'true']);
  assert.equal(saved.get(key('everyday-casual')), 'down');
  group.buttons[0].click();
  assert.deepEqual(states(group), ['true', 'false']);
  assert.equal(saved.get(key('everyday-casual')), 'up');
});

test('outfits keep independent feedback through changes and refreshes', () => {
  const saved = new Map();
  const groups = loadPage(saved);
  groups[0].buttons[0].click();
  groups[1].buttons[1].click();
  groups[2].buttons[0].click();
  groups[0].buttons[0].click();
  assert.deepEqual(loadPage(saved).map(states), [['false', 'false'], ['false', 'true'], ['true', 'false']]);
});

test('unexpected saved values are ignored', () => {
  assert.deepEqual(states(loadPage(new Map([[key('everyday-casual'), 'invalid']]))[0]), ['false', 'false']);
});

test('buttons still select, switch, and clear when storage is unavailable', () => {
  const group = loadPage(new Map(), true)[0];
  group.buttons[0].click();
  assert.deepEqual(states(group), ['true', 'false']);
  group.buttons[1].click();
  assert.deepEqual(states(group), ['false', 'true']);
  group.buttons[1].click();
  assert.deepEqual(states(group), ['false', 'false']);
});
