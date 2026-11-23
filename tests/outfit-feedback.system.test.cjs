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
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.jpg': 'image/jpeg' };
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  t.after(() => browser.close());
  const context = await browser.newContext(options);
  const page = await context.newPage();
  // External fonts are irrelevant to feedback; keep the test independent of Google.
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return { page, errors, base: `http://127.0.0.1:${server.address().port}` };
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
  const worn = page.getByRole('button', { name: 'Worn today — Everyday Casual', exact: true });
  const log = page.getByRole('button', { name: 'I wore this — Everyday Casual', exact: true });

  // UTC is already November 23, but it is still November 22 in New York.
  await page.clock.setFixedTime(new Date('2026-11-23T04:30:00Z'));
  await page.goto(casual);
  await history.click();
  await page.getByText('No outfits worn yet. Log an outfit to start your wear history.').waitFor();
  await page.getByRole('button', { name: 'Explore outfits' }).click();
  await page.getByRole('heading', { name: 'Casual Weekend outfit ideas' }).waitFor();
  await page.getByRole('button', { name: 'Save Everyday Casual' }).click();
  await page.getByRole('button', { name: 'Thumbs down for Everyday Casual' }).click();
  await log.click();
  assert.equal(await worn.getAttribute('aria-disabled'), 'true');
  // Exercise the duplicate guard even if a repeat click bypasses normal UI restrictions.
  await worn.evaluate((button) => { button.click(); button.click(); });
  assert.equal(await summary.innerText(), 'Worn 1 time · Last worn Nov 22, 2026');
  await page.reload();
  assert.equal(await worn.isVisible(), true);
  assert.deepEqual(await page.locator('.outfit-grid .outfit-card:visible h3').allTextContents(),
    ['Weekend Outing', 'Everyday Casual']);

  await page.clock.setFixedTime(new Date('2026-11-23T05:30:00Z'));
  await page.reload();
  await log.click();
  assert.equal(await summary.innerText(), 'Worn 2 times · Last worn Nov 23, 2026');
  await page.goto(work);
  await page.getByRole('button', { name: 'I wore this — Office Polish', exact: true }).click();
  await history.click();
  await page.getByRole('heading', { name: 'Wear History', exact: true }).waitFor();
  assert.deepEqual(await rows.locator('h2').allTextContents(), ['Office Polish', 'Everyday Casual', 'Everyday Casual']);
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
  await page.getByRole('button', { name: "Undo today's wear for Everyday Casual", exact: true }).click();
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

test('system: blocked storage supports wear logging and undo for the visit', async (t) => {
  const { page, errors, base } = await openFitCheck(t);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Blocked', 'SecurityError'); },
    });
  });
  await page.goto(`${base}/outfits.html`);
  await page.getByRole('button', { name: 'I wore this — Everyday Casual' }).click();
  assert.match(await page.locator('#wear-history-status').innerText(), /Browser storage is unavailable/);
  await page.getByRole('link', { name: 'Wear History', exact: true }).click();
  await page.getByRole('heading', { name: 'Wear History', exact: true }).waitFor();
  assert.deepEqual(await page.locator('#wear-history-list h2').allTextContents(), ['Everyday Casual']);
  await page.getByRole('link', { name: 'All Outfits', exact: true }).click();
  await page.getByRole('button', { name: "Undo today's wear for Everyday Casual" }).click();
  await page.getByRole('link', { name: 'Wear History', exact: true }).click();
  await page.getByText('No outfits worn yet. Log an outfit to start your wear history.').waitFor();
  assert.deepEqual(errors, []);
});
