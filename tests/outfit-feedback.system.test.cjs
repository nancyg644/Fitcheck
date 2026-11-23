const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

async function openFitCheck(t, options) {
  // Serve the production files at a real HTTP origin for browser localStorage.
  const root = path.resolve(__dirname, '..');
  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(root, `.${decodeURIComponent(pathname)}`);
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await fs.readFile(file);
      const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg' };
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  t.after(async () => {
    try {
      await browser?.close();
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  const context = await browser.newContext(options);
  const page = await context.newPage();
  // External fonts are irrelevant to feedback; keep the test independent of Google.
  await context.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await context.route('https://fonts.gstatic.com/**', (route) => route.abort());
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return { page, errors, base: `http://127.0.0.1:${server.address().port}` };
}

async function logWear(page, outfit, date) {
  await page.getByRole('button', { name: `Log wear for ${outfit}`, exact: true }).click();
  if (date) await page.getByLabel('Date worn').fill(date);
  await page.getByRole('button', { name: 'Save wear', exact: true }).click();
}

test('system: real Like/Dislike buttons remain mutually exclusive and survive refresh', async (t) => {
  const { page, errors, base } = await openFitCheck(t);
  await page.goto(`${base}/outfits.html`);
  const group = page.getByRole('group', { name: 'Feedback for Everyday Casual', exact: true });
  const like = group.getByRole('button', { name: 'Thumbs up for Everyday Casual', exact: true });
  const dislike = group.getByRole('button', { name: 'Thumbs down for Everyday Casual', exact: true });
  async function checkSelection(up, down) {
    assert.equal(await like.getAttribute('aria-pressed'), up);
    assert.equal(await dislike.getAttribute('aria-pressed'), down);
    // The pressed state must also produce a visible distinction through real CSS.
    const colors = await Promise.all([like, dislike].map((button) =>
      button.evaluate((element) => getComputedStyle(element).backgroundColor)));
    assert.notEqual(colors[0], colors[1]);
  }
  await like.click();
  await checkSelection('true', 'false');
  await dislike.click();
  await checkSelection('false', 'true');
  await page.reload();
  await checkSelection('false', 'true');
  assert.deepEqual(errors, []);
});

test('system: all five Home cards navigate to the matching outfits on mobile', async (t) => {
  const { page, errors, base } = await openFitCheck(t, { viewport: { width: 320, height: 700 } });
  const occasions = [
    ['Work', 'work', ['Smart Casual', 'Office Polish']],
    ['Dinner Out', 'dinner-out', ['Smart Casual', 'Satin After Dark']],
    ['Date Night', 'date-night', ['Satin After Dark', 'Burgundy Evening']],
    ['Casual Weekend', 'casual-weekend', ['Everyday Casual', 'Weekend Outing']],
    ['Party', 'party', ['Burgundy Evening', 'Silver Spotlight']],
  ];

  for (const [name, slug, titles] of occasions) {
    await page.goto(`${base}/index.html`);
    await page.locator('.occasion-grid').getByRole('link', { name: new RegExp(`^${name}`) }).click();
    await page.waitForURL(`${base}/outfits.html?occasion=${slug}`, { waitUntil: 'load' });
    assert.equal(await page.getByRole('heading', { level: 1 }).innerText(), `${name} outfit ideas`);
    assert.equal(await page.getByRole('link', { name, exact: true }).getAttribute('aria-current'), 'page');
    assert.deepEqual(await page.locator('.outfit-card:visible h3').allTextContents(), titles);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
  }

  const partyLike = page.getByRole('button', { name: 'Thumbs up for Burgundy Evening' });
  await partyLike.click();
  await page.getByRole('link', { name: 'Date Night', exact: true }).click();
  await page.waitForURL(`${base}/outfits.html?occasion=date-night`, { waitUntil: 'load' });
  assert.deepEqual(await page.locator('.outfit-card:visible h3').allTextContents(), ['Burgundy Evening', 'Satin After Dark']);
  assert.equal(await partyLike.getAttribute('aria-pressed'), 'true');
  await page.getByRole('link', { name: 'Any occasion', exact: true }).click();
  await page.waitForURL(`${base}/outfits.html`, { waitUntil: 'load' });
  assert.equal(await page.locator('.outfit-card:visible').count(), 7);
  assert.equal(await partyLike.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(errors, []);
});

test('system: feedback personalizes eligible outfits on refresh and can be reset', async (t) => {
  const { page, errors, base } = await openFitCheck(t);
  const titles = () => page.locator('.outfit-card:visible h3').allTextContents();
  const recommended = () => page.locator('.outfit-card:visible').filter({
    has: page.getByText('Recommended for you', { exact: true }),
  }).locator('h3').allTextContents();
  const weekend = `${base}/outfits.html?occasion=casual-weekend`;
  await page.goto(weekend);
  await page.evaluate(() => localStorage.setItem('fitcheck:unrelated', 'keep'));
  assert.deepEqual(await recommended(), []);
  const dislike = page.getByRole('button', { name: 'Thumbs down for Everyday Casual' });
  const like = page.getByRole('button', { name: 'Thumbs up for Everyday Casual' });

  await dislike.click();
  assert.deepEqual(await titles(), ['Everyday Casual', 'Weekend Outing']);
  await page.reload();
  assert.deepEqual(await titles(), ['Weekend Outing', 'Everyday Casual']);
  assert.equal(await dislike.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await recommended(), []);

  await like.click();
  assert.deepEqual(await titles(), ['Weekend Outing', 'Everyday Casual']);
  await page.reload();
  assert.deepEqual(await titles(), ['Everyday Casual', 'Weekend Outing']);
  assert.deepEqual(await recommended(), ['Everyday Casual', 'Weekend Outing']);
  assert.equal(await like.getAttribute('aria-pressed'), 'true');

  await Promise.all([
    page.waitForURL(`${base}/outfits.html?occasion=work`, { waitUntil: 'load' }),
    page.getByRole('link', { name: 'Work', exact: true }).click(),
  ]);
  assert.deepEqual(await titles(), ['Smart Casual', 'Office Polish']);
  assert.deepEqual(await recommended(), ['Smart Casual']);
  const reset = page.getByRole('button', { name: 'Reset recommendation preferences' });
  page.once('dialog', (dialog) => dialog.dismiss());
  await reset.click();
  assert.deepEqual(await recommended(), ['Smart Casual']);

  page.once('dialog', (dialog) => dialog.accept());
  await Promise.all([page.waitForEvent('load'), reset.click()]);
  assert.equal(page.url(), `${base}/outfits.html?occasion=work`);
  assert.deepEqual(await recommended(), []);
  assert.equal(await page.evaluate(() => localStorage.getItem('fitcheck:unrelated')), 'keep');
  await page.goto(weekend);
  assert.equal(await like.getAttribute('aria-pressed'), 'false');
  assert.equal(await dislike.getAttribute('aria-pressed'), 'false');
  assert.deepEqual(await titles(), ['Everyday Casual', 'Weekend Outing']);
  assert.deepEqual(errors, []);
});

test('system: unknown and empty occasions offer a path back to outfits', async (t) => {
  const { page, errors, base } = await openFitCheck(t);
  await page.goto(`${base}/outfits.html?occasion=unknown`);
  assert.equal(await page.getByRole('heading', { level: 1 }).innerText(), 'Occasion unavailable');
  assert.equal(await page.locator('.outfit-card:visible').count(), 0);
  assert.equal(await page.getByText('No outfits match this occasion.', { exact: false }).isVisible(), true);

  // Keep Party selectable but simulate a catalog with no Party recommendations.
  await page.route('**/outfits.html?occasion=party', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/data-occasions="([^"]*)"/g, (_, tags) =>
      `data-occasions="${tags.split(' ').filter((tag) => tag !== 'party').join(' ')}"`);
    await route.fulfill({ response, body });
  });
  await page.getByRole('link', { name: 'Party', exact: true }).click();
  await page.waitForURL(`${base}/outfits.html?occasion=party`, { waitUntil: 'load' });
  assert.equal(await page.getByRole('heading', { level: 1 }).innerText(), 'Party outfit ideas');
  assert.equal(await page.locator('.outfit-card:visible').count(), 0);
  assert.equal(await page.getByText('No outfits match this occasion.', { exact: false }).isVisible(), true);
  await page.getByRole('link', { name: 'Any occasion', exact: true }).click();
  await page.waitForURL(`${base}/outfits.html`, { waitUntil: 'load' });
  assert.equal(await page.locator('.outfit-card:visible').count(), 7);
  assert.deepEqual(errors, []);
});

