const generatedOutfitPrefix = 'gen-v1:';
const occasionNames = {
  work: 'Work', 'dinner-out': 'Dinner Out', 'date-night': 'Date Night',
  'casual-weekend': 'Casual Weekend', party: 'Party',
};
const outfitSlots = ['tops', 'bottoms', 'dresses', 'shoes', 'outerwear', 'accessories'];

function generatedOutfitId(items) {
  const ordered = [...items].sort((a, b) => outfitSlots.indexOf(a.category) - outfitSlots.indexOf(b.category));
  return generatedOutfitPrefix + ordered.map(({ id }) => id).join('+');
}

function intersectOutfitTags(items, key) {
  return items[0][key].filter((value) => items.every((item) => item[key].includes(value)));
}

function coordinatedColors(items) {
  const neutrals = ['white', 'ivory', 'cream', 'black', 'charcoal', 'navy', 'denim', 'sand', 'taupe'];
  const earth = ['olive', 'sage', 'camel', 'cognac'];
  const rosy = ['burgundy', 'pink', 'blush'];
  const accents = [...new Set(items.map(({ color }) => color).filter((color) => !neutrals.includes(color)))];
  return accents.length <= 1 ||
    accents.every((color) => earth.includes(color)) || accents.every((color) => rosy.includes(color));
}

function outfitShapeWorks(top, bottom, shoes, layer) {
  if (top?.color === 'denim' && bottom?.color === 'denim') return false;
  if (top?.shape === 'bulky' && ['wide', 'fluid'].includes(bottom?.shape)) return false;
  if (bottom?.shape === 'active' && !['bulky', 'regular', 'fitted'].includes(top?.shape)) return false;
  if (shoes.shape === 'active' && bottom?.shape !== 'active' && top?.shape !== 'bulky') return false;
  if (shoes.shape === 'trail' && !(bottom?.shape === 'active' || bottom?.id === 'olive-cargo-pants')) return false;
  if (bottom?.shape === 'active' && !['active', 'trail', 'clean-sneaker'].includes(shoes.shape)) return false;
  return !layer || (top?.shape !== 'bulky' && ![top, bottom].some((item) => item?.color === 'denim'));
}

function describeGeneratedOutfit(items) {
  const body = items.filter(({ category }) => ['tops', 'bottoms', 'dresses'].includes(category));
  const shoes = items.find(({ category }) => category === 'shoes');
  const layer = items.find(({ category }) => category === 'outerwear');
  const accessory = items.find(({ category }) => category === 'accessories');
  const essential = items.filter(({ category }) => category !== 'accessories');
  let weather = intersectOutfitTags(essential, 'weather');
  if (layer && layer.weather.includes('cool') && shoes.weather.includes('cool') &&
      body.every((item) => item.weather.includes('cool') ||
        (item.category !== 'bottoms' && item.weather.includes('warm')))) weather = ['cool'];
  if (accessory) weather = weather.filter((value) => accessory.weather.includes(value));
  const dressCodes = intersectOutfitTags(items, 'dressCodes');
  const colors = [...new Set(essential.map(({ color }) => color))];
  const palette = colors.length === 1 ? `a ${colors[0]} palette` :
    `${colors.slice(0, -1).join(', ')} and ${colors.at(-1)} tones`;
  return {
    id: generatedOutfitId(items),
    itemIds: items.map(({ id }) => id),
    items,
    name: `${body.map(({ name }) => name).join(' and ')} with ${shoes.name}` +
      (layer ? ' and a denim layer' : ''),
    base: body.map(({ id }) => id).join('+'),
    occasions: intersectOutfitTags(items, 'occasions').filter((occasion) =>
      occasion === 'casual-weekend' ? dressCodes.includes('casual') :
        occasion === 'work' ? dressCodes.includes('smart-casual') &&
          !(shoes.shape === 'clean-sneaker' && body.some(({ color }) => color === 'denim')) :
          occasion === 'party' ? dressCodes.includes('dressy') :
            dressCodes.some((code) => code !== 'casual')),
    context: { weather, 'dress-code': dressCodes, setting: intersectOutfitTags(items, 'setting'),
      activity: intersectOutfitTags(items, 'activity') },
    styles: [...new Set(body.flatMap(({ styles }) => styles))],
    colors: [...new Set(essential.flatMap(({ colors }) => colors))],
    priority: dressCodes.includes('dressy') ? 'style-first' :
      shoes.activity.includes('walking') ? 'comfort-first' : 'balanced',
    description: `A pairing in ${palette}, finished with ${shoes.name}.` +
      (layer ? ` The ${layer.name} adds a light layer for cool weather.` : '') +
      (accessory ? ` Finish with ${accessory.name}.` : ''),
  };
}

