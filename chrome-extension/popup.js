const DEFAULT_SERVER = 'https://sdp.jasem.dev';
const $ = (id) => document.getElementById(id);

function check() {
  const status = $('status');
  status.className = ''; status.textContent = 'Connecting…';
  chrome.runtime.sendMessage({ type: 'api', path: '/api/known-count' }, (r) => {
    if (r && r.ok) { status.className = 'ok'; status.textContent = `You know ${r.data.known.toLocaleString()} words`; }
    else if (r && r.signedOut) {
      status.className = 'bad'; status.textContent = 'Not signed in · ';
      const link = Object.assign(document.createElement('a'), { href: '#', textContent: 'Sign in' });
      link.onclick = (e) => { e.preventDefault(); chrome.runtime.sendMessage({ type: 'site' }); window.close(); };
      status.append(link);
    } else { status.className = 'bad'; status.textContent = (r && r.error) || "Can't reach the server"; }
  });
}

chrome.storage.sync.get({ server: DEFAULT_SERVER, enabled: true, showScore: true }, ({ server, enabled, showScore }) => {
  $('server').value = server;
  $('enabled').checked = enabled;
  $('showScore').checked = showScore;
  check();
});

$('server').addEventListener('change', () => {
  const server = $('server').value.trim().replace(/\/+$/, '') || DEFAULT_SERVER;
  $('server').value = server;
  chrome.storage.sync.set({ server }, check);
});

$('enabled').addEventListener('change', () => chrome.storage.sync.set({ enabled: $('enabled').checked }));
$('showScore').addEventListener('change', () => chrome.storage.sync.set({ showScore: $('showScore').checked }));

$('rescan').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.sendMessage(tab.id, { type: 'rescan' }, () => void chrome.runtime.lastError);
  window.close();
});
