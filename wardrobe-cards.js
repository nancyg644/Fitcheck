(() => {
  const grid = document.querySelector('.wardrobe-grid');
  for (const { id, name, category, image, seasons, places } of wardrobeCatalog) {
    const card = document.createElement('div');
    card.className = 'clothing-card';
    Object.assign(card.dataset, { itemId: id, category, seasons: seasons.join(' '), places: places.join(' ') });
    const photo = document.createElement('div');
    photo.className = 'clothing-image';
    const img = document.createElement('img');
    img.src = image;
    img.alt = name;
    img.loading = 'lazy';
    photo.append(img);
    const heading = document.createElement('h3');
    heading.textContent = name;
    card.append(photo, heading);
    grid.append(card);
  }
})();
