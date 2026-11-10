const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

test('system: real Like/Dislike buttons remain mutually exclusive and survive refresh', async (t) => {
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
  const context = await browser.newContext();
  const page = await context.newPage();
  // External fonts are irrelevant to feedback; keep the test independent of Google.
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.route('https://fonts.gstatic.com/**', (route) => route.abort());
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/outfits.html`);
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