test('system: bookmarks persist across occasions and restore the personalized view', async (t) => {
  const { page, errors, base } = await openFitCheck(t, { viewport: { width: 320, height: 700 } });
  const titles = () => page.locator('.outfit-card:visible h3').allTextContents();
  const savedView = (count) => page.getByRole('link', { name: `Saved (${count})`, exact: true });
  const save = (name) => page.getByRole('button', { name: `Save ${name}`, exact: true });
  const casual = `${base}/outfits.html?occasion=casual-weekend`;
  const work = `${base}/outfits.html?occasion=work`;
  await page.goto(casual);
  await savedView(0).click();
  await page.getByText('Your favorite looks, all in one place. Save outfits you love to revisit them later.', { exact: true }).waitFor();
  assert.deepEqual(await titles(), []);
  await page.getByRole('button', { name: 'Explore outfits' }).click();
  await page.getByRole('heading', { name: 'Casual Weekend outfit ideas' }).waitFor();
  await save('Everyday Casual').click();
  assert.equal(await save('Everyday Casual').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('button', { name: 'Thumbs up for Everyday Casual' }).getAttribute('aria-pressed'), 'false');
  assert.equal(await savedView(1).isVisible(), true);

  await page.goto(work);
  await save('Office Polish').click();
  const dislike = page.getByRole('button', { name: 'Thumbs down for Smart Casual' });
  await dislike.click();
  await page.reload();
  assert.deepEqual(await titles(), ['Office Polish', 'Smart Casual']);

  await savedView(2).click();
  await page.getByRole('heading', { name: 'Saved outfits', exact: true }).waitFor();
  assert.equal(await page.getByRole('navigation', { name: 'Filter outfits by occasion' }).isVisible(), false);
  assert.deepEqual((await titles()).sort(), ['Everyday Casual', 'Office Polish']);
  await page.reload();
  assert.deepEqual((await titles()).sort(), ['Everyday Casual', 'Office Polish']);
  assert.equal(await save('Everyday Casual').getAttribute('aria-pressed'), 'true');
  await save('Everyday Casual').click();
  assert.deepEqual(await titles(), ['Office Polish']);
  assert.equal(await savedView(1).isVisible(), true);
  await page.getByRole('link', { name: 'All Outfits', exact: true }).click();
  await page.getByRole('heading', { name: 'Work outfit ideas' }).waitFor();
  assert.deepEqual(await titles(), ['Office Polish', 'Smart Casual']);
  assert.equal(await dislike.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('link', { name: 'Work', exact: true }).getAttribute('aria-current'), 'page');

  await savedView(1).click();
  await page.getByRole('heading', { name: 'Saved outfits', exact: true }).waitFor();
  await save('Office Polish').click();
  const explore = page.getByRole('button', { name: 'Explore outfits' });
  assert.equal(await explore.isVisible(), true);
  assert.equal(await explore.evaluate((button) => button === document.activeElement), true);
  await page.goto(`${work}#saved`);
  assert.equal(await savedView(0).isVisible(), true);
  assert.deepEqual(await titles(), []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
  assert.deepEqual(errors, []);
});

test('system: blocked storage keeps bookmarks usable for the current visit', async (t) => {
  const { page, errors, base } = await openFitCheck(t);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Blocked', 'SecurityError'); },
    });
  });
  await page.goto(`${base}/outfits.html`);
  await page.getByRole('button', { name: 'Save Everyday Casual' }).click();
  assert.match(await page.locator('#saved-outfits-status').innerText(), /Browser storage is unavailable/);
  await page.getByRole('link', { name: 'Saved (1)' }).click();
  await page.getByRole('heading', { name: 'Saved outfits', exact: true }).waitFor();
  assert.deepEqual(await page.locator('.outfit-card:visible h3').allTextContents(), ['Everyday Casual']);
  await page.reload();
  assert.equal(await page.getByRole('button', { name: 'Explore outfits' }).isVisible(), true);
  assert.deepEqual(errors, []);
});

