const analyticsTabKey = 'fitcheck:analytics-tab';
const recommendationTimeout = typeof module !== 'undefined'
  ? require('./analytics-store.js').analyticsTimeout : analyticsTimeout;

function createRecommendationTracker(store, navigation, now = Date.now, makeId = analyticsId) {
  let active;
  let search;
  let shown = new Set();

  function touch() {
    const epoch = store.epoch();
    if (epoch === null) return null;
    const at = now();
    const prior = active ?? navigation.getTab();
    if (!prior || prior.epoch !== epoch || at - prior.lastActivity >= recommendationTimeout ||
        at < prior.lastActivity || store.getEvent(prior.id, epoch)?.type !== 'recommendation_session_started') {
      active = { id: makeId(), epoch, lastActivity: at };
      if (!store.record('recommendation_session_started', active.id, {}, active.id, epoch)) {
        active = null;
        return null;
      }
    } else {
      active = { ...prior, lastActivity: at };
    }
    navigation.setTab(active);
    return active;
  }

  function start(details) {
    const session = touch();
    if (!session) return null;
    const signature = JSON.stringify([details.occasion, details.filters]);
    const prior = navigation.getEntry();
    if (search?.sessionId !== session.id || search.signature !== signature) {
      search = prior?.sessionId === session.id && prior.signature === signature
        ? prior : { id: makeId(), sessionId: session.id, signature };
      navigation.setEntry(search);
      shown = new Set();
      for (const event of store.snapshot() ?? []) {
        if (event.type === 'recommendations_displayed' && event.metadata.searchId === search.id) {
          for (const id of event.metadata.outfitIds) shown.add(id);
        }
      }
    }
    const log = (type, metadata, key) =>
      store.record(type, session.id, { searchId: search.id, ...metadata }, search.id + ':' + key, session.epoch);
    if (active.occasion !== details.occasion) {
      if (details.occasion) log('occasion_selected', { occasion: details.occasion }, 'occasion');
      active.occasion = details.occasion;
      navigation.setTab(active);
    }
    log('context_filters_applied', { occasion: details.occasion, filters: details.filters }, 'filters');
    log('recommendation_generation_timed', { durationMs: details.durationMs, eligibleCount: details.eligibleCount }, 'timing');
    if (!details.eligibleCount) log('no_recommendations_found', { occasion: details.occasion, filters: details.filters }, 'empty');
    return search;
  }

  function display(details, outfitIds) {
    const current = start(details);
    if (!current) return;
    for (let offset = 0; offset < outfitIds.length; offset += 6) {
      const batch = offset / 6 + 1;
      const fresh = outfitIds.slice(offset, offset + 6).filter((id) => !shown.has(id));
      if (!fresh.length) continue;
      const eventId = current.id + ':batch:' + batch + ':' + [...fresh].sort().join(',');
      if (store.record('recommendations_displayed', current.sessionId,
        { searchId: current.id, batch, outfitIds: fresh }, eventId, active.epoch)) {
        fresh.forEach((id) => shown.add(id));
      }
    }
  }

  function activity(details, visibleIds, type, metadata) {
    display(details, visibleIds);
    if (!search || active?.epoch !== store.epoch()) return null;
    if (metadata.outfitId && !shown.has(metadata.outfitId)) return null;
    return store.record(type, search.sessionId, { searchId: search.id, ...metadata }, null, active.epoch);
  }

  function choose(details, visibleIds, outfitId, dates) {
    display(details, visibleIds);
    if (!search || !shown.has(outfitId) || active?.epoch !== store.epoch()) return null;
    return store.record('outfit_selected', search.sessionId,
      { searchId: search.id, outfitId, occasion: details.occasion, ...dates },
      search.id + ':choice:' + outfitId, active.epoch);
  }

  return { display, activity, choose };
}

if (typeof module !== 'undefined') module.exports = { createRecommendationTracker };
