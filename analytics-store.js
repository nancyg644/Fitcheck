const analyticsPrefix = 'fitcheck:analytics:';
const analyticsEventPrefix = analyticsPrefix + 'event:';
const analyticsEpochKey = analyticsPrefix + 'epoch';
const analyticsDay = 86_400_000;
const analyticsTimeout = 30 * 60_000;
const analyticsFollowUp = 14 * analyticsDay;

function analyticsId() {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), (part) => part.toString(16).padStart(8, '0')).join('');
}

function createAnalyticsStore(getStorage, now = Date.now, makeId = analyticsId) {
  function epoch() {
    try { return getStorage().getItem(analyticsEpochKey) ?? 'initial'; } catch { return null; }
  }

  function read(store, generation) {
    const events = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key?.startsWith(analyticsEventPrefix)) continue;
      try {
        const event = JSON.parse(store.getItem(key));
        if (event?.epoch === generation && event.eventId === key.slice(analyticsEventPrefix.length) &&
            Number.isFinite(Date.parse(event.timestamp)) && typeof event.type === 'string' &&
            event.metadata && typeof event.metadata === 'object') events.push(event);
      } catch {
        // Ignore a malformed record without dropping the rest of the log.
      }
    }
    return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.eventId.localeCompare(b.eventId));
  }

  function prune(store, generation) {
    const groups = new Map();
    let count = 0;
    let bytes = 0;
    for (const event of read(store, generation)) {
      const key = event.sessionId ?? event.metadata?.sourceSessionId ?? event.eventId;
      if (!groups.has(key)) groups.set(key, { events: [], bytes: 0 });
      const group = groups.get(key);
      const size = 2 * (JSON.stringify(event).length + analyticsEventPrefix.length + event.eventId.length);
      group.events.push(event);
      group.bytes += size;
      bytes += size;
      count++;
    }
    for (const { events, bytes: size } of groups.values()) {
      if (Date.parse(events[0].timestamp) >= now() - 90 * analyticsDay && count <= 2000 && bytes <= 1_000_000) break;
      for (const { eventId } of events) store.removeItem(analyticsEventPrefix + eventId);
      count -= events.length;
      bytes -= size;
    }
  }

  function record(type, sessionId, metadata = {}, eventId = null, expectedEpoch = epoch()) {
    try {
      const store = getStorage();
      if (expectedEpoch === null || epoch() !== expectedEpoch) return null;
      const id = eventId ?? makeId();
      const key = analyticsEventPrefix + id;
      let prior;
      try { prior = JSON.parse(store.getItem(key)); } catch { /* replace a damaged record */ }
      if (prior?.epoch === expectedEpoch) return prior;
      const event = { schemaVersion: 1, eventId: id, timestamp: new Date(now()).toISOString(),
        sessionId, type, metadata, epoch: expectedEpoch };
      store.setItem(key, JSON.stringify(event));
      prune(store, expectedEpoch);
      return event;
    } catch { return null; }
  }

  function snapshot() {
    try {
      const store = getStorage();
      const generation = epoch();
      return generation === null ? null : read(store, generation);
    } catch { return null; }
  }

  function getEvent(id, generation = epoch()) {
    try {
      const event = JSON.parse(getStorage().getItem(analyticsEventPrefix + id));
      return event?.epoch === generation ? event : null;
    } catch { return null; }
  }

  function clear() {
    try {
      const store = getStorage();
      const generation = makeId();
      const oldEvents = new Map();
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (key?.startsWith(analyticsEventPrefix)) oldEvents.set(key, store.getItem(key));
      }
      // Change generations first so an in-flight action cannot restore cleared data.
      store.setItem(analyticsEpochKey, generation);
      for (const [key, value] of oldEvents) {
        if (store.getItem(key) === value) store.removeItem(key);
      }
      return true;
    } catch { return false; }
  }

  return { epoch, record, snapshot, clear, getEvent };
}

if (typeof module !== 'undefined') {
  module.exports = { createAnalyticsStore, analyticsPrefix, analyticsDay, analyticsTimeout, analyticsFollowUp };
}
