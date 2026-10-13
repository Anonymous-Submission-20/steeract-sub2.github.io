const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('reported task means and video scores agree with the active V5 main table', () => {
  const context = vm.createContext({});
  vm.runInContext(html.match(/<script id="results-model">([\s\S]*?)<\/script>/)[1], context);
  const results = context.SteerResults;
  assert.deepEqual(JSON.parse(JSON.stringify(results.summaries().map(s => [s.tasks,s.base,s.ours,s.gain]))), [
    [9,'69.0','77.7','8.7'], [9,'69.3','78.6','9.2'],
    [9,'62.3','71.9','9.6'], [9,'23.3','26.8','3.4']
  ]);
  for (const setting of results.settings) {
    for (const values of Object.values(setting.methods)) if (values) assert.equal(values.length,9);
  }
  const scores = results.videosFor('robotwin').map(video => {
    const setting = results.settings.find(s => s.id === video.setting);
    return [video.title,setting.methods.Base[video.taskIndex],setting.methods['SteerAct (Enc)'][video.taskIndex]];
  });
  assert.deepEqual(JSON.parse(JSON.stringify(scores)), [
    ['Put Bottles in Dustbin',74,88],['Rank Blocks by Size',43,58],
    ['Turn Switch',53,73],['Place Mouse Pad',87,95]
  ]);
});

test('public copy uses the V5 title and distinguishes temporal references from illustrative curves', async () => {
  const {chromium} = require('playwright');
  const browser = await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || undefined});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    await page.route('https://steeract.github.io/**', route =>
      new URL(route.request().url()).pathname === '/'
        ? route.fulfill({contentType:'text/html',body:html}) : route.abort());
    await page.goto('https://steeract.github.io/');
    const title = 'SteerAct: Unlocking Action Models through Few-Shot Temporal Steering';
    assert.equal(await page.title(),title);
    assert.equal((await page.locator('h1').innerText()).replace(/\s+/g,' ').trim(),title);
    const abstract = await page.locator('#abstract .paper-copy').innerText();
    assert.ok(abstract.includes('shared temporal descriptor'));
    assert.ok(abstract.includes('without requiring timestep alignment'));
    assert.ok(abstract.includes('Offline, we select a single feature per task'));
    const gateLabels = await page.locator('#mechanism .row-label').allTextContents();
    assert.ok(gateLabels.includes('Support gate'));
    assert.ok(gateLabels.includes('Failure gate'));
    assert.ok(gateLabels.includes('Steering coefficient'));
    assert.ok((await page.locator('#mechanism').innerText()).includes('illustrative, not measured'));
    assert.ok(!(await page.locator('.hero').innerText()).includes('No fine-tuning'));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  } finally {await browser.close();}
});
