const { chromium } = require('playwright');

(async () => {
  const execPath = '/Users/johnlevander/Library/Caches/ms-playwright/chromium-1217/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
  const browser = await chromium.launch({ headless: true, executablePath: execPath });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (/\[(FiltersView|useBatchDataLoader|perf:)/.test(text)) {
      const ts = Date.now();
      logs.push({ ts, text });
    }
  });

  // Navigate and take rapid screenshots
  console.log('Loading /filters ...');
  const startTs = Date.now();

  // Start navigation (don't await yet - capture loading states)
  page.goto('http://localhost:3000/filters');

  const shots = [];
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(50);
    const elapsed = Date.now() - startTs;
    const p = `/tmp/flash-${String(i).padStart(2,'0')}-${elapsed}ms.png`;
    try {
      await page.screenshot({ path: p });
      shots.push({ i, elapsed, path: p });
    } catch(e) {}
  }

  // Wait for final state
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/flash-final.png' });

  console.log('\n=== Console logs ===');
  logs.forEach(l => console.log(`  +${l.ts - startTs}ms: ${l.text}`));

  console.log('\n=== Screenshots ===');
  shots.forEach(s => console.log(`  ${s.elapsed}ms -> ${s.path}`));

  await browser.close();
})();
