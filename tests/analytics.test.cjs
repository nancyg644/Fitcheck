const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAnalyticsStore, analyticsDay } = require('../analytics-store.js');
const { createRecommendationTracker } = require('../analytics-session.js');
const { summarizeAnalytics, analyticsJson } = require('../analytics-metrics.js');

test('integration: recommendation activity and a delayed linked wear produce exportable session metrics', () => {
  const data = new Map();
  const storage = {
    get length() { return data.size; },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
  let at = Date.parse('2026-11-24T14:00:00Z');
  let next = 0;
  const id = () => String(++next);
  const store = createAnalyticsStore(() => storage, () => at, id);
  const createTab = () => {
    let state, entry;
    return createRecommendationTracker(store, {
      getTab: () => state, setTab: (value) => { state = value; },
      getEntry: () => entry, setEntry: (value) => { entry = value; },
    }, () => at, id);
  };
  const first = createTab();
  const second = createTab();
  const details = { occasion: 'work', filters: [{ field: 'weather', value: 'cool' }], eligibleCount: 7, durationMs: 8 };
  const initial = ['one', 'two', 'three', 'four', 'five', 'six'];
  first.display(details, initial);
  second.display({ ...details, occasion: 'party', filters: [], eligibleCount: 0, durationMs: 30 }, []);
  at += 2000;
  first.activity(details, initial, 'show_more_selected', { requestedBatch: 2 });
  const visible = [...initial, 'seven'];
  first.display(details, visible);
  first.activity(details, visible, 'outfit_feedback_changed', { outfitId: 'seven', reaction: 'up' });
  first.activity(details, visible, 'outfit_save_changed', { outfitId: 'seven', saved: true });
  const choice = first.choose(details, visible, 'seven', { choiceDate: '2026-11-24', lastWearDate: '2026-12-08' });
  at += 2 * analyticsDay;
  store.record('wear_logged', null, { wearId: 'wear', outfitId: 'seven', wearDate: '2026-11-25',
    revision: 1, linkedAt: at, choiceId: choice.eventId, sourceSessionId: choice.sessionId });
  store.record('application_error', null, { code: 'script_error' });
  const snap = store.snapshot();
  const metrics = summarizeAnalytics(snap, at);
  assert.equal(metrics.totalSessions, 2);
  assert.equal(metrics.openSessions, 2);
  assert.equal(metrics.selectionRate, 0.5);
  assert.equal(metrics.preliminaryWearRate, 0.5);
  assert.equal(metrics.finalWearRate, null);
  assert.equal(metrics.averageSelectionSeconds, 2);
  assert.equal(metrics.likeRate, 1);
  assert.equal(metrics.saveRate, 1);
  assert.equal(metrics.noResultsRate, 0.5);
  assert.equal(metrics.showMoreRate, 0.5);
  assert.deepEqual(metrics.generation, { count: 2, medianMs: 8, p95Ms: 30 });
  assert.deepEqual(metrics.occasions, [['party', 1], ['work', 1]]);
  assert.deepEqual(metrics.filters, [['weather=cool', 1]]);
  assert.deepEqual(metrics.errors, [['script_error', 1]]);
  assert.equal(JSON.parse(analyticsJson(snap, metrics)).events.find((event) => event.type === 'wear_logged')
    .metadata.choiceId, choice.eventId);
});
