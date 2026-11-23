const wearHistoryKey = 'fitcheck:wear-history';
const wearRecordPrefix = `${wearHistoryKey}:`;

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

function readWearHistory(knownIds, storage) {
  try {
    const store = storage ?? localStorage;
    let stored;
    try { stored = JSON.parse(store.getItem(wearHistoryKey)); } catch { stored = null; }
    const entries = new Map();
    for (const entry of Array.isArray(stored) ? stored : []) {
      if (!entry || !knownIds.has(entry.outfitId) || !isWearDate(entry.date)) continue;
      const { outfitId, date } = entry;
      entries.set(`${wearRecordPrefix}${date}:${outfitId}`, { outfitId, date, timestamp: 0 });
    }
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key?.startsWith(wearRecordPrefix)) continue;
      const date = key.slice(wearRecordPrefix.length, wearRecordPrefix.length + 10);
      const outfitId = key.slice(wearRecordPrefix.length + 11);
      if (!knownIds.has(outfitId) || !isWearDate(date) ||
          key !== `${wearRecordPrefix}${date}:${outfitId}`) continue;
      const value = store.getItem(key);
      if (value === 'removed') {
        entries.delete(key);
      } else if (value && /^\d+$/.test(value)) {
        entries.set(key, { outfitId, date, timestamp: Number(value) });
      }
    }
    return [...entries.values()]
      .sort((a, b) => a.timestamp - b.timestamp || a.outfitId.localeCompare(b.outfitId))
      .map(({ outfitId, date }) => ({ outfitId, date }));
  } catch {
    return [];
  }
}

function recordWear(entries, outfitId, date) {
  if (!outfitId || !isWearDate(date) ||
      entries.some((entry) => entry.outfitId === outfitId && entry.date === date)) {
    return entries;
  }
  return [...entries, { outfitId, date }];
}

function undoWear(entries, outfitId, date) {
  return entries.filter((entry) => entry.outfitId !== outfitId || entry.date !== date);
}

function newestWearsFirst(entries) {
  return [...entries].reverse().sort((a, b) => b.date.localeCompare(a.date));
}

function writeWearRecord(outfitId, date, worn, storage) {
  try {
    (storage ?? localStorage).setItem(`${wearRecordPrefix}${date}:${outfitId}`, worn ? String(Date.now()) : 'removed');
    return true;
  } catch {
    return false;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { localWearDate, readWearHistory, recordWear, undoWear, newestWearsFirst, writeWearRecord };
}
