/**
 * Root app — manages theme, settings, instance data, and page routing.
 * Theme (dark/light + accent) persists to localStorage and is applied
 * on the <html> element via data-theme / data-accent attributes.
 */
import React, { useEffect, useState, useCallback, createContext, useContext } from 'react';
import Setup     from './pages/Setup.js';
import Dashboard from './pages/Dashboard.js';
import Instances from './pages/Instances.js';
import Tools     from './pages/Tools.js';
import Logs      from './pages/Logs.js';
import Chat      from './pages/Chat.js';
import Settings  from './pages/Settings.js';
import Sidebar   from './components/Sidebar.js';

export type Page = 'dashboard' | 'chat' | 'tools' | 'instances' | 'logs' | 'settings';
export type ThemeMode   = 'dark' | 'light';
export type ThemeAccent = 'blue' | 'violet' | 'sky' | 'emerald' | 'rose';
export type AiProviderId = 'anthropic' | 'openai' | 'google' | 'groq' | 'openrouter';

export interface ProviderSettings {
  apiKey: string;
  authMethod: 'apiKey' | 'login';
}

export interface AppInstance {
  name: string; url: string; active: boolean;
  group: string; environment: string;
  toolPackage: string; writeEnabled: boolean; authMethod: 'basic' | 'oauth';
}

export interface AppSettings {
  providers: {
    anthropic:  ProviderSettings;
    openai:     ProviderSettings;
    google:     ProviderSettings;
    groq:       ProviderSettings;
    openrouter: ProviderSettings;
  };
  activeProvider: AiProviderId;
  model: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  providers: {
    anthropic:  { apiKey: '', authMethod: 'apiKey' },
    openai:     { apiKey: '', authMethod: 'apiKey' },
    google:     { apiKey: '', authMethod: 'apiKey' },
    groq:       { apiKey: '', authMethod: 'apiKey' },
    openrouter: { apiKey: '', authMethod: 'apiKey' },
  },
  activeProvider: 'anthropic',
  model: 'claude-sonnet-4-6',
};

// ── Theme context ─────────────────────────────────────────────────────────────
interface ThemeCtx { mode: ThemeMode; accent: ThemeAccent; setMode: (m: ThemeMode) => void; setAccent: (a: ThemeAccent) => void; }
export const ThemeContext = createContext<ThemeCtx>({ mode: 'dark', accent: 'blue', setMode: () => {}, setAccent: () => {} });
export const useTheme = () => useContext(ThemeContext);

// ── Bridge type ───────────────────────────────────────────────────────────────
type Bridge = Record<string, (...a: unknown[]) => Promise<unknown>>;
function nw() { return (window as unknown as { nowaikit?: Bridge }).nowaikit; }

// Apply theme to <html> and persist
function applyTheme(mode: ThemeMode, accent: ThemeAccent) {
  document.documentElement.setAttribute('data-theme',  mode);
  document.documentElement.setAttribute('data-accent', accent);
  localStorage.setItem('nwk-theme',  mode);
  localStorage.setItem('nwk-accent', accent);
}

