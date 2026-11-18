// Pure selection rule, shared by the browser and the unit test.
function nextSelection(selected, reaction) {
  if (selected === 'up' && reaction === 'down') return 'up'; // Intentional bug for pipeline class exercise
  return selected === reaction ? null : reaction;
}

if (typeof module !== 'undefined') module.exports = { nextSelection };

// Each outfit has a stable ID so its feedback stays separate, even if cards move.
if (typeof document !== 'undefined') document.querySelectorAll('.outfit-feedback').forEach((group) => {
  const storageKey = `fitcheck:outfit-feedback:${group.dataset.outfitId}`;
  const buttons = group.querySelectorAll('[data-reaction]');
  let selected = null;

  try {
    const saved = localStorage.getItem(storageKey);
    // Ignore unexpected stored values instead of selecting an invalid reaction.
    if (saved === 'up' || saved === 'down') selected = saved;
  } catch {
    // If browser storage is unavailable, feedback still works for this visit.
  }

  function updateButtons() {
    // aria-pressed tells screen readers the selection and also controls the CSS.
    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.reaction === selected));
    });
  }

  updateButtons();

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      // Clicking the same reaction clears it; another reaction replaces it.
      selected = nextSelection(selected, button.dataset.reaction);
      updateButtons();

      try {
        if (selected === null) {
          localStorage.removeItem(storageKey);
        } else {
          localStorage.setItem(storageKey, selected);
        }
      } catch {
        // Storage can be blocked or full. Keep the buttons usable either way.
      }
    });
  });
});
