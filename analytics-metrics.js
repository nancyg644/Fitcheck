const metricWindows = typeof module !== 'undefined' ? require('./analytics-store.js') :
  { analyticsFollowUp, analyticsTimeout };

function canAttributeWear(choice, outfitId, wearDate, linkedAt) {
  if (!choice || choice.type !== 'outfit_selected' || choice.metadata.outfitId !== outfitId) return false;
  const choiceAt = Date.parse(choice.timestamp);
  if (typeof wearDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(wearDate)) return false;
  const date = new Date(`${wearDate}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === wearDate &&
    wearDate >= choice.metadata.choiceDate && wearDate <= choice.metadata.lastWearDate &&
    linkedAt >= choiceAt && linkedAt < choiceAt + metricWindows.analyticsFollowUp;
}

function summarizeAnalytics(events, now = Date.now()) {
  const sessions = new Map();
  const choices = new Map();
  const wears = new Map();
  const occasions = new Map();
  const filters = new Map();
  const timing = [];
  const errors = new Map();
  function count(map, key) { map.set(key, (map.get(key) ?? 0) + 1); }
  const ordered = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (const event of ordered) {
    if (event.type !== 'recommendation_session_started') continue;
    const at = Date.parse(event.timestamp);
    sessions.set(event.sessionId, { sessionId: event.sessionId, startedAt: event.timestamp, at,
      lastActivity: at, deadline: at + metricWindows.analyticsFollowUp, selectedAt: null, wore: false,
      searches: 0, emptySearches: 0, impressions: 0, showMore: 0, liked: false, saved: false });
  }
  for (const { type, sessionId, eventId, timestamp, metadata: data } of ordered) {
    const at = Date.parse(timestamp);
    const session = sessions.get(sessionId);
    if (type === 'application_error') count(errors, data.code);
    if (['wear_logged', 'wear_edited', 'wear_deleted'].includes(type)) {
      const prior = wears.get(data.wearId);
      if (!prior || data.revision >= prior.data.revision) wears.set(data.wearId, { type, data });
      continue;
    }
    if (!session) continue;
    session.lastActivity = Math.max(session.lastActivity, at);
    switch (type) {
      case 'occasion_selected': count(occasions, data.occasion); break;
      case 'context_filters_applied':
        session.searches++;
        for (const { field, value } of data.filters) count(filters, `${field}=${value}`);
        break;
      case 'no_recommendations_found': session.emptySearches++; break;
      case 'recommendations_displayed': session.impressions += data.outfitIds.length; break;
      case 'show_more_selected': session.showMore++; break;
      case 'outfit_feedback_changed': session.liked ||= data.reaction === 'up'; break;
      case 'outfit_save_changed': session.saved ||= data.saved === true; break;
      case 'outfit_selected':
        choices.set(eventId, { type, sessionId, timestamp, metadata: data });
        session.selectedAt ??= at;
        session.deadline = Math.max(session.deadline, at + metricWindows.analyticsFollowUp);
        break;
      case 'recommendation_generation_timed':
        if (Number.isFinite(data.durationMs)) timing.push(data.durationMs);
        break;
    }
  }
  for (const { type, data } of wears.values()) {
    const choice = choices.get(data.choiceId);
    if (type !== 'wear_deleted' && canAttributeWear(choice, data.outfitId, data.wearDate, data.linkedAt)) {
      sessions.get(choice.sessionId).wore = true;
    }
  }
  const rows = [...sessions.values()].map((session) => ({
    ...session,
    finalized: now >= session.deadline && now - session.lastActivity >= metricWindows.analyticsTimeout,
    timeToSelectSeconds: session.selectedAt === null ? null : (session.selectedAt - session.at) / 1000,
  }));
  const completed = rows.filter(({ finalized }) => finalized);
  const selection = rows.filter(({ selectedAt }) => selectedAt !== null);
  const exposed = rows.filter(({ impressions }) => impressions > 0);
  const sum = (key, list = rows) => list.reduce((total, row) => total + row[key], 0);
  const rate = (n, d) => d ? n / d : null;
  const frequencies = (map) => [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  timing.sort((a, b) => a - b);
  const percentile = (fraction) => timing.length ? timing[Math.ceil(timing.length * fraction) - 1] : null;
  return {
    rows, totalSessions: rows.length, openSessions: rows.length - completed.length, finalizedSessions: completed.length,
    selectionRate: rate(selection.length, rows.length),
    preliminaryWearRate: rate(rows.filter(({ wore }) => wore).length, rows.length),
    finalWearRate: rate(completed.filter(({ wore }) => wore).length, completed.length),
    averageSelectionSeconds: rate(sum('timeToSelectSeconds', selection), selection.length),
    likeRate: rate(exposed.filter(({ liked }) => liked).length, exposed.length),
    saveRate: rate(exposed.filter(({ saved }) => saved).length, exposed.length),
    noResultsRate: rate(sum('emptySearches'), sum('searches')),
    showMoreRate: rate(rows.filter(({ showMore }) => showMore > 0).length, rows.length),
    showMoreClicks: sum('showMore'), occasions: frequencies(occasions), filters: frequencies(filters),
    generation: { count: timing.length, medianMs: percentile(0.5), p95Ms: percentile(0.95) },
    errors: frequencies(errors),
  };
}

function analyticsCsv(rows) {
  const columns = ['sessionId', 'startedAt', 'finalized', 'wore', 'timeToSelectSeconds',
    'searches', 'emptySearches', 'impressions', 'showMore', 'liked', 'saved'];
  const cell = (value) => {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return [columns.join(','), ...rows.map((row) => columns.map((key) => cell(row[key])).join(','))].join('\r\n');
}

function analyticsJson(events, summary, exportedAt = new Date().toISOString()) {
  const { rows, ...metrics } = summary;
  return JSON.stringify({ schemaVersion: 1, exportedAt, metrics, events }, null, 2);
}

if (typeof module !== 'undefined') module.exports = { canAttributeWear, summarizeAnalytics, analyticsCsv, analyticsJson };
