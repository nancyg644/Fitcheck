const outfitContextFields = {
  weather: {
    label: 'Weather', options: { hot: 'Hot', warm: 'Warm', cool: 'Cool', cold: 'Cold' },
  },
  'dress-code': {
    label: 'Dress code', options: { casual: 'Casual', 'smart-casual': 'Smart casual', dressy: 'Dressy' },
  },
  setting: {
    label: 'Setting', options: { indoors: 'Indoors', outdoors: 'Outdoors', both: 'Both' },
  },
  activity: {
    label: 'Activity level', options: { walking: 'Lots of walking', seated: 'Mostly seated' },
  },
};

function readOutfitContext(params) {
  return Object.entries(outfitContextFields).flatMap(([field, { options }]) => {
    const value = params.get(field);
    return Object.hasOwn(options, value) ? [{ field, value }] : [];
  });
}

function matchOutfitContext(tags, criteria) {
  const matched = [];
  const missed = [];
  for (const criterion of criteria) {
    const { field, value } = criterion;
    const values = tags?.[field] ?? [];
    const matches = field === 'setting' && value === 'both'
      ? values.includes('indoors') && values.includes('outdoors')
      : values.includes(value);
    (matches ? matched : missed).push(criterion);
  }
  return { matched, missed };
}

if (typeof module !== 'undefined') {
  module.exports = { readOutfitContext, matchOutfitContext };
}
