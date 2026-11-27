// Mengirim konfigurasi publik Firebase dari Environment Variables Vercel ke browser.
// Nilai-nilai ini memang publik; keamanan dijaga oleh Security Rules.
export default function handler(req, res) {
  const e = process.env;
  const firebase = e.FIREBASE_API_KEY ? {
    apiKey: e.FIREBASE_API_KEY,
    authDomain: e.FIREBASE_AUTH_DOMAIN,
    projectId: e.FIREBASE_PROJECT_ID,
    databaseURL: e.FIREBASE_DATABASE_URL,
    appId: e.FIREBASE_APP_ID,
  } : null;
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ firebase, server: Boolean(e.FIREBASE_SERVICE_ACCOUNT) });
}
