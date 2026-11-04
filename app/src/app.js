const express = require('express');
const session = require('express-session');
const multer = require('multer');
const crypto = require('crypto');
const auth = require('./auth');
const db = require('./db');
const storage = require('./storage');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page(title, body) {
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
 body{font-family:Segoe UI,Arial,sans-serif;margin:0;background:#f3f5f9;color:#1b1f24}
 header{background:#0b3d91;color:#fff;padding:16px 32px;display:flex;justify-content:space-between;align-items:center}
 header a{color:#fff} main{max-width:900px;margin:24px auto;padding:0 16px}
 .card{background:#fff;border-radius:8px;padding:20px 24px;margin-bottom:18px;box-shadow:0 1px 3px #0002}
 .ok{color:#107c10;font-weight:600}.err{color:#c50f1f;font-weight:600}
 table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}
 .btn{background:#0b3d91;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;border:0;cursor:pointer}
</style></head><body>
<header><strong>CloudNova · Portal Corporativo</strong><span>${title === 'Início' ? '' : ''}</span></header>
<main>${body}</main></body></html>`;
}

function createApp() {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

  app.use(session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax' },
  }));

  // Health check (usado pelo pipeline e para testes)
  app.get('/health', (req, res) => res.json({ status: 'ok', versao: process.env.APP_VERSION || 'dev' }));

  auth.register(app);

  app.get('/', (req, res) => {
    if (!req.session.user) {
      return res.send(page('Início', `<div class="card"><h2>Bem-vindo ao portal CloudNova</h2>
        <p>Inicie sessão com a sua conta empresarial Microsoft Entra ID.</p>
        <p><a class="btn" href="/login">Iniciar sessão com Microsoft</a></p></div>`));
    }
    res.redirect('/dashboard');
  });

  app.get('/dashboard', auth.requireLogin, async (req, res) => {
    const u = req.session.user;
    let dbHtml, stHtml;
    try {
      const r = await db.registarAcesso(u.username);
      dbHtml = `<p class="ok">✔ Ligação à Azure SQL (Private Endpoint) OK — ${r.total} acessos registados</p>
        <table><tr><th>Utilizador</th><th>Data/Hora (UTC)</th></tr>${r.ultimos.map((x) =>
          `<tr><td>${esc(x.Utilizador)}</td><td>${esc(new Date(x.DataHora).toISOString())}</td></tr>`).join('')}</table>`;
    } catch (e) { dbHtml = `<p class="err">✘ Erro na base de dados: ${esc(e.message)}</p>`; }
    try {
      const itens = await storage.listar();
      stHtml = `<p class="ok">✔ Ligação ao Blob Storage OK — ${itens.length} ficheiro(s)</p>
        <ul>${itens.map((i) => `<li>${esc(i.nome)} (${i.tamanho} bytes)</li>`).join('')}</ul>`;
    } catch (e) { stHtml = `<p class="err">✘ Erro no Storage: ${esc(e.message)}</p>`; }

    res.send(page('Dashboard', `
      <div class="card"><h2>Olá, ${esc(u.name)}</h2>
        <p>Sessão iniciada via <b>Microsoft Entra ID</b> como <code>${esc(u.username)}</code><br>
        Tenant: <code>${esc(u.tenantId)}</code> · Object ID: <code>${esc(u.oid)}</code></p>
        <p>Versão da aplicação: <code>${esc(process.env.APP_VERSION || 'dev')}</code> · <a href="/logout">Terminar sessão</a></p></div>
      <div class="card"><h3>Base de dados</h3>${dbHtml}</div>
      <div class="card"><h3>Ficheiros da empresa (Blob Storage)</h3>${stHtml}
        <form method="post" action="/upload" enctype="multipart/form-data">
          <input type="file" name="ficheiro" required> <button class="btn">Enviar</button></form></div>`));
  });

  app.post('/upload', auth.requireLogin, upload.single('ficheiro'), async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).send('Nenhum ficheiro');
      await storage.upload(req.file.originalname, req.file.buffer, req.file.mimetype);
      res.redirect('/dashboard');
    } catch (err) { next(err); }
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send(page('Erro', `<div class="card"><p class="err">Erro: ${esc(err.message)}</p><a href="/">Voltar</a></div>`));
  });

  return app;
}

module.exports = { createApp };
