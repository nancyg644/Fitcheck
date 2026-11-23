const test = require('node:test');
const assert = require('node:assert/strict');
const {
  localWearDate, readWearHistory, recordWear, undoWear, newestWearsFirst, writeWearRecord,
} = require('../wear-history-store.js');

test('wear dates use the local calendar and are zero-padded', () => {
  assert.equal(localWearDate(new Date(2026, 0, 2, 23, 59)), '2026-01-02');
});

test('wear logging is unique by outfit and date, and undo removes only the requested wear', () => {
  const first = recordWear([], 'work', '2026-11-22');
  assert.equal(recordWear(first, 'work', '2026-11-22'), first);
  assert.equal(recordWear(first, '', '2026-11-22'), first);
  const second = recordWear(first, 'work', '2026-11-23');
  const third = recordWear(second, 'party', '2026-11-23');
  assert.deepEqual(newestWearsFirst(third), [third[2], third[1], third[0]]);
  assert.deepEqual(undoWear(third, 'work', '2026-11-23'), [third[0], third[2]]);
  assert.equal(first.length, 1);
});

test('stored wear history ignores malformed entries, duplicates, and unknown outfits', () => {
  const known = new Set(['work']);
  const valid = { outfitId: 'work', date: '2024-02-29' };
  const data = [valid, valid, null, {}, { outfitId: 'removed', date: valid.date },
    { outfitId: 'work', date: '2026-02-29' }, { outfitId: 'work', date: '2026-2-9' }];
  assert.deepEqual(readWearHistory(known, { getItem: () => JSON.stringify(data) }), [valid]);
  for (const value of ['broken json', '{}', null]) {
    assert.deepEqual(readWearHistory(known, { getItem: () => value }), []);
  }
});

test('failed storage does not prevent an in-memory wear', () => {
  const storage = {
    getItem() { throw new Error('Blocked'); },
    setItem() { throw new Error('Blocked'); },
  };
  const entries = recordWear(readWearHistory(new Set(['work']), storage), 'work', '2026-11-23');
  assert.equal(writeWearRecord('work', '2026-11-23', true, storage), false);
  assert.equal(entries.length, 1);
});