function resolveGeneratedOutfit(id, catalog) {
  if (!id.startsWith(generatedOutfitPrefix)) return null;
  const ids = id.slice(generatedOutfitPrefix.length).split('+');
  if (ids.length < 2 || ids.length > 5 || new Set(ids).size !== ids.length) return null;
  const items = ids.map((itemId) => catalog.get(itemId));
  if (items.some((item) => !item) || generatedOutfitId(items) !== id) return null;
  const categories = new Set(items.map(({ category }) => category));
  if (categories.size !== items.length || !categories.has('shoes') ||
      (categories.has('dresses') ? categories.has('tops') || categories.has('bottoms') :
        !categories.has('tops') || !categories.has('bottoms'))) return null;
  // Resolve previously stored outfits even when rules or tags later change.
  return describeGeneratedOutfit(items);
}

function generateOutfits(items, occasion, criteria, matchesContext, likedIds = new Set()) {
  const byCategory = (category) => items.filter((item) => item.category === category &&
    (!occasion || item.occasions.includes(occasion)));
  if (occasion && !Object.hasOwn(occasionNames, occasion)) return [];
  const bases = byCategory('tops').flatMap((top) =>
    byCategory('bottoms').filter((bottom) => coordinatedColors([top, bottom]) &&
      intersectOutfitTags([top, bottom], 'dressCodes').length).map((bottom) => [top, bottom]));
  bases.push(...byCategory('dresses').map((dress) => [dress]));
  const shoes = byCategory('shoes');
  const layers = byCategory('outerwear');
  const accessories = byCategory('accessories');
  const result = [];
  for (const body of bases) {
    const compatible = [];
    const retained = [];
    for (const shoe of shoes) {
      if (!coordinatedColors([...body, shoe]) ||
          !intersectOutfitTags([...body, shoe], 'dressCodes').length) continue;
      if (['gown', 'cocktail'].includes(body[0].shape) && shoe.shape !== 'heel') continue;
      for (const layer of [null, ...layers]) {
        const core = layer ? [...body, shoe, layer] : [...body, shoe];
        if (!outfitShapeWorks(body[0], body[1], shoe, layer) || !coordinatedColors(core) ||
            !intersectOutfitTags(core, 'dressCodes').length) continue;
        const outfit = describeGeneratedOutfit(core);
        if (!fits(outfit)) continue;
        const canAddAccessory = (item) => {
          if (['belt', 'scarf', 'silk'].includes(item.shape)) return false;
          if (outfit.context['dress-code'].includes('dressy') &&
              !['jewelry', 'clutch'].includes(item.shape)) return false;
          return coordinatedColors([...core, item]) && Object.entries(outfit.context).every(([field, values]) => {
            const tags = field === 'dress-code' ? item.dressCodes : item[field];
            return values.every((value) => tags.includes(value));
          });
        };
        const outdoors = criteria.some(({ field, value }) => field === 'setting' && value === 'outdoors');
        const accessory = accessories.find((item) => (item.shape !== 'sun' || outdoors) && canAddAccessory(item));
        // Prefer footwear with a clear role and layers that add a usable temperature band.
        const quality = Number(!['active', 'trail', 'slide'].includes(shoe.shape)) +
          Number(shoe.activity.includes('walking')) +
          Number(layer && !body.every((item) => item.weather.includes('cool'))) +
          (occasion === 'work' ? Number(['loafer', 'flat', 'heel'].includes(shoe.shape)) * 2 +
            Number(body.some(({ shape }) => ['tailored', 'dress', 'wide'].includes(shape))) : 0) +
          (occasion === 'date-night' || occasion === 'party' ?
            Number(outfit.context['dress-code'].includes('dressy')) +
            Number(body.length === 1 || body.some(({ shape }) => ['statement', 'fluid'].includes(shape))) : 0);
        const choice = accessory ? describeGeneratedOutfit([...core, accessory]) : outfit;
        compatible.push({ ...choice, quality });
        if (accessory && likedIds.has(outfit.id)) retained.push({ ...outfit, quality });
        if (likedIds.size) {
          for (const item of accessories) {
            if (item === accessory || !likedIds.has(`${outfit.id}+${item.id}`) || !canAddAccessory(item)) continue;
            const liked = describeGeneratedOutfit([...core, item]);
            if (fits(liked)) retained.push({ ...liked, quality });
          }
        }
      }
    }
    compatible.sort((a, b) => b.quality - a.quality || a.id.localeCompare(b.id));
    // Keep the discovery pool small while letting all eligible Likes reach ranking.
    result.push(...compatible.filter(({ id }, index) => index < 2 || likedIds.has(id)), ...retained);
  }
  return result;

  function fits(outfit) {
    return outfit.occasions.length > 0 && (!occasion || outfit.occasions.includes(occasion)) &&
      outfit.context.weather.length > 0 && outfit.context.setting.length > 0 &&
      outfit.context.activity.length > 0 && matchesContext(outfit.context, criteria).missed.length === 0;
  }
}

if (typeof module !== 'undefined') {
  module.exports = { generateOutfits, generatedOutfitId, resolveGeneratedOutfit, coordinatedColors, outfitShapeWorks };
}
