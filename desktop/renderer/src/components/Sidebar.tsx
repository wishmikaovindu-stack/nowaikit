import React from 'react';
import type { Page, ThemeMode, ThemeAccent } from '../App.js';
import { useTheme } from '../App.js';

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  instanceName?: string;
  instanceCount: number;
  serverOnline: boolean;
}

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '▣' },
  { id: 'chat',      label: 'AI Chat',   icon: '◈' },
  { id: 'tools',     label: 'Tools',     icon: '◧' },
  { id: 'instances', label: 'Instances', icon: '⬡' },
  { id: 'logs',      label: 'Audit Log', icon: '≡' },
  { id: 'settings',  label: 'Settings',  icon: '⚙' },
];

const ACCENTS: { id: ThemeAccent; color: string }[] = [
  { id: 'blue',    color: '#4f8ef7' },
  { id: 'violet',  color: '#7c5cbf' },
  { id: 'sky',     color: '#38bdf8' },
  { id: 'emerald', color: '#22c55e' },
  { id: 'rose',    color: '#ef4444' },
];

// Inline SVG logo icon — circuit/node motif matching the brand
function LogoIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="50%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#logoGrad)" />
      {/* Stylised "N" + circuit nodes */}
      <path d="M9 23V9l7 10V9" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23" cy="12" r="2.5" fill="#fff" opacity="0.9" />
      <circle cx="23" cy="20" r="2.5" fill="#fff" opacity="0.9" />
      <line x1="23" y1="14.5" x2="23" y2="17.5" stroke="#fff" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

export default function Sidebar({ currentPage, onNavigate, instanceName, instanceCount, serverOnline }: Props): React.ReactElement {
  const { mode, accent, setMode, setAccent } = useTheme();

  return (
    <aside style={{
      width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Drag region / macOS traffic-light spacer */}
      <div style={{ height: 38, flexShrink: 0, WebkitAppRegion: 'drag' } as React.CSSProperties} />
      {/* Brand */}
      <div style={{ padding: '4px 18px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <LogoIcon size={30} />
          <span style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '-0.3px' }}>
            <span style={{ color: 'var(--text)' }}>Now</span>
            <span style={{
              background: 'linear-gradient(90deg, #38bdf8 0%, #818cf8 60%, #a78bfa 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 800,
            }}>AI</span>
            <span style={{ color: 'var(--text)' }}>Kit</span>
          </span>
        </div>
        <div style={{ fontSize: '0.73rem', color: 'var(--dim)', paddingLeft: 40 }}>
          {instanceName ? instanceName : 'No instance'}
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
        {NAV.map(item => {
          const active = currentPage === item.id;
          return (
            <button key={item.id} onClick={() => onNavigate(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '9px 12px', borderRadius: 7, marginBottom: 2,
              background: active ? 'var(--accent-bg)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--text2)',
              border: 'none', fontSize: '0.875rem', cursor: 'pointer',
              textAlign: 'left', fontWeight: active ? 600 : 400,
              transition: 'all .15s',
            }}>
              <span style={{ fontSize: '0.88rem', opacity: .8, width: 18, textAlign: 'center' }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'chat' && (
                <span style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', opacity: 0.8 }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Status */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: serverOnline ? 'var(--green)' : 'var(--dim)', flexShrink: 0 }} />
        <span style={{ color: serverOnline ? 'var(--green)' : 'var(--dim)' }}>
          {serverOnline ? 'Server online' : 'Server offline'}
        </span>
        <span style={{ color: 'var(--dim)', marginLeft: 'auto' }}>{instanceCount > 0 ? `${instanceCount} inst.` : 'no inst.'}</span>
      </div>

      {/* Theme controls */}
      <div style={{ padding: '12px 14px 14px' }}>
        {/* Dark / Light toggle */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {(['dark', 'light'] as ThemeMode[]).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: '5px 0', borderRadius: 6, fontSize: '0.75rem',
              background: mode === m ? 'var(--surface3)' : 'transparent',
              color: mode === m ? 'var(--text)' : 'var(--dim)',
              border: `1px solid ${mode === m ? 'var(--border2)' : 'transparent'}`,
              transition: 'all .15s',
            }}>
              {m === 'dark' ? '🌙 Dark' : '☀ Light'}
            </button>
          ))}
        </div>
        {/* Accent dots */}
        <div style={{ display: 'flex', gap: 7, justifyContent: 'center' }}>
          {ACCENTS.map(a => (
            <button key={a.id} onClick={() => setAccent(a.id)} title={a.id} style={{
              width: 18, height: 18, borderRadius: '50%', background: a.color, border: 'none',
              outline: accent === a.id ? `2px solid ${a.color}` : '2px solid transparent',
              outlineOffset: 2, transition: 'outline .15s', cursor: 'pointer',
            }} />
          ))}
        </div>
      </div>
    </aside>
  );
}