export default function App(): React.ReactElement {
  // ── Theme (initialised from localStorage before first render) ────────────
  const [mode,   setModeState]   = useState<ThemeMode>(  () => (localStorage.getItem('nwk-theme')  as ThemeMode)   || 'dark');
  const [accent, setAccentState] = useState<ThemeAccent>(() => (localStorage.getItem('nwk-accent') as ThemeAccent) || 'blue');

  const setMode   = useCallback((m: ThemeMode)   => { setModeState(m);   applyTheme(m,      accent); }, [accent]);
  const setAccent = useCallback((a: ThemeAccent) => { setAccentState(a); applyTheme(mode,   a); },    [mode]);

  useEffect(() => { applyTheme(mode, accent); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── App state ────────────────────────────────────────────────────────────
  const [page,        setPage]        = useState<Page>('dashboard');
  const [instances,   setInstances]   = useState<AppInstance[]>([]);
  const [serverOnline,setServerOnline]= useState(false);
  const [serverUrl,   setServerUrl]   = useState('http://localhost:3100');
  const [appVersion,  setAppVersion]  = useState('');
  const [settings,    setSettings]    = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading,     setLoading]     = useState(true);
  const [firstRun,    setFirstRun]    = useState(false);

  const checkHealth = useCallback(async () => {
    const bridge = nw();
    if (!bridge) return;
    try {
      const h = await (bridge.health() as Promise<{ status: string }>);
      setServerOnline(h?.status === 'ok');
    } catch { setServerOnline(false); }
  }, []);

  const loadData = useCallback(async () => {
    const bridge = nw();
    if (!bridge) return;
    try {
      const [cfgRes, ver, sets, urlRes] = await Promise.all([
        bridge.listInstances() as Promise<{ data: { defaultInstance: string; instances: Record<string, Record<string, unknown>> } }>,
        bridge.getAppVersion() as Promise<string>,
        bridge.getSettings()   as Promise<Record<string, unknown>>,
        bridge.getServerUrl()  as Promise<string>,
      ]);
      setAppVersion(ver);
      setServerUrl(urlRes ?? 'http://localhost:3100');

      // Migrate legacy settings format → new multi-provider format
      const raw = sets as Record<string, unknown>;
      let parsed: AppSettings = DEFAULT_SETTINGS;
      if (raw['providers']) {
        parsed = raw as unknown as AppSettings;
      } else if (raw['anthropicApiKey']) {
        // Legacy: { anthropicApiKey, model }
        parsed = {
          ...DEFAULT_SETTINGS,
          providers: {
            ...DEFAULT_SETTINGS.providers,
            anthropic: { apiKey: raw['anthropicApiKey'] as string, authMethod: 'apiKey' },
          },
          model: (raw['model'] as string) || DEFAULT_SETTINGS.model,
        };
      }
      setSettings(parsed);

      const def  = cfgRes.data?.defaultInstance ?? '';
      const inst = Object.values(cfgRes.data?.instances ?? {}).map(i => ({
        name: i['name'] as string, url: i['instanceUrl'] as string,
        active: (i['name'] as string) === def,
        group: (i['group'] as string) || 'Default',
        environment: (i['environment'] as string) || '',
        toolPackage: (i['toolPackage'] as string) || 'full',
        writeEnabled: Boolean(i['writeEnabled']),
        authMethod: ((i['authMethod'] as string) || 'basic') as 'basic' | 'oauth',
      }));
      setInstances(inst);
      if (inst.length === 0) setFirstRun(true);
    } catch { setFirstRun(true); }
    await checkHealth();
  }, [checkHealth]);

  useEffect(() => {
    const bridge = nw();
    if (!bridge) { setLoading(false); return; }
    loadData().finally(() => setLoading(false));

    // Poll server health every 15 seconds so "offline" auto-recovers
    const interval = setInterval(checkHealth, 15_000);
    return () => clearInterval(interval);
  }, [loadData, checkHealth]);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:12, color:'var(--dim)' }}>
      <div className="spinner" style={{ width:28, height:28, borderWidth:3 }} />
      <span style={{ fontSize:'0.85rem' }}>Starting nowaikit…</span>
    </div>
  );

  if (firstRun) return (
    <ThemeContext.Provider value={{ mode, accent, setMode, setAccent }}>
      <Setup
        onComplete={() => { setFirstRun(false); loadData(); }}
        onClose={instances.length > 0 ? () => setFirstRun(false) : undefined}
        existingGroups={[...new Set(instances.map(i => i.group).filter(Boolean))]}
      />
    </ThemeContext.Provider>
  );

  const active = instances.find(i => i.active);

  return (
    <ThemeContext.Provider value={{ mode, accent, setMode, setAccent }}>
      <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
        <Sidebar
          currentPage={page}
          onNavigate={setPage}
          instanceName={active?.name}
          instanceCount={instances.length}
          serverOnline={serverOnline}
        />
        <main className="fade-in" key={page} style={{ flex:1, overflow:'auto', padding:'0 32px 28px', background:'var(--bg)' }}>
          {/* Drag region for window dragging (macOS hiddenInset titlebar) */}
          <div style={{ height: 38, flexShrink: 0, WebkitAppRegion: 'drag' } as React.CSSProperties} />
          {page === 'dashboard' && (
            <Dashboard instances={instances} serverOnline={serverOnline} appVersion={appVersion} serverUrl={serverUrl} onRefresh={loadData} onNavigate={setPage} />
          )}
          {page === 'chat' && (
            <Chat settings={settings} serverUrl={serverUrl} instances={instances} />
          )}
          {page === 'tools' && (
            <Tools activeToolPackage={active?.toolPackage ?? 'full'} serverOnline={serverOnline} serverUrl={serverUrl} onRestart={loadData} />
          )}
          {page === 'instances' && (
            <Instances
              instances={instances}
              onRemove={async name => { await nw()?.removeInstance(name); loadData(); }}
              onSetDefault={async name => { await nw()?.setDefaultInstance(name); loadData(); }}
              onTest={name => (nw()?.testInstance(name) as Promise<{ ok: boolean; message: string }>) ?? Promise.resolve({ ok: false, message: 'Bridge unavailable' })}
              onAddInstance={() => setFirstRun(true)}
            />
          )}
          {page === 'logs'     && <Logs />}
          {page === 'settings' && (
            <Settings
              settings={settings}
              activeInstance={active}
              onNavigate={setPage}
              onSave={async updated => {
                setSettings(updated);
                await nw()?.setSettings(updated as unknown as Record<string, unknown>);
              }}
            />
          )}
        </main>
      </div>
    </ThemeContext.Provider>
  );
}
