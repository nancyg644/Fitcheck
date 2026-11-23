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
    assert.equal(page.url(), `${base}/outfits.html?occasion=${slug}`);
    assert.equal(await page.getByRole('heading', { level: 1 }).innerText(), `${name} outfit ideas`);
    assert.equal(await page.getByRole('link', { name, exact: true }).getAttribute('aria-current'), 'page');
    assert.deepEqual(await page.locator('.outfit-card:visible h3').allTextContents(), titles);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
  }

  const partyLike = page.getByRole('button', { name: 'Thumbs up for Burgundy Evening' });
  await partyLike.click();
  await page.getByRole('link', { name: 'Date Night', exact: true }).click();
  assert.deepEqual(await page.locator('.outfit-card:visible h3').allTextContents(), occasions[2][2]);
  assert.equal(await partyLike.getAttribute('aria-pressed'), 'true');
  await page.getByRole('link', { name: 'All outfits', exact: true }).click();
  assert.equal(page.url(), `${base}/outfits.html`);
  assert.equal(await page.locator('.outfit-card:visible').count(), 7);
  assert.equal(await partyLike.getAttribute('aria-pressed'), 'true');
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
  assert.equal(await page.getByRole('heading', { level: 1 }).innerText(), 'Party outfit ideas');
  assert.equal(await page.locator('.outfit-card:visible').count(), 0);
  assert.equal(await page.getByText('No outfits match this occasion.', { exact: false }).isVisible(), true);
  await page.getByRole('link', { name: 'All outfits', exact: true }).click();
  assert.equal(await page.locator('.outfit-card:visible').count(), 7);
  assert.deepEqual(errors, []);
});
