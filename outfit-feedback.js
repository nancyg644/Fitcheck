// Pure selection rule, shared by the browser and the unit test.
function nextSelection(selected, reaction) {
  return selected === reaction ? null : reaction;
}

const outfitFeedbackPrefix = 'fitcheck:outfit-feedback:';

function readOutfitFeedback(id, storage) {
  try {
    const saved = (storage ?? localStorage).getItem(outfitFeedbackPrefix + id);
    return saved === 'up' || saved === 'down' ? saved : null;
  } catch {
    return null;
  }
}

function clearOutfitFeedback(storage) {
  try {
    const store = storage ?? localStorage;
    const keys = Array.from({ length: store.length }, (_, index) => store.key(index));
    keys.filter((key) => key?.startsWith(outfitFeedbackPrefix))
      .forEach((key) => store.removeItem(key));
    return true;
  } catch {
    return false;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { nextSelection, readOutfitFeedback, clearOutfitFeedback };
}

// Each outfit has a stable ID so its feedback stays separate, even if cards move.
function bindOutfitFeedback(group) {
  const storageKey = outfitFeedbackPrefix + group.dataset.outfitId;
  const buttons = group.querySelectorAll('[data-reaction]');
  let selected = readOutfitFeedback(group.dataset.outfitId);

  function updateButtons() {
    // aria-pressed tells screen readers the selection and also controls the CSS.
    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.reaction === selected));
    });
  }

  updateButtons();

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', ({ key }) => {
      if (key !== null && key !== storageKey) return;
      selected = readOutfitFeedback(group.dataset.outfitId);
      updateButtons();
    });
  }

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
        globalThis.fitcheckAnalytics?.reaction(group.dataset.outfitId, selected);
      } catch {
        // Storage can be blocked or full. Keep the buttons usable either way.
      }
    });
  });
}

if (typeof document !== 'undefined') document.querySelectorAll('.outfit-feedback').forEach(bindOutfitFeedback);
