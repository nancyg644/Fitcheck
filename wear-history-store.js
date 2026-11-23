const wearHistoryKey = 'fitcheck:wear-history';

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
    const stored = JSON.parse((storage ?? localStorage).getItem(wearHistoryKey));
    if (!Array.isArray(stored)) return [];

    const seen = new Set();
    return stored.filter((entry) => {
      if (!entry || !knownIds.has(entry.outfitId) || !isWearDate(entry.date)) return false;
      const key = JSON.stringify([entry.outfitId, entry.date]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map(({ outfitId, date }) => ({ outfitId, date }));
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

function writeWearHistory(entries, storage) {
  try {
    (storage ?? localStorage).setItem(wearHistoryKey, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { localWearDate, readWearHistory, recordWear, undoWear, newestWearsFirst, writeWearHistory };
}
