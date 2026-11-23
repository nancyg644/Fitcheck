(() => {
  const form = document.getElementById('style-profile');
  const status = document.getElementById('profile-status');
  const sections = [...form.querySelectorAll('[data-preference]')];
  for (const section of sections) {
    const key = section.dataset.preference;
    for (const [value, title] of Object.entries(stylePreferenceOptions[key])) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = key === 'priority' ? 'radio' : 'checkbox';
      input.name = key;
      input.value = value;
      label.append(input, document.createTextNode(title));
      section.append(label);
    }
  }

  const preferences = readStylePreferences();
  for (const input of form.querySelectorAll('input')) {
    const value = preferences[input.name];
    input.checked = Array.isArray(value) ? value.includes(input.value) : value === input.value;
  }

  form.addEventListener('change', () => { status.textContent = ''; });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const saved = saveStylePreferences({
      styles: data.getAll('styles'), colors: data.getAll('colors'), priority: data.get('priority'),
    });
    status.textContent = saved ? 'Style preferences saved.' :
      'Browser storage is unavailable. Your preferences could not be saved.';
  });

  document.getElementById('reset-style-preferences').addEventListener('click', () => {
    if (saveStylePreferences(null)) {
      form.reset();
      status.textContent = 'Style preferences reset.';
    } else {
      status.textContent = 'Browser storage is unavailable. Your preferences could not be reset.';
    }
  });
  form.hidden = false;
})();
