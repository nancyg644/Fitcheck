const wearHistoryKey = 'fitcheck:wear-history';
const wearRecordPrefix = `${wearHistoryKey}:`;
const wearEntryPrefix = 'fitcheck:wear-entry:';

function localWearDate(date = new Date()) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isWearDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function canLogWearDate(date, today = localWearDate()) {
  return isWearDate(date) && date <= today;
}

function newWearEntry(outfitId, date) {
  const id = Array.from(crypto.getRandomValues(new Uint32Array(4)),
    (value) => value.toString(16).padStart(8, '0')).join('');
  return { id, outfitId, date, createdAt: Date.now() };
}

function readWearHistory(knownIds, storage) {
  try {
    const store = storage ?? localStorage;
    let stored;
    try { stored = JSON.parse(store.getItem(wearHistoryKey)); } catch { stored = null; }
    const entries = new Map();
    for (const entry of Array.isArray(stored) ? stored : []) {
      if (!entry || !knownIds.has(entry.outfitId) || !isWearDate(entry.date)) continue;
      const { outfitId, date } = entry;
      const id = `legacy:${date}:${outfitId}`;
      entries.set(id, { id, outfitId, date, createdAt: 0 });
    }
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(wearRecordPrefix)) {
        const date = key.slice(wearRecordPrefix.length, wearRecordPrefix.length + 10);
        const outfitId = key.slice(wearRecordPrefix.length + 11);
        if (!knownIds.has(outfitId) || !isWearDate(date) ||
            key !== `${wearRecordPrefix}${date}:${outfitId}`) continue;
        const id = `legacy:${date}:${outfitId}`;
        const value = store.getItem(key);
        if (value === 'removed') entries.delete(id);
        else if (value && /^\d+$/.test(value)) entries.set(id, { id, outfitId, date, createdAt: Number(value) });
      }
    }
    // Read independent entries last so edits and deletions also override legacy data.
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key?.startsWith(wearEntryPrefix)) continue;
      const id = key.slice(wearEntryPrefix.length);
      const value = store.getItem(key);
      if (value === 'removed') {
        entries.delete(id);
        continue;
      }
      let entry;
      try { entry = JSON.parse(value); } catch { continue; }
      if (id && entry?.id === id && knownIds.has(entry.outfitId) &&
          isWearDate(entry.date) && Number.isFinite(entry.createdAt)) {
        entries.set(id, entry);
      }
    }
    return [...entries.values()];
  } catch {
    return [];
  }
}

function newestWearsFirst(entries) {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date) ||
    b.createdAt - a.createdAt || a.id.localeCompare(b.id));
}

function writeWearEntry(id, entry, storage) {
  if (!id || (entry && (entry.id !== id || !entry.outfitId || !canLogWearDate(entry.date) ||
      !Number.isFinite(entry.createdAt)))) return false;
  try {
    (storage ?? localStorage).setItem(wearEntryPrefix + id, entry ? JSON.stringify(entry) : 'removed');
    return true;
  } catch {
    return false;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { localWearDate, canLogWearDate, newWearEntry, readWearHistory, newestWearsFirst, writeWearEntry };
}
