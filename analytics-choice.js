function appendRecommendationChoice(card, outfit) {
  if (card.querySelector('.choose-outfit')) return;
  const controls = document.createElement('div');
  controls.className = 'choose-outfit';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'feedback-button';
  button.textContent = 'Choose this outfit';
  button.setAttribute('aria-label', `Choose this outfit — ${outfit.name}`);
  const status = document.createElement('p');
  status.className = 'outfit-choice-status';
  status.setAttribute('role', 'status');
  button.addEventListener('click', () => {
    status.textContent = globalThis.fitcheckAnalytics?.choose(outfit.id)
      ? 'Outfit chosen. Use Log wear later to link it to this choice.'
      : 'This choice could not be stored in this browser.';
  });
  controls.append(button, status);
  card.querySelector('.outfit-feedback').before(controls);
}
