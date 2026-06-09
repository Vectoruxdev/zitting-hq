/* Plaid Link bootstrap (window-global, matches the vendored screen pattern).
   Exposes window.ZHQ_PLAID.{connect, sync} for the screens to call. Uses the
   Plaid Link CDN script so we don't need a React dependency. */

function loadPlaidScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('no window'));
    if (window.Plaid) return resolve();
    const sc = document.createElement('script');
    sc.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    sc.async = true;
    sc.onload = () => resolve();
    sc.onerror = () => reject(new Error('Failed to load Plaid'));
    document.head.appendChild(sc);
  });
}

async function connect(onDone) {
  const API = window.ZHQ_API || {};
  if (!API.createPlaidLinkToken) return;
  let token;
  try {
    const res = await API.createPlaidLinkToken();
    if (res && res.ok === false) {
      alert('Plaid couldn’t start: ' + (res.error || 'unknown error'));
      return;
    }
    token = res && res.token;
  } catch (e) {
    alert('Could not reach the server. ' + (e && e.message ? e.message : ''));
    return;
  }
  if (!token) return;
  try {
    await loadPlaidScript();
  } catch {
    alert('Could not load Plaid. Check your connection and try again.');
    return;
  }
  const handler = window.Plaid.create({
    token,
    onSuccess: async (publicToken) => {
      try {
        await API.exchangePlaidPublicToken(publicToken);
      } finally {
        window.ZHQ_REFRESH && window.ZHQ_REFRESH();
        if (onDone) onDone();
      }
    },
    onExit: () => {},
  });
  handler.open();
}

async function sync(onDone) {
  const API = window.ZHQ_API || {};
  if (!API.syncPlaid) return;
  let res;
  try {
    res = await API.syncPlaid();
  } catch (e) {
    alert('Sync failed. ' + (e && e.message ? e.message : ''));
    return;
  }
  window.ZHQ_REFRESH && window.ZHQ_REFRESH();
  if (onDone) onDone(res);
  return res;
}

if (typeof window !== 'undefined') {
  window.ZHQ_PLAID = { connect, sync };
}
