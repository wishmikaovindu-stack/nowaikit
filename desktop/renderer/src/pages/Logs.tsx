import React, { useEffect, useState, useCallback } from 'react';

interface LogEntry {
  ts?: string;
  event?: string;
  tool?: string;
  resource?: string;
  prompt?: string;
  instance?: string;
  authMode?: string;
  user?: string;
  provider?: string;
  model?: string;
  toolCount?: number;
  success?: boolean;
  durationMs?: number;
  error?: string;
  [key: string]: unknown;
}

interface LogResponse {
  ok: boolean;
  entries: LogEntry[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

const PAGE_SIZE = 15;

export default function Logs(): React.ReactElement {
  const [entries,    setEntries]    = useState<LogEntry[]>([]);
  const [total,      setTotal]      = useState(0);
  const [hasMore,    setHasMore]    = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter,     setFilter]     = useState('');
  const [selected,   setSelected]   = useState<LogEntry | null>(null);

  const bridge = useCallback(() =>
    (window as unknown as { nowaikit?: { readLogs: (opts?: { offset?: number; limit?: number }) => Promise<LogResponse> } }).nowaikit,
  []);

  // Load initial page (newest 15)
  function loadFresh() {
    setLoading(true);
    setSelected(null);
    const nw = bridge();
    if (!nw) { setLoading(false); return; }
    nw.readLogs({ offset: 0, limit: PAGE_SIZE })
      .then(r => {
        setEntries(r.entries ?? []);
        setTotal(r.total ?? 0);
        setHasMore(r.hasMore ?? false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  // Load next page (append)
  function loadMore() {
    const nw = bridge();
    if (!nw || loadingMore) return;
    setLoadingMore(true);
    nw.readLogs({ offset: entries.length, limit: PAGE_SIZE })
      .then(r => {
        setEntries(prev => [...prev, ...(r.entries ?? [])]);
        setTotal(r.total ?? total);
        setHasMore(r.hasMore ?? false);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }

  useEffect(() => { loadFresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = entries.filter(e => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (e.tool ?? '').toLowerCase().includes(q)
      || (e.instance ?? '').toLowerCase().includes(q)
      || (e.provider ?? '').toLowerCase().includes(q)
      || (e.model ?? '').toLowerCase().includes(q)
      || (e.error ?? '').toLowerCase().includes(q)
      || (e.event ?? '').toLowerCase().includes(q);
  });

  function fmtTime(ts?: string) {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit', second:'2-digit' }) + ' ' + d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
    } catch { return ts; }
  }

  function statusBadge(e: LogEntry) {
    if (e.success === true) return <span className="badge-green">ok</span>;
    if (e.success === false) return <span className="badge-red">error</span>;
    return <span className="badge-dim">—</span>;
  }

  const th: React.CSSProperties = { padding:'8px 12px', fontSize:'0.72rem', color:'var(--dim)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left', borderBottom:'1px solid var(--border)', fontWeight:600 };
  const td: React.CSSProperties = { padding:'10px 12px', fontSize:'0.82rem', borderBottom:'1px solid var(--border)', verticalAlign:'middle' };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Audit Log</h2>
        <div style={{ display:'flex', gap:8 }}>
          <input className="input" placeholder="Filter by tool, instance, provider, model…" value={filter} onChange={e => setFilter(e.target.value)} style={{ width:280 }} />
          <button className="btn-ghost" onClick={loadFresh} style={{ padding:'6px 14px', fontSize:'0.8rem' }}>↻</button>
        </div>
      </div>

      <div style={{ fontSize:'0.78rem', color:'var(--dim)', marginBottom:14 }}>
        Log: <code style={{ color:'var(--text2)' }}>~/.config/nowaikit/audit.jsonl</code>
        {!loading && (
          <span style={{ marginLeft:12 }}>
            Showing {filtered.length} of {total} entries
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, color:'var(--dim)', gap:10 }}>
          <span className="spinner" /> Loading logs…
        </div>
      ) : entries.length === 0 ? (
        <div className="card" style={{ padding:32, textAlign:'center', color:'var(--dim)' }}>
          <div style={{ marginBottom:8 }}>No audit log entries found.</div>
          <div style={{ fontSize:'0.8rem' }}>Logs appear after tools are called or chat messages are sent. Set <code>AUDIT_ENABLED=true</code> in your server config.</div>
        </div>
      ) : (
        <div className="card" style={{ overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
            <thead>
              <tr>
                <th style={th}>Time</th>
                <th style={th}>Event</th>
                <th style={th}>Tool</th>
                <th style={th}>Instance</th>
                <th style={th}>Provider</th>
                <th style={th}>Model</th>
                <th style={th}>Status</th>
                <th style={th}>Duration</th>
                <th style={th}>Error</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={i} onClick={() => setSelected(selected === e ? null : e)} style={{ cursor:'pointer', background: selected === e ? 'var(--surface2)' : 'transparent', transition:'background .1s' }}>
                  <td style={{ ...td, color:'var(--text2)', fontFamily:'monospace', fontSize:'0.78rem', whiteSpace:'nowrap' }}>{fmtTime(e.ts)}</td>
                  <td style={{ ...td, fontSize:'0.75rem', color:'var(--dim)' }}>{e.event ?? '—'}</td>
                  <td style={{ ...td, fontFamily:'monospace', color:'var(--accent)', fontWeight:500 }}>{e.tool || e.resource || e.prompt || '—'}</td>
                  <td style={{ ...td, fontSize:'0.8rem', color:'var(--text2)' }}>{e.instance ?? '—'}</td>
                  <td style={{ ...td, fontSize:'0.8rem', color:'var(--text2)' }}>{e.provider ?? '—'}</td>
                  <td style={{ ...td, fontFamily:'monospace', fontSize:'0.75rem', color:'var(--text2)', maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.model ?? '—'}</td>
                  <td style={td}>{statusBadge(e)}</td>
                  <td style={{ ...td, color:'var(--text2)' }}>{e.durationMs != null ? `${e.durationMs}ms` : '—'}</td>
                  <td style={{ ...td, color:'var(--red)', fontSize:'0.75rem', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.error ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Load More button */}
          {hasMore && (
            <div style={{ padding:'14px 16px', textAlign:'center', borderTop:'1px solid var(--border)' }}>
              <button
                className="btn-ghost"
                onClick={loadMore}
                disabled={loadingMore}
                style={{ padding:'8px 24px', fontSize:'0.82rem' }}
              >
                {loadingMore ? 'Loading…' : `Load More (${entries.length} of ${total})`}
              </button>
            </div>
          )}

          {selected && (
            <div style={{ padding:'14px 16px', borderTop:'2px solid var(--border2)', background:'var(--surface2)' }}>
              <div style={{ fontSize:'0.72rem', color:'var(--dim)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>Entry Detail</div>
              <pre style={{ fontSize:'0.78rem', overflowX:'auto', color:'var(--text)', lineHeight:1.5 }}>{JSON.stringify(selected, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
