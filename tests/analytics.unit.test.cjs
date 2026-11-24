const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAnalyticsStore, analyticsTimeout, analyticsDay } = require('../analytics-store.js');
const { createRecommendationTracker } = require('../analytics-session.js');
const { canAttributeWear, summarizeAnalytics, analyticsCsv, analyticsJson } = require('../analytics-metrics.js');

function memoryStorage(values = new Map()) {
  return {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('recommendation sessions survive refresh and filter navigation, then expire after 30 inactive minutes', () => {
  let at = Date.parse('2026-11-24T14:00:00Z');
  let next = 0, tab, entry;
  const id = () => String(++next);
  const storage = memoryStorage();
  const store = createAnalyticsStore(() => storage, () => at, id);
  const navigation = {
    getTab: () => tab, setTab: (value) => { tab = value; },
    getEntry: () => entry, setEntry: (value) => { entry = value; },
  };
  const tracker = () => createRecommendationTracker(store, navigation, () => at, id);
  const details = { occasion: 'work', filters: [], durationMs: 8, eligibleCount: 12 };
  tracker().display(details, ['one']);
  at += 1000;
  tracker().display(details, ['one']);
  assert.equal(store.snapshot().filter((event) => event.type === 'recommendations_displayed').length, 1);
  entry = null;
  tracker().display({ ...details, filters: [{ field: 'weather', value: 'cool' }] }, ['one', 'two']);
  assert.deepEqual(summarizeAnalytics(store.snapshot(), at).rows.map((row) => [row.searches, row.impressions]), [[2, 3]]);
  at += analyticsTimeout;
  tracker().display(details, ['one']);
  assert.equal(summarizeAnalytics(store.snapshot(), at).totalSessions, 2);
});

test('attribution requires an explicit choice for the same outfit and a valid date and link window', () => {
  const at = Date.parse('2026-11-24T14:00:00Z');
  const choice = { type: 'outfit_selected', timestamp: new Date(at).toISOString(),
    metadata: { outfitId: 'office', choiceDate: '2026-11-24', lastWearDate: '2026-12-08' } };
  assert.equal(canAttributeWear(choice, 'office', '2026-11-24', at), true);
  assert.equal(canAttributeWear(choice, 'office', '2026-11-25', at + 4 * analyticsDay), true);
  assert.equal(canAttributeWear(choice, 'office', '2026-11-23', at + analyticsDay), false);
  assert.equal(canAttributeWear(choice, 'office', '2026-12-09', at + analyticsDay), false);
  assert.equal(canAttributeWear(choice, 'office', '2026-11-24', at + 14 * analyticsDay), false);
  assert.equal(canAttributeWear(choice, 'other', '2026-11-24', at), false);
  assert.equal(canAttributeWear(null, 'office', '2026-11-24', at), false);
});

test('the final OEC counts only closed sessions and follows edits and deletions per wear record', () => {
  const start = Date.parse('2026-11-24T14:00:00Z');
  const now = start + 15 * analyticsDay;
  const event = (type, id, sessionId, at, metadata = {}) =>
    ({ type, eventId: id, sessionId, timestamp: new Date(at).toISOString(), metadata });
  const row = { outfitId: 'office', choiceDate: '2026-11-24', lastWearDate: '2026-12-08' };
  const wear = { wearId: 'wear1', outfitId: 'office', wearDate: '2026-11-25', linkedAt: start + analyticsDay, choiceId: 'choice1' };
  const events = [
    event('recommendation_session_started', 'closed', 'closed', start),
    event('recommendation_session_started', 'recent', 'recent', now - analyticsDay),
    event('outfit_selected', 'choice1', 'closed', start + 30_000, row),
    event('outfit_selected', 'choice2', 'recent', now - analyticsDay,
      { ...row, choiceDate: '2026-12-08', lastWearDate: '2026-12-22' }),
    event('wear_logged', 'manual', null, start + analyticsDay, { ...wear, wearId: 'manual', choiceId: null, revision: 1 }),
    event('wear_logged', 'linked', null, start + analyticsDay, { ...wear, revision: 1 }),
    event('wear_logged', 'recent-wear', null, now, {
      ...wear, wearId: 'wear2', wearDate: '2026-12-08', linkedAt: now, choiceId: 'choice2', revision: 1,
    }),
  ];
  const summary = summarizeAnalytics(events, now);
  assert.equal(summary.totalSessions, 2);
  assert.equal(summary.selectionRate, 1);
  assert.equal(summary.preliminaryWearRate, 1);
  assert.equal(summary.finalWearRate, 1);
  assert.equal(summary.openSessions, 1);
  assert.equal(summary.averageSelectionSeconds, 15);
  events.push(event('wear_edited', 'edited', null, now, { ...wear, wearDate: '2026-11-23', revision: 2 }));
  assert.equal(summarizeAnalytics(events, now).finalWearRate, 0);
  assert.equal(summarizeAnalytics(events, now).preliminaryWearRate, 0.5);
  events.push(event('wear_edited', 'restored', null, now, { ...wear, revision: 3 }));
  assert.equal(summarizeAnalytics(events, now).finalWearRate, 1);
  events.push(event('wear_deleted', 'deleted', null, now, { ...wear, revision: 4 }));
  assert.equal(summarizeAnalytics(events, now).finalWearRate, 0);
  assert.equal(summarizeAnalytics(events, start + analyticsDay).finalWearRate, null);
});

test('independent writers keep both events and clearing only resets analytics', () => {
  const storage = memoryStorage(new Map([['fitcheck:saved-outfits:office', '1']]));
  const at = () => Date.parse('2026-11-24T14:00:00Z');
  const a = createAnalyticsStore(() => storage, at, () => 'a');
  const b = createAnalyticsStore(() => storage, at, () => 'b');
  a.record('recommendation_session_started', 'a', {}, 'a');
  b.record('recommendation_session_started', 'b', {}, 'b');
  a.record('recommendation_session_started', 'a', {}, 'a');
  assert.equal(a.snapshot().length, 2);
  const summary = summarizeAnalytics(b.snapshot(), at());
  assert.match(analyticsCsv(summary.rows), /sessionId,startedAt,finalized,wore/);
  assert.equal(JSON.parse(analyticsJson(a.snapshot(), summary)).events.length, 2);
  assert.equal(b.clear(), true);
  assert.deepEqual(a.snapshot(), []);
  assert.equal(storage.getItem('fitcheck:saved-outfits:office'), '1');
  assert.equal(a.record('show_more_selected', 'a', {}, 'old', 'initial'), null);
});

test('unavailable storage is safe and yields no analytics', () => {
  const store = createAnalyticsStore(() => { throw Error('Blocked'); });
  assert.equal(store.record('application_error', null, { code: 'script_error' }), null);
  assert.equal(store.snapshot(), null);
  assert.equal(store.clear(), false);
});
