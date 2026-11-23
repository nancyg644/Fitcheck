const test = require('node:test');
const assert = require('node:assert/strict');
const {
  localWearDate, canLogWearDate, readWearHistory, newWearEntry, newestWearsFirst, writeWearEntry,
} = require('../wear-history-store.js');

test('wear dates use the local calendar and are zero-padded', () => {
  assert.equal(localWearDate(new Date(2026, 0, 2, 23, 59)), '2026-01-02');
});

test('wear dates allow today and past days and reject invalid or future dates', () => {
  assert.equal(canLogWearDate('2026-11-23', '2026-11-23'), true);
  assert.equal(canLogWearDate('2024-02-29', '2026-11-23'), true);
  for (const value of ['2026-11-24', '2026-02-29', '2026-2-02', '']) {
    assert.equal(canLogWearDate(value, '2026-11-23'), false);
  }
});

test('same-day wears have independent IDs and history sorts by date', () => {
  const first = newWearEntry('work', '2026-11-22');
  const second = newWearEntry('work', '2026-11-23');
  const third = newWearEntry('work', '2026-11-23');
  assert.equal(new Set([first.id, second.id, third.id]).size, 3);
  assert.deepEqual(newestWearsFirst([first, second, third]).map(({ date }) => date),
    ['2026-11-23', '2026-11-23', '2026-11-22']);
});

test('stored wear history ignores malformed entries, duplicates, and unknown outfits', () => {
  const known = new Set(['work']);
  const valid = { outfitId: 'work', date: '2024-02-29' };
  const data = [valid, valid, null, {}, { outfitId: 'removed', date: valid.date },
    { outfitId: 'work', date: '2026-02-29' }, { outfitId: 'work', date: '2026-2-9' }];
  assert.deepEqual(readWearHistory(known, { getItem: () => JSON.stringify(data) }), [
    { ...valid, id: 'legacy:2024-02-29:work', createdAt: 0 },
  ]);
  for (const value of ['broken json', '{}', null]) {
    assert.deepEqual(readWearHistory(known, { getItem: () => value }), []);
  }
});

test('failed storage does not prevent an in-memory wear', () => {
  const storage = {
    getItem() { throw new Error('Blocked'); },
    setItem() { throw new Error('Blocked'); },
  };
  const entry = newWearEntry('work', '2024-11-23');
  assert.equal(writeWearEntry(entry.id, entry, storage), false);
  assert.deepEqual(readWearHistory(new Set(['work']), storage), []);
});
