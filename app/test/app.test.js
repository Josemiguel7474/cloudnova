const { test } = require('node:test');
const assert = require('node:assert');
const { createApp } = require('../src/app');

function withServer(fn) {
  return new Promise((resolve, reject) => {
    const srv = createApp().listen(0, async () => {
      try { await fn(`http://127.0.0.1:${srv.address().port}`); resolve(); }
      catch (e) { reject(e); }
      finally { srv.close(); }
    });
  });
}

test('/health devolve 200 e status ok', () => withServer(async (base) => {
  const r = await fetch(`${base}/health`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual((await r.json()).status, 'ok');
}));

test('página inicial mostra botão de login', () => withServer(async (base) => {
  const html = await (await fetch(`${base}/`)).text();
  assert.match(html, /Iniciar sessão com Microsoft/);
}));

test('dashboard sem sessão redireciona para /login', () => withServer(async (base) => {
  const r = await fetch(`${base}/dashboard`, { redirect: 'manual' });
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.get('location'), '/login');
}));
