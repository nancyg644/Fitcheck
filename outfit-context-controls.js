(() => {
  const details = document.getElementById('refine-outfit');
  const form = details.querySelector('form');
  const selections = details.querySelector('.context-selections');
  const params = new URLSearchParams(window.location.search);
  const context = new Map(readOutfitContext(params).map(({ field, value }) => [field, value]));
  const occasion = params.get('occasion');
  const search = new URLSearchParams();
  if (occasion) search.set('occasion', occasion);
  details.querySelector('.clear-context').href = search.size ? `outfits.html?${search}` : 'outfits.html';
  form.elements.occasion.value = occasion ?? '';

  for (const [field, { label: title, options }] of Object.entries(outfitContextFields)) {
    const label = document.createElement('label');
    label.textContent = title;
    const select = document.createElement('select');
    select.name = field;
    select.add(new Option('No preference', ''));
    for (const [value, text] of Object.entries(options)) {
      select.add(new Option(text, value));
    }
    select.value = context.get(field) ?? '';
    label.append(select);
    selections.append(label);
  }

  form.addEventListener('formdata', ({ formData }) => {
    for (const [key, value] of [...formData]) {
      if (value === '') formData.delete(key);
    }
  });
  details.open = context.size > 0;
  details.hidden = false;
})();
