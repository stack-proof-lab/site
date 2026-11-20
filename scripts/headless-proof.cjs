// Headless proof against `astro preview` (serves dist/, including /admin/ as a folder path).
// 1. Pagefind: load /pagefind/pagefind.js in the page and search for sample terms.
// 2. /admin/: load Sveltia, record console messages, page errors, failed requests and CSP reports.
// Usage: node scripts/headless-proof.cjs [path-to-playwright]  (or set PLAYWRIGHT_PATH)
const { spawn } = require('node:child_process');
const pwPath = process.argv[2] ?? process.env.PLAYWRIGHT_PATH ?? 'playwright';
const { chromium } = require(pwPath);
const PORT = 4329;
const BASE = `http://localhost:${PORT}`;

async function waitFor(url, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('preview did not start');
}

(async () => {
  const server = spawn('npx', ['astro', 'preview', '--port', String(PORT)], {
    shell: true,
    stdio: 'ignore',
  });
  let failed = false;
  try {
    await waitFor(`${BASE}/`);
    const browser = await chromium.launch();
    console.log('browser', browser.version());

    // 1. Pagefind
    const page = await browser.newPage();
    await page.goto(`${BASE}/findings/`);
    const results = await page.evaluate(async () => {
      const pf = await import('/pagefind/pagefind.js');
      await pf.init();
      const out = {};
      for (const term of ['zephyrine', 'quillwort', 'sample']) {
        const r = await pf.search(term);
        out[term] = await Promise.all(r.results.map(async (x) => (await x.data()).url));
      }
      return out;
    });
    for (const [term, urls] of Object.entries(results)) {
      console.log(`pagefind search "${term}": ${urls.length} result(s) ${JSON.stringify(urls)}`);
    }
    const ok =
      results.zephyrine.length === 1 &&
      /\/findings\/sample-finding-a\/?$/.test(results.zephyrine[0]) &&
      results.quillwort.length === 1 &&
      /\/papers\/sample-paper-b\/?$/.test(results.quillwort[0]) &&
      results.sample.length === 4 &&
      // Events, topics and the index pages also contain the word "Sample"; only findings and papers
      // carry data-pagefind-body, so only they may come back.
      results.sample.every((u) => /^\/(findings|papers)\/[^/]+\/$/.test(u));
    console.log(`PAGEFIND ${ok ? 'PASS' : 'FAIL'}`);
    if (!ok) failed = true;

    // 2. /admin/
    const admin = await browser.newPage();
    const consoleMsgs = [];
    const pageErrors = [];
    const failedReqs = [];
    const requests = [];
    admin.on('console', (m) => consoleMsgs.push(`${m.type()}: ${m.text()}`));
    admin.on('pageerror', (e) => pageErrors.push(String(e)));
    admin.on('requestfailed', (r) => failedReqs.push(`${r.url()} ${r.failure()?.errorText}`));
    admin.on('request', (r) => requests.push(r.url()));
    const resp = await admin.goto(`${BASE}/admin/`, { waitUntil: 'networkidle' });
    await admin.waitForTimeout(4000);
    const configFetched = requests.some((u) => u.includes('config.yml'));
    const sveltiaUrl = requests.find((u) => u.includes('sveltia-cms'));
    console.log(`requests: ${JSON.stringify(requests.map((u) => u.replace(BASE, '')))}`);
    const bodyText = (await admin.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
    const buttons = await admin.$$eval('button', (bs) => bs.map((b) => b.innerText.trim()).filter(Boolean));
    await admin.screenshot({ path: 'proof/admin.png', fullPage: true });
    console.log(`admin status ${resp.status()}; config.yml requested: ${configFetched}`);
    console.log(`admin visible text: ${bodyText.slice(0, 300)}`);
    console.log(`admin buttons: ${JSON.stringify(buttons)}`);
    const oauthShown = buttons.some((b) => /Sign In with GitHub/i.test(b));
    const tokenShown = buttons.some((b) => /Access Token/i.test(b));
    console.log(`token sign-in offered: ${tokenShown}; OAuth sign-in offered: ${oauthShown}`);
    console.log(`sveltia script: ${sveltiaUrl}`);
    console.log(`console messages (${consoleMsgs.length}):`);
    consoleMsgs.forEach((m) => console.log('  ' + m));
    console.log(`page errors (${pageErrors.length}):`);
    pageErrors.forEach((m) => console.log('  ' + m));
    console.log(`failed requests (${failedReqs.length}):`);
    failedReqs.forEach((m) => console.log('  ' + m));
    const errs = consoleMsgs.filter((m) => m.startsWith('error')).length + pageErrors.length;
    const adminOk = configFetched && errs === 0 && tokenShown && !oauthShown;
    console.log(`ADMIN ${adminOk ? 'PASS' : 'FAIL'} (console errors + page errors = ${errs})`);
    if (!adminOk) failed = true;
    await browser.close();
  } catch (e) {
    console.error(e);
    failed = true;
  } finally {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F']);
    else server.kill();
  }
  process.exitCode = failed ? 1 : 0;
})();
