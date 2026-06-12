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
        const res = await API.exchangePlaidPublicToken(publicToken);
        // The action returns { ok:false, error } instead of throwing — surface
        // it, or a failed link looks like it silently worked.
        if (res && res.ok === false) alert('Couldn’t link the bank: ' + (res.error || 'unknown error'));
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
    // A thrown action call usually means deployment skew (this tab predates the
    // current deploy) or a killed/timed-out function — refreshing fixes the former.
    alert('Sync failed. ' + (e && e.message ? e.message : '') + '\nTry refreshing the page and syncing again.');
    return;
  }
  // Refresh first so statuses/timestamps reflect reality even on failure.
  window.ZHQ_REFRESH && window.ZHQ_REFRESH();
  // The action reports failures in-band ({ ok:false }, per-bank in `failed`) —
  // surface them; silently ignoring them is how a broken sync kept looking "Active".
  if (res && res.ok === false) {
    const perBank = (res.failed || [])
      .map((f) => (f.institutionName || 'Bank') + ': ' + f.error)
      .join('\n');
    alert('Sync failed.\n' + (perBank || res.error || 'Unknown error'));
  }
  if (onDone) onDone(res);
  return res;
}

if (typeof window !== 'undefined') {
  window.ZHQ_PLAID = { connect, sync };
}
