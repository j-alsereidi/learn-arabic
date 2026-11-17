// Talks to the Flashcard Studio server for the page script (content.js), so no page's own security rules get in
// the way, and opens the Atlas in a new tab. Requests carry the website's sign-in cookie: sign in on the website.
const DEFAULT_SERVER = 'https://sdp.jasem.dev';

async function server() {
  const { server } = await chrome.storage.sync.get('server');
  return (server || DEFAULT_SERVER).replace(/\/+$/, '');
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === 'api') {
    (async () => {
      try {
        const res = await fetch(await server() + msg.path, {
          method: msg.method || (msg.body ? 'POST' : 'GET'),
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: msg.body ? JSON.stringify(msg.body) : undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) reply({ ok: false, signedOut: true, error: 'Sign in to Flashcard Studio' });
        else reply(res.ok ? { ok: true, data } : { ok: false, error: data.details || data.error || `Server error ${res.status}` });
      } catch (err) {
        reply({ ok: false, error: `Can't reach the server (${err.message})` });
      }
    })();
    return true; // reply comes asynchronously
  }
  if (msg.type === 'atlas') {
    server().then((s) => chrome.tabs.create({ url: `${s}/?atlas=${msg.id}` }));
  }
  if (msg.type === 'site') {
    server().then((s) => chrome.tabs.create({ url: s }));
  }
});
