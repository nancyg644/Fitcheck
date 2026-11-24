globalThis.fitcheckAnalytics = (() => {
  const store = createAnalyticsStore(() => localStorage);
  let lastEntry = history.state?.fitcheckSearch;
  const navigation = {
    getTab() {
      try { return JSON.parse(sessionStorage.getItem(analyticsTabKey)); } catch { return null; }
    },
    setTab(tab) {
      try { sessionStorage.setItem(analyticsTabKey, JSON.stringify(tab)); } catch { /* still works on this page */ }
    },
    getEntry: () => history.state?.fitcheckSearch,
    setEntry(entry) {
      lastEntry = entry;
      try { history.replaceState({ ...history.state, fitcheckSearch: entry }, ''); } catch { /* keep in memory */ }
    },
  };
  const tracker = createRecommendationTracker(store, navigation);
  let details;
  let shown = [];
  const isBrowse = () => !['#saved', '#wear-history'].includes(location.hash);

  function reportError(code) {
    const epoch = store.epoch();
    store.record('application_error', null, { code, page: document.body.dataset.analyticsPage || 'outfits' },
      `error:${epoch}:${document.body.dataset.analyticsPage}:${code}:${Math.floor(Date.now() / 60_000)}`, epoch);
  }

  // Analytics faults stay isolated from rendering and product storage.
  function safe(action, fallback = null) {
    return (...args) => {
      try { return action(...args); }
      catch { reportError('analytics_error'); return fallback; }
    };
  }

  function logDate(value) {
    return [String(value.getFullYear()).padStart(4, '0'), String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0')].join('-');
  }

  function recordActivity(type, metadata) {
    if (details && isBrowse() && (!metadata.outfitId || shown.includes(metadata.outfitId))) {
      return tracker.activity(details, shown, type, metadata);
    }
    return store.record(type, null, metadata);
  }

  window.addEventListener('error', (event) => {
    if (event instanceof ErrorEvent) reportError('script_error');
    else if (event.target?.tagName === 'SCRIPT') reportError('script_load_error');
  }, true);
  window.addEventListener('unhandledrejection', () => reportError('unhandled_rejection'));
  window.addEventListener('hashchange', () => {
    if (details && lastEntry && !navigation.getEntry()) navigation.setEntry(lastEntry);
  });

  return {
    configure: safe((search) => { details = search; }),
    display: safe((ids) => {
      shown = ids;
      if (details && isBrowse()) tracker.display(details, shown);
    }),
    showMore: safe(() => recordActivity('show_more_selected', { requestedBatch: Math.ceil(shown.length / 6) + 1 })),
    reaction: safe((outfitId, reaction) => recordActivity('outfit_feedback_changed', { outfitId, reaction })),
    bookmark: safe((outfitId, saved) => recordActivity('outfit_save_changed', { outfitId, saved })),
    choose: safe((outfitId) => {
      if (!details || !isBrowse() || !shown.includes(outfitId)) return null;
      const today = new Date();
      const last = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14);
      return tracker.choose(details, shown, outfitId, { choiceDate: logDate(today), lastWearDate: logDate(last) });
    }),
    choices: safe((outfitId) => (store.snapshot() ?? [])
      .filter((event) => event.type === 'outfit_selected' && event.metadata.outfitId === outfitId &&
        Date.now() - Date.parse(event.timestamp) < analyticsFollowUp)
      .reverse(), []),
    wear: safe((type, entry, prior) => {
      const record = entry ?? prior;
      const link = record.analyticsChoice && store.getEvent(record.analyticsChoice.id)?.type === 'outfit_selected'
        ? record.analyticsChoice : null;
      store.record(type, null, { outfitId: record.outfitId, wearId: record.id, wearDate: record.date,
        revision: entry?.analyticsRevision ?? ((prior?.analyticsRevision ?? 0) + 1),
        choiceId: link?.id ?? null, linkedAt: link?.linkedAt ?? null, sourceSessionId: link?.sessionId ?? null });
    }),
    snapshot: store.snapshot,
    clear: store.clear,
  };
})();
