function setupWearHistory(resolveOutfit) {
  const list = document.getElementById('wear-history-list');
  const empty = document.getElementById('wear-history-empty');
  const status = document.getElementById('wear-history-status');
  const filter = document.getElementById('wear-outfit-filter');
  const dialog = document.getElementById('wear-date-dialog');
  const form = dialog.querySelector('form');
  const dateInput = form.elements.date;
  const linkSelect = form.elements.wearChoice;
  const linkControls = document.getElementById('wear-choice-controls');
  const error = document.getElementById('wear-date-error');
  const title = document.getElementById('wear-date-title');
  const formatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
  const controls = new Map();
  const outfitOptions = new Set();
  const knownIds = { has: (id) => Boolean(resolveOutfit(id)) };
  const unsavedChanges = new Map();
  let entries = new Map();
  let draft;

  function dateLabel(date) {
    return formatter.format(new Date(`${date}T12:00:00`));
  }

  function wearButton(text, label, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'feedback-button';
    button.textContent = text;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', action);
    return button;
  }

  function renderControls() {
    const sorted = newestWearsFirst(entries.values());
    for (const [id, { summary }] of controls) {
      const wears = sorted.filter(({ outfitId }) => outfitId === id);
      summary.textContent = wears.length
        ? `Worn ${wears.length} ${wears.length === 1 ? 'time' : 'times'} · Last worn ${dateLabel(wears[0].date)}`
        : 'Worn 0 times';
    }
  }

  function renderHistory() {
    const sorted = newestWearsFirst(entries.values()).filter(({ outfitId }) => !filter.value || filter.value === outfitId);
    const rows = document.createDocumentFragment();
    for (const entry of sorted) {
      const { items, name } = resolveOutfit(entry.outfitId);
      const row = document.createElement('li');
      row.className = 'outfit-card wear-history-entry';
      row.dataset.wearId = entry.id;
      const photos = outfitPhotos(items);
      const heading = document.createElement('h2');
      heading.textContent = name;
      const time = document.createElement('time');
      time.dateTime = entry.date;
      time.textContent = dateLabel(entry.date);
      const actions = document.createElement('div');
      actions.className = 'wear-actions';
      actions.append(
        wearButton('Edit date', `Edit date for ${name} on ${time.textContent}`, () => openEditor(entry.outfitId, entry)),
        wearButton('Delete', `Delete wear for ${name} on ${time.textContent}`, () => {
          if (!window.confirm(`Delete this wear for ${name} on ${time.textContent}?`)) return;
          save(entry.id, null);
          filter.focus();
        }),
      );
      row.append(photos, heading, time, actions);
      rows.append(row);
    }
    list.replaceChildren(rows);
    empty.hidden = sorted.length > 0;
    empty.querySelector('p').textContent = filter.value
      ? 'No wears logged for this outfit yet.'
      : 'No outfits worn yet. Log an outfit to start your wear history.';
  }

  function refreshRecords() {
    entries = new Map(readWearHistory(knownIds).map((entry) => [entry.id, entry]));
    for (const [id, entry] of unsavedChanges) {
      if (entry) entries.set(id, entry);
      else entries.delete(id);
    }
    for (const { outfitId } of entries.values()) addFilterOption(resolveOutfit(outfitId));
    renderControls();
    if (window.location.hash === '#wear-history') renderHistory();
  }

  function save(id, entry) {
    const prior = entries.get(id);
    if (writeWearEntry(id, entry)) {
      unsavedChanges.delete(id);
      globalThis.fitcheckAnalytics?.wear(entry ? (prior ? 'wear_edited' : 'wear_logged') : 'wear_deleted', entry, prior);
    } else {
      unsavedChanges.set(id, entry);
    }
    status.textContent = unsavedChanges.size
      ? 'Browser storage is unavailable. Wear changes may be lost when you leave or refresh.'
      : '';
    refreshRecords();
  }

  function openEditor(outfitId, entry = null) {
    if (dialog.open) return;
    const today = localWearDate();
    const choices = entry || typeof canAttributeWear === 'undefined'
      ? [] : globalThis.fitcheckAnalytics?.choices(outfitId) ?? [];
    draft = { outfitId, entry, choices };
    linkSelect.replaceChildren(new Option('Do not link this wear', ''));
    for (const choice of choices) {
      const occasion = occasionNames[choice.metadata.occasion] ?? 'Any occasion';
      const time = new Date(choice.timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      linkSelect.add(new Option(`${dateLabel(choice.metadata.choiceDate)} at ${time} · ${occasion}`, choice.eventId));
    }
    linkControls.hidden = choices.length === 0;
    title.textContent = `${entry ? 'Edit wear for' : 'Log wear for'} ${resolveOutfit(outfitId).name}`;
    dateInput.max = today;
    dateInput.value = entry?.date ?? today;
    error.textContent = '';
    dateInput.removeAttribute('aria-invalid');
    dialog.showModal();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!draft || !dialog.open) return;
    const date = dateInput.value;
    if (!canLogWearDate(date)) {
      error.textContent = 'Choose a valid date that is today or earlier.';
      dateInput.setAttribute('aria-invalid', 'true');
      dateInput.focus();
      return;
    }
    const { outfitId, entry, choices } = draft;
    if (entry && !entries.has(entry.id)) {
      error.textContent = 'This wear was deleted in another tab.';
      return;
    }
    const linkedAt = Date.now();
    const choice = choices.find(({ eventId }) => eventId === linkSelect.value);
    if (choice && !canAttributeWear(choice, outfitId, date, linkedAt)) {
      error.textContent = 'This date cannot be linked to that choice. Choose a later wear date or leave it unlinked.';
      linkSelect.focus();
      return;
    }
    // Close and clear the draft before committing so a second submit is ignored.
    draft = null;
    dialog.close();
    const record = entry ? { ...entries.get(entry.id), date } : newWearEntry(outfitId, date);
    record.analyticsRevision = (record.analyticsRevision ?? 0) + 1;
    if (choice) record.analyticsChoice = { id: choice.eventId, sessionId: choice.sessionId, linkedAt };
    save(record.id, record);
    if (entry) {
      const row = [...list.children].find((element) => element.dataset.wearId === entry.id);
      (row?.querySelector('button') ?? filter).focus();
    }
  });
  dialog.querySelector('[data-cancel-wear]').addEventListener('click', () => dialog.close());
  filter.addEventListener('change', renderHistory);

  function addFilterOption({ id, name }) {
    if (outfitOptions.has(id)) return;
    outfitOptions.add(id);
    filter.add(new Option(name, id));
  }

  function registerOutfit({ id, card, name }) {
    if (controls.has(id)) return;
    const summary = document.createElement('p');
    summary.className = 'wear-summary';
    const actions = document.createElement('div');
    actions.className = 'wear-actions';
    actions.append(
      wearButton('Log wear', `Log wear for ${name}`, () => openEditor(id)),
      wearButton('View wears', `View wears for ${name}`, () => {
        filter.value = id;
        window.location.hash = '#wear-history';
        requestAnimationFrame(() => filter.focus());
      }),
    );
    card.append(summary, actions);
    controls.set(id, { card, name, summary });
    addFilterOption({ id, name });
    renderControls();
  }

  window.addEventListener('storage', ({ key }) => {
    if (key === null || key === wearHistoryKey ||
        key.startsWith(wearRecordPrefix) || key.startsWith(wearEntryPrefix)) refreshRecords();
  });
  refreshRecords();
  return { renderHistory, registerOutfit };
}
