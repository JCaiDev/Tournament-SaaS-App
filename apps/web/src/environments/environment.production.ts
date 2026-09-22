export const environment = {
  production: true,
  // Same-origin path; Netlify proxies /api/* to the Render API (see netlify.toml).
  apiBaseUrl: '/api',
  mockApi: false,
  // Add the Netlify domain as an "Authorized JavaScript origin" for this client.
  googleClientId:
    '632039701652-478v5m9fu3l48eq4gvs3n0n64j2is7e3.apps.googleusercontent.com',
};
