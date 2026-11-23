const stylePreferencesKey = 'fitcheck:style-preferences';

const stylePreferenceOptions = {
  styles: {
    classic: 'Classic', minimalist: 'Minimalist', casual: 'Casual',
    polished: 'Polished', trendy: 'Trendy', bold: 'Bold',
  },
  colors: {
    neutrals: 'Neutrals', 'earth-tones': 'Earth tones', pastels: 'Pastels',
    'bright-colors': 'Bright colors', 'dark-colors': 'Dark colors',
  },
  priority: {
    'comfort-first': 'Comfort first', balanced: 'Balanced', 'style-first': 'Style first',
  },
};

function normalizeStylePreferences(value) {
  const { styles, colors, priority } = value ?? {};
  const known = (key, option) =>
    typeof option === 'string' && Object.hasOwn(stylePreferenceOptions[key], option);
  const selected = (key, options) =>
    Array.isArray(options) ? [...new Set(options.filter((option) => known(key, option)))] : [];
  return {
    styles: selected('styles', styles),
    colors: selected('colors', colors),
    priority: known('priority', priority) ? priority : null,
  };
}

function readStylePreferences(storage) {
  try {
    return normalizeStylePreferences(JSON.parse((storage ?? localStorage).getItem(stylePreferencesKey)));
  } catch {
    return normalizeStylePreferences(null);
  }
}

function saveStylePreferences(value, storage) {
  try {
    const store = storage ?? localStorage;
    if (value === null) {
      store.removeItem(stylePreferencesKey);
    } else {
      store.setItem(stylePreferencesKey, JSON.stringify(normalizeStylePreferences(value)));
    }
    return true;
  } catch {
    return false;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { normalizeStylePreferences, readStylePreferences, saveStylePreferences };
}
