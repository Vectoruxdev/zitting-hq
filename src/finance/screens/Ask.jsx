import React from 'react';
/* Ask AI — the money coach chat. Backed by the askAi server action (Claude
   with a live household snapshot). Conversation lives in client state only —
   nothing is stored. */
function ZHQAsk() {
  const { Card, Icon, Button, AreaChart } = window.ZittingHQDesignSystem_c9e528;
  const D = window.ZHQ_DATA;
  const API = window.ZHQ_API || {};
  const [msgs, setMsgs] = React.useState((D.ask && D.ask.messages) || []);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const scroller = React.useRef(null);

  React.useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy]);

  async function send(text) {
    if (!text.trim() || busy) return;
    const history = [...msgs, { role: 'user', text: text.trim() }];
    setMsgs(history);
    setDraft('');
    if (!API.askAi) {
      setMsgs((m) => [...m, { role: 'ai', text: "The AI money coach isn't connected yet." }]);
      return;
    }
    setBusy(true);
    try {
      // Server expects user/assistant roles; the UI stores 'ai'.
      const res = await API.askAi(history.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.text })));
      setMsgs((m) => [...m, { role: 'ai', text: res && res.ok ? res.text : (res && res.error) || 'Something went wrong — try again.' }]);
    } catch {
      setMsgs((m) => [...m, { role: 'ai', text: 'Something went wrong — try again.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)' }}>
      <div style={{ textAlign: 'center', padding: '6px 0 22px' }}>
        <span style={{ width: 46, height: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, background: 'var(--accent-soft)', color: 'var(--accent)', marginBottom: 12 }}><Icon name="sparkles" size={24} /></span>
        <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Ask your money anything</h2>
        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 6 }}>Your private family coach. It reads your real accounts, budgets, bills, and goals.</p>
      </div>

      <div ref={scroller} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 2px' }}>
        {msgs.map((m, i) => m.role === 'user' ? (
          <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '78%', background: 'var(--surface-raised)', border: '1px solid var(--border-hairline)', padding: '11px 15px', borderRadius: '16px 16px 4px 16px', fontSize: 14, color: 'var(--text-primary)' }}>{m.text}</div>
        ) : (
          <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '88%', display: 'flex', gap: 11 }}>
            <span style={{ width: 30, height: 30, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon name="sparkles" size={16} /></span>
            <div>
              <div style={{ background: 'var(--surface-card)', padding: '12px 15px', borderRadius: '4px 16px 16px 16px', fontSize: 14, color: 'var(--paper-200)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{m.text}</div>
              {m.chart === 'dining' ? (
                <Card padding={16} style={{ marginTop: 10 }}>
                  <div className="zt-eyebrow" style={{ marginBottom: 8 }}>Dining · last 6 months</div>
                  <AreaChart data={[380, 410, 360, 520, 480, 680]} labels={D.trend.labels} height={120} color="var(--amber-500)" />
                </Card>
              ) : null}
            </div>
          </div>
        ))}
        {busy ? (
          <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 11, alignItems: 'center' }}>
            <span style={{ width: 30, height: 30, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon name="sparkles" size={16} /></span>
            <span className="zhq-ask-thinking" style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Looking at your numbers…</span>
          </div>
        ) : null}
      </div>

      <div style={{ paddingTop: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {D.ask.prompts.map((p) => (
            <button key={p} onClick={() => send(p)} disabled={busy} style={{ fontSize: 12.5, color: 'var(--text-secondary)', background: 'var(--surface-raised)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-pill)', padding: '7px 13px', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>{p}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 18px', background: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-pill)' }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(draft); }} disabled={busy} placeholder="Ask about spending, budgets, tithing…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 14 }} />
          <Button variant="accent" size="sm" onClick={() => send(draft)} disabled={busy} iconRight={<Icon name="arrowRight" size={15} />}>{busy ? 'Thinking…' : 'Ask'}</Button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ZHQAsk });
