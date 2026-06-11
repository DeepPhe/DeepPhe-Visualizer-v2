// Quick test to simulate what the browser client does for the filters view
const BASE = 'http://localhost:3333/v1/deepphe-api';

async function test() {
  console.log('1. Fetching OpenAPI spec...');
  const t0 = Date.now();
  const specResp = await fetch('http://localhost:3333/openapi.json');
  const spec = await specResp.json();
  console.log('   OK in', Date.now() - t0, 'ms');

  console.log('2. Fetching OMOP classes...');
  const t1 = Date.now();
  const classResp = await fetch(BASE + '/omop/classes');
  const classes = await classResp.json();
  console.log('   OMOP classes:', classes, 'in', Date.now() - t1, 'ms');

  console.log('3. Fetching OMOP instances/patients for all classes...');
  const t2 = Date.now();
  const results = await Promise.allSettled(
    classes.map(async (cls) => {
      const r = await fetch(BASE + '/omop/instances/patients?attribute=' + cls);
      const data = await r.json();
      return { cls, rows: Array.isArray(data) ? data.length : 0, bytes: JSON.stringify(data).length };
    })
  );
  console.log('   Done in', Date.now() - t2, 'ms');
  results.forEach(r => {
    if (r.status === 'fulfilled') console.log('   ', r.value.cls, ':', r.value.rows, 'rows,', r.value.bytes, 'bytes');
    else console.log('    FAILED:', r.reason?.message);
  });

  console.log('4. Fetching Attribute classes...');
  const t3 = Date.now();
  const attrResp = await fetch(BASE + '/deepphe/attributes/classes');
  const attrClasses = await attrResp.json();
  console.log('   Attribute classes: count =', attrClasses.length, 'in', Date.now() - t3, 'ms');

  console.log('5. Fetching ALL Attribute instances/patients...');
  const t4 = Date.now();
  const attrResults = await Promise.allSettled(
    attrClasses.map(async (cls) => {
      const r = await fetch(BASE + '/deepphe/attributes/instances/patients?groupname=' + encodeURIComponent(cls));
      const data = await r.json();
      return { cls, rows: Array.isArray(data) ? data.length : 0, bytes: JSON.stringify(data).length };
    })
  );
  console.log('   Done in', Date.now() - t4, 'ms');
  attrResults.forEach(r => {
    if (r.status === 'fulfilled') console.log('   ', r.value.cls, ':', r.value.rows, 'rows,', r.value.bytes, 'bytes');
    else console.log('    FAILED:', r.reason?.message);
  });

  console.log('\nTotal time:', Date.now() - t0, 'ms');
}

test().catch(e => console.error('ERROR:', e.message));

