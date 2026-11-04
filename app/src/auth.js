// Autenticação com Microsoft Entra ID (OAuth 2.0 / OpenID Connect, Authorization Code Flow)
const msal = require('@azure/msal-node');

let client = null;

function getClient() {
  if (client) return client;
  const { ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET } = process.env;
  if (!ENTRA_TENANT_ID || !ENTRA_CLIENT_ID || !ENTRA_CLIENT_SECRET) {
    throw new Error('Variáveis ENTRA_TENANT_ID / ENTRA_CLIENT_ID / ENTRA_CLIENT_SECRET em falta');
  }
  client = new msal.ConfidentialClientApplication({
    auth: {
      clientId: ENTRA_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${ENTRA_TENANT_ID}`,
      clientSecret: ENTRA_CLIENT_SECRET,
    },
  });
  return client;
}

const SCOPES = ['openid', 'profile', 'email', 'User.Read'];
const redirectUri = () => process.env.REDIRECT_URI || 'http://localhost:8080/auth/callback';

function register(app) {
  app.get('/login', async (req, res, next) => {
    try {
      const url = await getClient().getAuthCodeUrl({ scopes: SCOPES, redirectUri: redirectUri() });
      res.redirect(url);
    } catch (err) { next(err); }
  });

  app.get('/auth/callback', async (req, res, next) => {
    try {
      const result = await getClient().acquireTokenByCode({
        code: req.query.code,
        scopes: SCOPES,
        redirectUri: redirectUri(),
      });
      req.session.user = {
        name: result.account.name,
        username: result.account.username,
        tenantId: result.account.tenantId,
        oid: result.idTokenClaims.oid,
      };
      res.redirect('/');
    } catch (err) { next(err); }
  });

  app.get('/logout', (req, res) => {
    req.session.destroy(() => {
      const tenant = process.env.ENTRA_TENANT_ID || 'common';
      res.redirect(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/logout`);
    });
  });
}

function requireLogin(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect('/login');
}

module.exports = { register, requireLogin };
