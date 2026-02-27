import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AppInstance, Page } from '../App.js';

const PACKAGE_COUNTS: Record<string, string> = {
  full: '284+', service_desk: '47', change_coordinator: '32',
  platform_developer: '51', system_administrator: '38', itom_engineer: '29',
};

type Bridge = {
  restartServer?: () => Promise<{ ok: boolean; port?: number }>;
  configureServer?: (o: { port: number }) => Promise<{ ok: boolean; port?: number; message?: string }>;
  getServerLogs?: () => Promise<{ lines: string[] }>;
  getServerPort?: () => Promise<number>;
};
function bridge(): Bridge {
  return (window as unknown as { nowaikit?: Bridge }).nowaikit ?? {};
}

interface Props {
  instances: AppInstance[];
  serverOnline: boolean;
  appVersion: string;
  serverUrl: string;
  onRefresh: () => void;
  onNavigate: (p: Page) => void;
}

function StatCard({ label, value, sub, subTitle, accent, valueColor }: {
  label: string; value: string | number; sub?: string; subTitle?: string;
  accent?: boolean; valueColor?: string;
}) {
  return (
    <div className="card" style={{ padding:'20px 22px', flex:1, minWidth:0, overflow:'hidden' }}>
      <div style={{ fontSize:'0.68rem', color:'var(--dim)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8, whiteSpace:'nowrap' }}>{label}</div>
      <div style={{ fontSize:'1.75rem', fontWeight:700, color: valueColor ?? (accent ? 'var(--accent)' : 'var(--text)'), lineHeight:1, marginBottom: sub ? 6 : 0 }}>
        {value}
      </div>
      {sub && (
        <div
          title={subTitle ?? sub}
          style={{
            fontSize:'0.78rem', color:'var(--text2)',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
            cursor: subTitle ? 'help' : 'default',
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function ServerPanel({ serverOnline, serverUrl, onRefresh }: { serverOnline: boolean; serverUrl: string; onRefresh: () => void }) {
  const b = bridge();

  // Parse port from current serverUrl
  const urlPort = (() => { try { return parseInt(new URL(serverUrl).port || '3100', 10); } catch { return 3100; } })();

  const [port,       setPort]       = useState<number>(urlPort);
  const [portInput,  setPortInput]  = useState<string>(String(urlPort));
  const [busy,       setBusy]       = useState(false);
  const [logs,       setLogs]       = useState<string[]>([]);
  const [logOpen,    setLogOpen]    = useState(false);
  const [statusMsg,  setStatusMsg]  = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  // Keep portInput in sync when serverUrl changes externally
  useEffect(() => { setPort(urlPort); setPortInput(String(urlPort)); }, [urlPort]);

  const fetchLogs = useCallback(async () => {
    if (!b.getServerLogs) return;
    const r = await b.getServerLogs();
    setLogs(r.lines ?? []);
    // Auto-scroll to bottom
    requestAnimationFrame(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    });
  }, []);

  // Refresh logs when panel is open
  useEffect(() => {
    if (!logOpen) return;
    fetchLogs();
    const id = setInterval(fetchLogs, 3000);
    return () => clearInterval(id);
  }, [logOpen, fetchLogs]);

  async function handleRestart() {
    if (!b.restartServer) { setStatusMsg('Bridge unavailable — start the server from a terminal: nowaikit server'); return; }
    setBusy(true); setStatusMsg('Starting…');
    try {
      const r = await b.restartServer();
      if (r.ok) {
        setStatusMsg(`Server started on port ${r.port ?? port}`);
        if (r.port) { setPort(r.port); setPortInput(String(r.port)); }
        setTimeout(onRefresh, 1500);
      } else {
        setStatusMsg('Start failed — see logs below');
        setLogOpen(true);
      }
    } catch (e) {
      setStatusMsg(`Error: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleApplyPort() {
    const p = parseInt(portInput, 10);
    if (!p || p < 1024 || p > 65535) { setStatusMsg('Port must be between 1024 and 65535'); return; }
    if (!b.configureServer) { setStatusMsg('Bridge unavailable'); return; }
    setBusy(true); setStatusMsg(`Restarting on port ${p}…`);
    try {
      const r = await b.configureServer({ port: p });
      if (r.ok) {
        const actual = r.port ?? p;
        setPort(actual); setPortInput(String(actual));
        setStatusMsg(actual !== p ? `Port ${p} was busy — using ${actual}` : `Running on port ${actual}`);
        setTimeout(onRefresh, 1500);
      } else {
        setStatusMsg(r.message ?? 'Failed');
      }
    } catch (e) {
      setStatusMsg(`Error: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setBusy(false);
    }
  }

  const dot = (color: string) => (
    <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:`var(--${color})`, marginRight:6, flexShrink:0,
      boxShadow: color === 'green' ? '0 0 6px var(--green)' : 'none' }} />
  );

  return (
    <div className="card" style={{ marginBottom:28, overflow:'hidden' }}>
      {/* Header row */}
      <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', flex:1, minWidth:200 }}>
          {serverOnline ? dot('green') : dot('dim')}
          <span style={{ fontWeight:600, fontSize:'0.88rem' }}>HTTP Server</span>
          <span style={{ marginLeft:8, fontSize:'0.78rem', color: serverOnline ? 'var(--green)' : 'var(--dim)' }}>
            {serverOnline ? `Online · localhost:${port}` : 'Offline'}
          </span>
        </div>

        {/* Port config */}
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          <span style={{ fontSize:'0.78rem', color:'var(--dim)' }}>Port</span>
          <input
            type="number"
            value={portInput}
            onChange={e => setPortInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleApplyPort(); }}
            min={1024} max={65535}
            style={{
              width:70, background:'var(--surface2)', border:'1px solid var(--border2)',
              borderRadius:5, color:'var(--text)', padding:'5px 8px', fontSize:'0.82rem',
              textAlign:'center',
            }}
            disabled={busy}
          />
          {portInput !== String(port) && (
            <button
              onClick={handleApplyPort}
              disabled={busy}
              style={{ background:'var(--accent)', color:'#fff', border:'none', borderRadius:5, padding:'5px 10px', fontSize:'0.78rem', fontWeight:600, cursor:'pointer', opacity: busy ? 0.6 : 1 }}
            >
              Apply
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
          <button
            onClick={handleRestart}
            disabled={busy}
            style={{
              background: serverOnline ? 'rgba(34,197,94,0.12)' : 'var(--accent)',
              border: serverOnline ? '1px solid rgba(34,197,94,0.3)' : 'none',
              color: serverOnline ? 'var(--green)' : '#fff',
              borderRadius:6, padding:'6px 14px', fontSize:'0.82rem', fontWeight:600,
              cursor:'pointer', opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? '…' : serverOnline ? '↻ Restart' : '▶ Start'}
          </button>
          <button
            onClick={() => { setLogOpen(o => !o); if (!logOpen) fetchLogs(); }}
            style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text2)', borderRadius:6, padding:'6px 12px', fontSize:'0.78rem', cursor:'pointer' }}
          >
            {logOpen ? '▲ Logs' : '▼ Logs'}
          </button>
        </div>
      </div>

      {/* Status message */}
      {statusMsg && (
        <div style={{ padding:'8px 16px', fontSize:'0.78rem', color:'var(--text2)', background:'var(--surface2)', borderBottom:'1px solid var(--border)' }}>
          {statusMsg}
        </div>
      )}

      {/* Offline guidance */}
      {!serverOnline && !busy && !statusMsg && (
        <div style={{ padding:'12px 16px', fontSize:'0.82rem', color:'var(--text2)' }}>
          <strong style={{ color:'var(--yellow)' }}>Server is offline.</strong>{' '}
          Click <strong>▶ Start</strong> above, or run <code style={{ background:'var(--surface2)', padding:'1px 6px', borderRadius:4 }}>nowaikit server</code> in a terminal.
          The server listens on <code style={{ background:'var(--surface2)', padding:'1px 6px', borderRadius:4 }}>localhost:{port}</code> by default.
          Change the port above and click Apply if that port is in use.
        </div>
      )}

      {/* Log viewer */}
      {logOpen && (
        <div
          ref={logRef}
          style={{
            background:'#0a0c12', padding:'12px 16px', fontFamily:'monospace', fontSize:'0.73rem',
            lineHeight:1.7, maxHeight:240, overflowY:'auto', color:'#94a3b8', whiteSpace:'pre-wrap',
            wordBreak:'break-all',
          }}
        >
          {logs.length === 0
            ? <span style={{ color:'var(--dim)', fontStyle:'italic' }}>No log output yet. Start the server to see output here.</span>
            : logs.map((l, i) => {
                const color = l.includes(':err]') || l.includes('error') || l.includes('Error')
                  ? '#f87171'
                  : l.includes('listening') || l.includes('Online') || l.includes('started')
                  ? '#86efac'
                  : '#94a3b8';
                return <div key={i} style={{ color }}>{l}</div>;
              })
          }
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ instances, serverOnline, appVersion, serverUrl, onRefresh, onNavigate }: Props): React.ReactElement {
  const active = instances.find(i => i.active);

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        <button className="btn-ghost" onClick={onRefresh} style={{ padding:'6px 14px', fontSize:'0.8rem' }}>↻ Refresh</button>
      </div>

      {/* Stat cards */}
      <div style={{ display:'flex', gap:14, marginBottom:28, flexWrap:'wrap' }}>
        <StatCard
          label="Active Instance"
          value={active?.name ?? '—'}
          sub={active?.url}
          subTitle={active?.url}
          accent
        />
        <StatCard
          label="Tools"
          value={active ? (PACKAGE_COUNTS[active.toolPackage] ?? '—') : '—'}
          sub={active ? active.toolPackage.replace(/_/g,' ') + ' package' : 'no instance'}
        />
        <StatCard
          label="Instances"
          value={instances.length}
          sub="configured"
        />
        <StatCard
          label="Server"
          value={serverOnline ? 'Online' : 'Offline'}
          sub={appVersion ? `v${appVersion}` : undefined}
          valueColor={serverOnline ? 'var(--green)' : 'var(--dim)'}
        />
      </div>

      {/* Server management panel */}
      <ServerPanel serverOnline={serverOnline} serverUrl={serverUrl} onRefresh={onRefresh} />

      {/* Quick actions */}
      <div style={{ display:'flex', gap:12, marginBottom:28, flexWrap:'wrap' }}>
        <button className="btn-primary" onClick={() => onNavigate('chat')} style={{ display:'flex', alignItems:'center', gap:8 }}>
          ◈ Start Chat
        </button>
        <button className="btn-ghost" onClick={() => onNavigate('tools')} style={{ display:'flex', alignItems:'center', gap:8 }}>
          ◧ Browse Tools
        </button>
        <button className="btn-ghost" onClick={() => onNavigate('instances')} style={{ display:'flex', alignItems:'center', gap:8 }}>
          ⬡ Manage Instances
        </button>
      </div>

      {/* Instance list */}
      <div className="card" style={{ overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:'0.7rem', color:'var(--dim)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Configured Instances</span>
          <button onClick={() => onNavigate('instances')} style={{ background:'none', border:'none', color:'var(--accent)', fontSize:'0.78rem', cursor:'pointer' }}>
            Manage →
          </button>
        </div>
        {instances.length === 0 ? (
          <div style={{ padding:'32px 16px', textAlign:'center', color:'var(--dim)', fontSize:'0.875rem' }}>
            No instances configured.{' '}
            <button onClick={() => onNavigate('instances')} style={{ background:'none', border:'none', color:'var(--accent)', cursor:'pointer', fontSize:'0.875rem' }}>
              Add one →
            </button>
          </div>
        ) : instances.map((inst, i) => (
          <div key={inst.name} style={{
            display:'flex', alignItems:'center', padding:'13px 16px',
            borderBottom: i < instances.length - 1 ? '1px solid var(--border)' : 'none',
            gap:12, minWidth:0,
          }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, marginBottom:3, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inst.name}</span>
                {inst.active && <span className="badge-green" style={{ flexShrink:0 }}>active</span>}
              </div>
              <div title={inst.url} style={{ fontSize:'0.8rem', color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'help', maxWidth:'100%' }}>
                {inst.url}
              </div>
            </div>
            <div style={{ display:'flex', gap:6, alignItems:'center', fontSize:'0.75rem', color:'var(--dim)', flexShrink:0 }}>
              <span className="badge-dim">{inst.toolPackage.replace(/_/g,' ')}</span>
              <span>·</span>
              <span>{inst.authMethod}</span>
              <span>·</span>
              <span style={{ color: inst.writeEnabled ? 'var(--yellow)' : 'var(--dim)' }}>
                {inst.writeEnabled ? 'read/write' : 'read-only'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
