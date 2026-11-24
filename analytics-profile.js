(() => {
  const panel = document.getElementById('profile-analytics');
  const status = document.getElementById('analytics-status');
  const list = panel.querySelector('dl');
  const controls = [...panel.querySelectorAll('button')];
  const analytics = globalThis.fitcheckAnalytics;
  const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 });
  const showRate = (value) => value === null ? '—' : percent.format(value);
  const showTime = (value, unit) => value === null ? '—' : `${Number(value.toFixed(1))} ${unit}`;
  const frequently = (items, label) => items.slice(0, 3).map(([key, value]) => `${label(key)} (${value})`).join(', ') || '—';
  const occasionLabels = { work: 'Work', 'dinner-out': 'Dinner Out', 'date-night': 'Date Night',
    'casual-weekend': 'Casual Weekend', party: 'Party' };
  const labelFilter = (key) => key.split('=').map((part) => part.replaceAll('-', ' ')).join(' · ');

  function render() {
    const events = analytics?.snapshot();
    const available = events != null;
    for (const control of controls) control.disabled = !available;
    if (!available) {
      status.textContent = 'Analytics storage is unavailable in this browser.';
      list.replaceChildren();
      return;
    }
    const m = summarizeAnalytics(events);
    const rows = [
      ['Recommendation sessions', m.totalSessions],
      ['Outfit selection rate', showRate(m.selectionRate)],
      ['Preliminary confirmed-wear rate', showRate(m.preliminaryWearRate)],
      ['Final confirmed-wear rate', showRate(m.finalWearRate)],
      ['Sessions within follow-up', m.openSessions],
      ['Sessions with closed follow-up', m.finalizedSessions],
      ['Average time to choose', showTime(m.averageSelectionSeconds, 's')],
      ['Like rate', showRate(m.likeRate)],
      ['Save rate', showRate(m.saveRate)],
      ['Most selected occasions', frequently(m.occasions, (key) => occasionLabels[key] ?? key)],
      ['Most applied filters', frequently(m.filters, labelFilter)],
      ['No-results rate', showRate(m.noResultsRate)],
      ['Show More usage', `${showRate(m.showMoreRate)} · ${m.showMoreClicks} clicks`],
      ['Generation time (median / p95)', `${showTime(m.generation.medianMs, 'ms')} / ${showTime(m.generation.p95Ms, 'ms')}`],
      ['Application errors', m.errors.reduce((sum, [, n]) => sum + n, 0)],
    ];
    const fragment = document.createDocumentFragment();
    for (const [label, value] of rows) {
      const term = document.createElement('dt');
      const definition = document.createElement('dd');
      term.textContent = label;
      definition.textContent = value;
      fragment.append(term, definition);
    }
    list.replaceChildren(fragment);
  }

  function download(format) {
    const events = analytics?.snapshot();
    if (!events) return;
    const summary = summarizeAnalytics(events);
    const csv = format === 'csv';
    const body = csv ? analyticsCsv(summary.rows) : analyticsJson(events, summary);
    const url = URL.createObjectURL(new Blob([body], { type: csv ? 'text/csv;charset=utf-8' : 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `fitcheck-analytics.${format}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  for (const button of controls) {
    if (button.dataset.export) button.addEventListener('click', () => download(button.dataset.export));
  }
  document.getElementById('clear-analytics').addEventListener('click', () => {
    if (!window.confirm('Clear local FitCheck analytics and outfit choices? Your style preferences, feedback, saved outfits, and wear history will stay.')) return;
    status.textContent = analytics.clear() ? 'Local analytics cleared.' : 'Analytics could not be cleared.';
    render();
  });
  panel.addEventListener('toggle', () => { if (panel.open) render(); });
  window.addEventListener('storage', ({ key }) => {
    if (panel.open && (key === null || key.startsWith(analyticsPrefix))) render();
  });
  render();
})();
