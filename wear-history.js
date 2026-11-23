function setupWearHistory(outfits) {
  const list = document.getElementById('wear-history-list');
  const empty = document.getElementById('wear-history-empty');
  const status = document.getElementById('wear-history-status');
  const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
  const controls = new Map();
  let entries;
  let midnightTimer;

  function dateLabel(date) {
    return formatter.format(new Date(`${date}T12:00:00`));
  }

  function renderControls() {
    const today = localWearDate();
    const sorted = newestWearsFirst(entries);
    for (const [id, { name, log, undo, summary }] of controls) {
      const wears = sorted.filter(({ outfitId }) => outfitId === id);
      const wornToday = wears.some(({ date }) => date === today);
      log.textContent = wornToday ? 'Worn today' : 'I wore this';
      log.setAttribute('aria-label', `${log.textContent} — ${name}`);
      log.setAttribute('aria-disabled', String(wornToday));
      undo.hidden = !wornToday;
      summary.textContent = wears.length
        ? `Worn ${wears.length} ${wears.length === 1 ? 'time' : 'times'} · Last worn ${dateLabel(wears[0].date)}`
        : 'Worn 0 times';
    }
  }

  function renderHistory() {
    const sorted = newestWearsFirst(entries);
    const rows = document.createDocumentFragment();
    for (const { outfitId, date } of sorted) {
      const { card, name } = controls.get(outfitId);
      const row = document.createElement('li');
      row.className = 'outfit-card wear-history-entry';
      const photos = card.querySelector('.outfit-images').cloneNode(true);
      const heading = document.createElement('h2');
      heading.textContent = name;
      const time = document.createElement('time');
      time.dateTime = date;
      time.textContent = dateLabel(date);
      row.append(photos, heading, time);
      rows.append(row);
    }
    list.replaceChildren(rows);
    empty.hidden = sorted.length > 0;
  }

  function save(entriesToStore) {
    entries = entriesToStore;
    status.textContent = writeWearHistory(entries) ? '' :
      'Browser storage is unavailable. Wear changes may be lost when you leave or refresh.';
    renderControls();
  }

  for (const { id, card } of outfits) {
    if (!id) continue;
    const name = card.querySelector('h3').textContent;
    const summary = document.createElement('p');
    summary.className = 'wear-summary';
    const log = document.createElement('button');
    log.type = 'button';
    log.className = 'feedback-button';
    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'feedback-button';
    undo.textContent = 'Undo';
    undo.setAttribute('aria-label', `Undo today's wear for ${name}`);
    const actions = document.createElement('div');
    actions.className = 'wear-actions';
    actions.append(log, undo);
    card.append(summary, actions);
    controls.set(id, { card, name, summary, log, undo });

    log.addEventListener('click', () => {
      const next = recordWear(entries, id, localWearDate());
      if (next !== entries) save(next);
    });
    undo.addEventListener('click', () => {
      save(undoWear(entries, id, localWearDate()));
      log.focus();
    });
  }

  entries = readWearHistory(new Set(controls.keys()));

  function refreshDay() {
    renderControls();
    window.clearTimeout(midnightTimer);
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    midnightTimer = window.setTimeout(refreshDay, midnight - now);
  }

  window.addEventListener('focus', refreshDay);
  refreshDay();
  return renderHistory;
}