test('system: wear logging follows local dates and preserves bookmarks and recommendations', async (t) => {
  const { page, errors, base } = await openFitCheck(t, {
    locale: 'en-US', timezoneId: 'America/New_York', viewport: { width: 320, height: 700 },
  });
  const casual = `${base}/outfits.html?occasion=casual-weekend`;
  const work = `${base}/outfits.html?occasion=work`;
  const history = page.getByRole('link', { name: 'Wear History', exact: true });
  const all = page.getByRole('link', { name: 'All Outfits', exact: true });
  const rows = page.locator('#wear-history-list li');
  const summary = page.locator('.outfit-card').filter({
    has: page.getByRole('heading', { name: 'Everyday Casual', exact: true, level: 3 }),
  }).locator('.wear-summary');
  const log = page.getByRole('button', { name: 'Log wear for Everyday Casual', exact: true });

  // UTC is already November 23, but it is still November 22 in New York.
  await page.clock.setFixedTime(new Date('2026-11-23T04:30:00Z'));
  await page.goto(casual);
  await history.click();
  await page.getByText('No outfits worn yet. Log an outfit to start your wear history.').waitFor();
  await page.getByRole('button', { name: 'Explore outfits' }).click();
  await page.getByRole('heading', { name: 'Casual Weekend outfit ideas' }).waitFor();
  await page.getByRole('button', { name: 'Save Everyday Casual' }).click();
  await page.getByRole('button', { name: 'Thumbs down for Everyday Casual' }).click();
  await log.press('Enter');
  const date = page.getByLabel('Date worn');
  assert.equal(await date.evaluate((input) => document.activeElement === input), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').isVisible(), false);
  assert.equal(await log.evaluate((button) => document.activeElement === button), true);
  await log.press('Enter');
  assert.equal(await date.inputValue(), '2026-11-22');
  assert.equal(await date.getAttribute('max'), '2026-11-22');
  await date.fill('2026-11-23');
  await page.getByRole('button', { name: 'Save wear' }).click();
  assert.match(await page.locator('#wear-date-error').innerText(), /today or earlier/);
  await date.fill('');
  await page.getByRole('button', { name: 'Save wear' }).click();
  assert.match(await page.locator('#wear-date-error').innerText(), /valid date/);
  await date.fill('2026-11-22');
  await page.getByRole('button', { name: 'Save wear' }).evaluate((button) => { button.click(); button.click(); });
  assert.equal(await summary.innerText(), 'Worn 1 time · Last worn Nov 22, 2026');
  await page.reload();
  assert.equal(await log.isVisible(), true);
  assert.deepEqual(await page.locator('.outfit-grid .outfit-card:visible h3').allTextContents(),
    ['Weekend Outing', 'Everyday Casual']);

  await page.clock.setFixedTime(new Date('2026-11-23T05:30:00Z'));
  await page.reload();
  await logWear(page, 'Everyday Casual');
  assert.equal(await summary.innerText(), 'Worn 2 times · Last worn Nov 23, 2026');
  await page.goto(work);
  await logWear(page, 'Office Polish');
  await history.click();
  await page.getByRole('heading', { name: 'Wear History', exact: true }).waitFor();
  assert.deepEqual((await rows.locator('h2').allTextContents()).sort(), ['Everyday Casual', 'Everyday Casual', 'Office Polish']);
  assert.deepEqual(await rows.locator('time').evaluateAll((dates) => dates.map((date) => date.dateTime)),
    ['2026-11-23', '2026-11-23', '2026-11-22']);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
  await page.reload();
  assert.equal(await rows.count(), 3);
  await all.click();
  await page.getByRole('heading', { name: 'Work outfit ideas' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Work', exact: true }).getAttribute('aria-current'), 'page');

  await page.getByRole('link', { name: 'Saved (1)', exact: true }).click();
  await page.getByRole('heading', { name: 'Saved outfits', exact: true }).waitFor();
  await page.getByRole('button', { name: 'View wears for Everyday Casual' }).click();
  await page.getByRole('heading', { name: 'Wear History', exact: true }).waitFor();
  assert.equal(await rows.count(), 2);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete wear for Everyday Casual on Nov 23, 2026' }).click();
  await page.getByRole('link', { name: 'Saved (1)', exact: true }).click();
  await page.getByRole('heading', { name: 'Saved outfits', exact: true }).waitFor();
  assert.equal(await log.isVisible(), true);
  assert.equal(await summary.innerText(), 'Worn 1 time · Last worn Nov 22, 2026');
  assert.equal(await page.getByRole('button', { name: 'Save Everyday Casual' }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('button', { name: 'Thumbs down for Everyday Casual' }).getAttribute('aria-pressed'), 'true');
  await history.click();
  await page.getByRole('heading', { name: 'Wear History', exact: true }).waitFor();
  await page.reload();
  assert.deepEqual(await rows.locator('time').evaluateAll((dates) => dates.map((date) => date.dateTime)),
    ['2026-11-23', '2026-11-22']);
  assert.deepEqual(errors, []);
});

test('system: blocked storage supports wear logging and deletion for the visit', async (t) => {
  const { page, errors, base } = await openFitCheck(t);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Blocked', 'SecurityError'); },
    });
  });
  await page.goto(`${base}/outfits.html`);
  await logWear(page, 'Everyday Casual');
  assert.match(await page.locator('#wear-history-status').innerText(), /Browser storage is unavailable/);
  await page.getByRole('link', { name: 'Wear History', exact: true }).click();
  await page.getByRole('heading', { name: 'Wear History', exact: true }).waitFor();
  assert.deepEqual(await page.locator('#wear-history-list h2').allTextContents(), ['Everyday Casual']);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /Delete wear for Everyday Casual/ }).click();
  await page.getByText('No outfits worn yet. Log an outfit to start your wear history.').waitFor();
  assert.deepEqual(errors, []);
});

