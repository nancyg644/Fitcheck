function outfitPhotos(items) {
  const photos = document.createElement('div');
  photos.className = 'outfit-images';
  photos.dataset.pieceCount = items.length;
  for (const { id, name, image } of items) {
    const photo = document.createElement('img');
    photo.src = image;
    photo.alt = name;
    photo.dataset.itemId = id;
    photo.loading = 'lazy';
    photos.append(photo);
  }
  return photos;
}

function createGeneratedOutfitCard(outfit) {
  const card = document.createElement('div');
  card.className = 'outfit-card';
  const heading = document.createElement('h3');
  heading.textContent = outfit.name;
  const description = document.createElement('p');
  description.className = 'outfit-description';
  description.textContent = outfit.description;
  const occasion = document.createElement('p');
  occasion.className = 'occasion';
  occasion.textContent = outfit.occasions.map((id) => occasionNames[id]).join(' · ').toUpperCase();
  const feedback = document.createElement('div');
  feedback.className = 'outfit-feedback';
  feedback.dataset.outfitId = outfit.id;
  feedback.setAttribute('role', 'group');
  feedback.setAttribute('aria-label', `Feedback for ${outfit.name}`);
  for (const [reaction, label, action] of [['up', 'Like', 'Thumbs up'], ['down', 'Dislike', 'Thumbs down']]) {
    const button = document.createElement('button');
    button.className = 'feedback-button';
    button.type = 'button';
    button.dataset.reaction = reaction;
    button.textContent = label;
    button.setAttribute('aria-label', `${action} for ${outfit.name}`);
    feedback.append(button);
  }
  bindOutfitFeedback(feedback);
  card.append(outfitPhotos(outfit.items), heading, description, occasion, feedback);
  return card;
}