test('system: past and same-day wear entries stay independent through edits and refresh', async (t) => {
  const { page, errors, base } = await openFitCheck(t, { locale: 'en-US', timezoneId: 'America/New_York' });
  await page.clock.setFixedTime(new Date('2026-11-23T15:00:00Z'));
  await page.goto(`${base}/outfits.html?occasion=casual-weekend`);
  await page.evaluate(() => {
    localStorage.setItem('fitcheck:wear-history', JSON.stringify([
      { outfitId: 'everyday-casual', date: '2026-11-10' },
    ]));
    localStorage.setItem('fitcheck:wear-history:2026-11-15:everyday-casual', '100');
  });
  await page.reload();
  await logWear(page, 'Everyday Casual', '2026-11-15');
  await logWear(page, 'Everyday Casual', '2026-11-23');
  assert.equal(await page.getByText('Worn 4 times · Last worn Nov 23, 2026', { exact: true }).isVisible(), true);
  await page.getByRole('button', { name: 'View wears for Everyday Casual', exact: true }).click();
  await page.getByRole('heading', { name: 'Wear History', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Outfit', { exact: true }).inputValue(), 'everyday-casual');
  const rows = page.locator('#wear-history-list li');
  const dates = () => rows.locator('time').evaluateAll((nodes) => nodes.map((node) => node.dateTime));
  assert.deepEqual(await dates(), ['2026-11-23', '2026-11-15', '2026-11-15', '2026-11-10']);
  const ids = await rows.evaluateAll((nodes) => nodes.map((node) => node.dataset.wearId));
  assert.equal(new Set(ids).size, 4);
  await page.getByRole('button', { name: 'Edit date for Everyday Casual on Nov 10, 2026', exact: true }).click();
  await page.getByLabel('Date worn').fill('2026-11-18');
  await page.getByRole('button', { name: 'Save wear' }).click();
  assert.deepEqual(await dates(), ['2026-11-23', '2026-11-18', '2026-11-15', '2026-11-15']);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete wear for Everyday Casual on Nov 15, 2026', exact: true }).first().click();
  await page.reload();
  assert.deepEqual(await dates(), ['2026-11-23', '2026-11-18', '2026-11-15']);
  assert.deepEqual(errors, []);
});

test('system: profile links, multiple choices, ranking explanations, and isolated reset', async (t) => {
  const { page, base, errors } = await openFitCheck(t, { viewport: { width: 320, height: 700 } });
  const profile = `${base}/profile.html`;
  const work = `${base}/outfits.html?occasion=work`;
  const profileLink = page.getByRole('link', { name: 'Style profile', exact: true });
  const titles = () => page.locator('.outfit-grid .outfit-card:visible h3').allTextContents();
  for (const file of ['index.html', 'outfits.html', 'wardrobe.html', 'cost-per-wear.html']) {
    await page.goto(`${base}/${file}`);
    await profileLink.click();
    await page.waitForURL(profile, { waitUntil: 'load' });
    assert.equal(await page.getByRole('heading', { name: 'Your style profile' }).isVisible(), true);
  }
  assert.equal(await profileLink.getAttribute('aria-current'), 'page');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
  assert.equal(await page.getByRole('checkbox').count(), 11);
  assert.equal(await page.getByRole('radio').count(), 3);
  const preferences = ['Minimalist', 'Bold', 'Neutrals', 'Pastels'];
  for (const name of preferences) await page.getByRole('checkbox', { name, exact: true }).check();
  await page.getByRole('radio', { name: 'Comfort first', exact: true }).check();
  await page.getByRole('radio', { name: 'Balanced', exact: true }).check();
  assert.equal(await page.getByRole('radio', { name: 'Comfort first', exact: true }).isChecked(), false);
  await page.getByRole('button', { name: 'Save My Preferences', exact: true }).click();
  assert.equal(await page.getByRole('status').innerText(), 'Style preferences saved.');
  await page.reload();
  for (const name of preferences) assert.equal(await page.getByRole('checkbox', { name, exact: true }).isChecked(), true);
  assert.equal(await page.getByRole('radio', { name: 'Balanced', exact: true }).isChecked(), true);

  await page.goto(work);
  assert.deepEqual(await titles(), ['Office Polish', 'Smart Casual']);
  assert.equal(await page.getByText('Matches your preferences for minimalist styles, neutral colors, and balanced outfits.', { exact: true }).isVisible(), true);
  assert.equal(await page.getByText('Matches your preferences for pastels and balanced outfits.', { exact: true }).isVisible(), true);
  await page.getByRole('button', { name: 'Thumbs up for Smart Casual', exact: true }).click();
  await page.getByRole('button', { name: 'Save Office Polish', exact: true }).click();
  await logWear(page, 'Office Polish');
  await page.reload();
  assert.deepEqual(await titles(), ['Smart Casual', 'Office Polish']);

  await profileLink.click();
  await page.waitForURL(profile, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Reset Preferences', exact: true }).click();
  assert.equal(await page.getByRole('status').innerText(), 'Style preferences reset.');
  await page.reload();
  assert.equal(await page.locator('#style-profile input:checked').count(), 0);
  await page.goto(work);
  assert.deepEqual(await titles(), ['Smart Casual', 'Office Polish']);
  assert.equal(await page.getByText('You liked this outfit.', { exact: true }).isVisible(), true);
  assert.equal(await page.getByText(/Matches your preferences/).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Thumbs up for Smart Casual', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('link', { name: 'Saved (1)', exact: true }).isVisible(), true);
  await page.getByRole('link', { name: 'Wear History', exact: true }).click();
  await page.getByRole('heading', { name: 'Wear History', exact: true }).waitFor();
  assert.deepEqual(await page.locator('#wear-history-list h2').allTextContents(), ['Office Polish']);
  assert.deepEqual(errors, []);
});

test('system: a blocked style profile leaves outfit recommendations available', async (t) => {
  const { page, base, errors } = await openFitCheck(t);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Blocked', 'SecurityError'); },
    });
  });
  await page.goto(`${base}/profile.html`);
  await page.getByRole('checkbox', { name: 'Classic', exact: true }).check();
  await page.getByRole('button', { name: 'Save My Preferences', exact: true }).click();
  assert.match(await page.getByRole('status').innerText(), /could not be saved/);
  await page.goto(`${base}/outfits.html?occasion=work`);
  assert.deepEqual(await page.locator('.outfit-grid .outfit-card:visible h3').allTextContents(), ['Smart Casual', 'Office Polish']);
  assert.equal(await page.getByText('Recommended for you', { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
});

test('system: strict contextual filters exclude partial matches and preserve the other views', async (t) => {
  const { page, base, errors } = await openFitCheck(t, { viewport: { width: 320, height: 700 } });
  const weekend = `${base}/outfits.html?occasion=casual-weekend`;
  const refine = page.locator('#refine-outfit');
  const titles = () => page.locator('.outfit-grid .outfit-card:visible h3').allTextContents();
  const noResults = page.getByText('No outfits match all your selected filters. Try adjusting your preferences to see more options.', { exact: true });
  const apply = async (url) => {
    await page.getByRole('button', { name: 'Apply context' }).click();
    await page.waitForURL(url, { waitUntil: 'load' });
  };
  await page.goto(weekend);
  const profile = JSON.stringify({ styles: ['classic'], colors: ['neutrals'], priority: 'comfort-first' });
  await page.evaluate((profile) => localStorage.setItem('fitcheck:style-preferences', profile), profile);
  await page.getByRole('button', { name: 'Thumbs up for Everyday Casual' }).click();
  await page.getByRole('button', { name: 'Save Everyday Casual' }).click();
  await logWear(page, 'Everyday Casual');
  await page.reload();
  assert.deepEqual(await titles(), ['Everyday Casual', 'Weekend Outing']);
  assert.equal(await refine.getAttribute('open'), null);
  await page.getByText('Refine your outfit', { exact: true }).click();
  await page.getByLabel('Weather').selectOption('hot');
  await apply(`${weekend}&weather=hot`);
  assert.deepEqual(await titles(), ['Weekend Outing']);
  assert.equal(await page.getByText('Matches hot weather.', { exact: true }).isVisible(), true);
  assert.equal(await noResults.isVisible(), false);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);

  await page.getByLabel('Dress code').selectOption('dressy');
  await page.getByLabel('Setting').selectOption('both');
  await page.getByLabel('Activity level').selectOption('walking');
  await apply(`${weekend}&weather=hot&dress-code=dressy&setting=both&activity=walking`);
  assert.deepEqual(await titles(), []);
  assert.equal(await noResults.isVisible(), true);

  await page.getByRole('link', { name: 'Saved (1)', exact: true }).click();
  await page.getByRole('heading', { name: 'Saved outfits', exact: true }).waitFor();
  assert.deepEqual(await titles(), ['Everyday Casual']);
  assert.equal(await refine.isVisible(), false);
  assert.equal(await noResults.isVisible(), false);
  await page.getByRole('link', { name: 'Wear History', exact: true }).click();
  await page.getByRole('heading', { name: 'Wear History', exact: true }).waitFor();
  assert.deepEqual(await page.locator('#wear-history-list h2').allTextContents(), ['Everyday Casual']);
  await page.getByRole('link', { name: 'All Outfits', exact: true }).click();
  await page.getByRole('heading', { name: 'Casual Weekend outfit ideas', exact: true }).waitFor();
  assert.deepEqual(await titles(), []);
  assert.equal(await page.getByLabel('Dress code').inputValue(), 'dressy');

  await page.getByLabel('Dress code').selectOption({ label: 'No preference' });
  await apply(`${weekend}&weather=hot&setting=both&activity=walking`);
  assert.deepEqual(await titles(), ['Weekend Outing']);
  assert.equal(await page.getByText(/Matches hot weather.*indoor and outdoor settings.*lots of walking/).isVisible(), true);
  assert.equal(await noResults.isVisible(), false);
  await page.getByLabel('Weather').selectOption('warm');
  await apply(`${weekend}&weather=warm&setting=both&activity=walking`);
  assert.deepEqual(await titles(), ['Everyday Casual', 'Weekend Outing']);
  await page.getByRole('link', { name: 'Reset context', exact: true }).click();
  await page.waitForURL(weekend, { waitUntil: 'load' });
  assert.deepEqual(await titles(), ['Everyday Casual', 'Weekend Outing']);
  assert.equal(await refine.getAttribute('open'), null);
  assert.equal(await page.getByRole('button', { name: 'Thumbs up for Everyday Casual' }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => localStorage.getItem('fitcheck:style-preferences')), profile);
  assert.deepEqual(errors, []);
});

test('system: invalid context is ignored and an unknown occasion stays empty', async (t) => {
  const { page, base, errors } = await openFitCheck(t);
  await page.goto(`${base}/outfits.html?occasion=work&weather=freezing&activity=unknown`);
  assert.deepEqual(await page.locator('.outfit-grid .outfit-card:visible h3').allTextContents(), ['Smart Casual', 'Office Polish']);
  assert.equal(await page.locator('.context-explanation').count(), 0);
  await page.goto(`${base}/outfits.html?occasion=unknown&weather=warm`);
  assert.equal(await page.locator('#occasion-empty').isVisible(), true);
  assert.equal(await page.locator('#context-empty').isVisible(), false);
  assert.equal(await page.locator('.outfit-grid .outfit-card:visible').count(), 0);

  await page.goto(`${base}/cost-per-wear.html`);
  await page.getByLabel('Purchase price ($)').fill('20');
  await page.getByLabel('Number of times worn').fill('4');
  await page.getByRole('button', { name: 'Calculate', exact: true }).click();
  assert.equal(await page.locator('#result-amount').innerText(), '$5.00');
  assert.deepEqual(errors, []);
});

test('system: two tabs preserve independent bookmarks and wears and reflect removals', async (t) => {
  const { page: first, base, errors } = await openFitCheck(t);
  const second = await first.context().newPage();
  second.on('pageerror', (error) => errors.push(error.message));
  const url = `${base}/outfits.html`;
  await Promise.all([first.goto(url), second.goto(url)]);
  const button = (page, name) => page.getByRole('button', { name, exact: true });
  const link = (page, name) => page.getByRole('link', { name, exact: true });
  await Promise.all([
    button(first, 'Save Everyday Casual').click(),
    button(second, 'Save Office Polish').click(),
  ]);
  for (const page of [first, second]) await link(page, 'Saved (2)').waitFor();
  await Promise.all([
    logWear(first, 'Everyday Casual'),
    logWear(second, 'Everyday Casual'),
  ]);
  await logWear(second, 'Office Polish');
  await link(second, 'Wear History').click();
  await second.getByRole('heading', { name: 'Wear History', exact: true }).waitFor();
  assert.deepEqual((await second.locator('#wear-history-list h2').allTextContents()).sort(),
    ['Everyday Casual', 'Everyday Casual', 'Office Polish']);

  await button(first, 'Save Everyday Casual').click();
  await button(first, 'View wears for Everyday Casual').click();
  await first.getByRole('heading', { name: 'Wear History', exact: true }).waitFor();
  first.once('dialog', (dialog) => dialog.accept());
  await first.getByRole('button', { name: /Delete wear for Everyday Casual/ }).first().click();
  await link(second, 'Saved (1)').waitFor();
  await second.waitForFunction(() => document.querySelectorAll('#wear-history-list li').length === 2);
  assert.deepEqual((await second.locator('#wear-history-list h2').allTextContents()).sort(), ['Everyday Casual', 'Office Polish']);
  await second.reload();
  assert.deepEqual((await second.locator('#wear-history-list h2').allTextContents()).sort(), ['Everyday Casual', 'Office Polish']);
  await link(second, 'Saved (1)').click();
  await second.getByRole('heading', { name: 'Saved outfits', exact: true }).waitFor();
  assert.deepEqual(await second.locator('.outfit-grid .outfit-card:visible h3').allTextContents(), ['Office Polish']);
  assert.deepEqual(errors, []);
});

test('system: feedback explanations follow switches and clears without rearranging cards', async (t) => {
  const { page, base } = await openFitCheck(t);
  await page.goto(`${base}/outfits.html?occasion=casual-weekend`);
  const card = (name) => page.locator('.outfit-grid .outfit-card').filter({
    has: page.getByRole('heading', { name, exact: true }),
  });
  const titles = () => page.locator('.outfit-grid .outfit-card:visible h3').allTextContents();
  const like = page.getByRole('button', { name: 'Thumbs up for Weekend Outing', exact: true });
  const dislike = page.getByRole('button', { name: 'Thumbs down for Weekend Outing', exact: true });
  await like.click();
  await page.reload();
  const original = await titles();
  assert.deepEqual(original, ['Weekend Outing', 'Everyday Casual']);
  assert.equal(await card('Weekend Outing').getByText('You liked this outfit.', { exact: true }).isVisible(), true);
  assert.equal(await card('Everyday Casual').getByText('Shares pieces with outfits you liked.', { exact: true }).isVisible(), true);
  await dislike.click();
  assert.equal(await page.locator('.recommendation-explanation').count(), 0);
  assert.deepEqual(await titles(), original);
  await like.click();
  assert.equal(await page.getByText('You liked this outfit.', { exact: true }).isVisible(), true);
  await like.click();
  assert.equal(await page.locator('.recommendation-explanation').count(), 0);
  assert.deepEqual(await titles(), original);
});

test('system: sticky navigation leaves keyboard focus visible at 320 pixels', async (t) => {
  const { page, base } = await openFitCheck(t, { viewport: { width: 320, height: 700 } });
  const cases = [
    ['/index.html', ['.occasion-grid a']],
    ['/outfits.html?occasion=casual-weekend&weather=hot', ['#refine-outfit summary', '#refine-outfit select', '#refine-outfit button']],
    ['/cost-per-wear.html', ['#purchase-price', '#times-worn', '#cost-form button']],
  ];
  for (const [path, selectors] of cases) {
    await page.goto(base + path);
    const targets = selectors.join(',');
    const total = await page.locator(targets).count();
    let checked = 0;
    for (let step = 0; step < 100 && checked < total; step++) {
      await page.keyboard.press('Tab');
      const bounds = await page.evaluate(async (targets) => {
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const focused = document.activeElement;
        if (!focused.matches(targets)) return null;
        const rect = focused.getBoundingClientRect();
        return {
          name: focused.name || focused.textContent.trim(),
          top: rect.top, bottom: rect.bottom, navTop: document.querySelector('.bottom-nav').getBoundingClientRect().top,
          outline: getComputedStyle(focused).outlineStyle,
        };
      }, targets);
      if (!bounds) continue;
      checked++;
      assert.ok(bounds.top >= -1 && bounds.bottom < bounds.navTop, `${path}: ${JSON.stringify(bounds)}`);
      assert.notEqual(bounds.outline, 'none', `${path}: ${bounds.name} has no outline`);
    }
    assert.equal(checked, total, path);
  }
});

test('system: Wardrobe combines category, season and destination and clears an empty result', async (t) => {
  const { page, base } = await openFitCheck(t);
  await page.goto(`${base}/index.html`);
  assert.equal(await page.locator('.wardrobe-banner h2').innerText(), 'My wardrobe →');
  await page.locator('.wardrobe-banner').click();
  await page.waitForURL(`${base}/wardrobe.html`, { waitUntil: 'load' });
  const total = await page.locator('.clothing-card').count();
  const visible = page.locator('.clothing-card:visible');
  await page.locator('[data-filter="shoes"]').click();
  await page.locator('#season-filter').selectOption('winter');
  await page.locator('#place-filter').selectOption('mountains');
  assert.deepEqual(await visible.locator('h3').allTextContents(), ['Taupe Hiking Boots']);
  await page.locator('#place-filter').selectOption('beach');
  assert.equal(await visible.count(), 0);
  assert.equal(await page.locator('#empty-state').isVisible(), true);
  await page.locator('#empty-state [data-clear-filters]').click();
  assert.equal(await visible.count(), total);
  assert.equal(await page.locator('[data-filter="all"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#season-filter').inputValue(), '');
  assert.equal(await page.locator('#place-filter').inputValue(), '');
});
