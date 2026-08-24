import { useEffect, useState } from 'react';
import { ThemeProvider } from '@jetbrains/int-ui-kit';
import UX3801FlatListPrototype, { POPUP_VARIANTS } from './tasks/UX3801/v1-flat-list';
import './App.css';

/**
 * Prototype shell, ported from VCSprototypes (its src/App.jsx) so both repos
 * navigate the same way: a fixed left panel listing the prototypes on top and
 * their screens below, with the content shifted over by the panel's width.
 *
 * As there, the panel toggles with Ctrl+Cmd+S, the active prototype lives in
 * the URL hash, and the active screen is remembered per prototype in
 * localStorage. Unlike there it starts open, so it is visible without having to
 * know the shortcut.
 *
 * The Kubernetes prototype's "screens" are the Namespaces-popup variants
 * (see POPUP_VARIANTS). The earlier spike in this repo
 * (`components/ServicesToolWindow.tsx`, `data/kubernetesTree.ts`) is left in
 * place but is no longer rendered.
 */

interface Screen {
  id: string;
  label: string;
}

interface ScreenGroup {
  title: string;
  screens: Screen[];
  collapsible?: boolean;
  hidden?: boolean;
}

interface Prototype {
  id: string;
  label: string;
  screenGroups: ScreenGroup[];
}

const PROTOTYPES: Prototype[] = [
  {
    id: 'multi-namespace',
    label: 'Multi-Namespace Resource View',
    screenGroups: [
      {
        title: 'Namespaces popup',
        screens: POPUP_VARIANTS.map((variant) => ({ id: variant.id, label: variant.label })),
      },
    ],
  },
];

const ACTIVE_SCREEN_STORAGE_KEY = 'kubernetes-prototypes-active-screen';

function getPrototypeIdFromHash(): string {
  const hash = window.location.hash.slice(1);
  return PROTOTYPES.some((p) => p.id === hash) ? hash : PROTOTYPES[0].id;
}

function allScreensOf(prototypeId: string): Screen[] {
  const prototype = PROTOTYPES.find((p) => p.id === prototypeId) ?? PROTOTYPES[0];
  return prototype.screenGroups.flatMap((group) => group.screens);
}

function getInitialScreenId(prototypeId: string): string {
  const screens = allScreensOf(prototypeId);
  const stored = window.localStorage.getItem(`${ACTIVE_SCREEN_STORAGE_KEY}-${prototypeId}`);
  return screens.some((s) => s.id === stored) ? (stored as string) : screens[0].id;
}

export default function App() {
  const [activePrototypeId, setActivePrototypeId] = useState(getPrototypeIdFromHash);
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [screenIds, setScreenIds] = useState<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    for (const prototype of PROTOTYPES) {
      result[prototype.id] = getInitialScreenId(prototype.id);
    }
    return result;
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    const collapsed = new Set<string>();
    for (const prototype of PROTOTYPES) {
      for (const group of prototype.screenGroups) {
        if (group.collapsible) collapsed.add(`${prototype.id}::${group.title}`);
      }
    }
    return collapsed;
  });

  useEffect(() => {
    const handleHashChange = () => setActivePrototypeId(getPrototypeIdFromHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.metaKey && event.key === 's') {
        event.preventDefault();
        setIsPanelVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activePrototype = PROTOTYPES.find((p) => p.id === activePrototypeId) ?? PROTOTYPES[0];
  const activeScreenId = screenIds[activePrototypeId];
  const variant = POPUP_VARIANTS.find((v) => v.id === activeScreenId) ?? POPUP_VARIANTS[0];

  const handlePrototypeChange = (prototypeId: string) => {
    window.location.hash = prototypeId;
    setActivePrototypeId(prototypeId);
  };

  const handleScreenChange = (screenId: string) => {
    window.localStorage.setItem(`${ACTIVE_SCREEN_STORAGE_KEY}-${activePrototypeId}`, screenId);
    setScreenIds((prev) => ({ ...prev, [activePrototypeId]: screenId }));
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const visibleGroups = activePrototype.screenGroups.filter((group) => !group.hidden);
  const hasMultipleScreens = visibleGroups.flatMap((group) => group.screens).length > 1;

  return (
    <ThemeProvider>
      <main className={`prototype-shell${isPanelVisible ? ' panel-visible' : ''}`}>
        <nav className="screen-switcher" aria-label="Prototype navigation">
          <div className="prototype-picker">
            {PROTOTYPES.map((prototype) => (
              <button
                key={prototype.id}
                type="button"
                className={`prototype-picker-item${prototype.id === activePrototypeId ? ' prototype-picker-item-active' : ''}`}
                onClick={() => handlePrototypeChange(prototype.id)}
              >
                {prototype.label}
              </button>
            ))}
          </div>

          {hasMultipleScreens && (
            <div className="screen-groups">
              {visibleGroups.map((group) => {
                const groupKey = `${activePrototypeId}::${group.title}`;
                const isCollapsed = collapsedGroups.has(groupKey);
                return (
                  <div className="screen-switcher-group" key={group.title}>
                    {group.collapsible ? (
                      <button
                        type="button"
                        className="screen-switcher-group-title screen-switcher-group-title-collapsible"
                        onClick={() => toggleGroup(groupKey)}
                      >
                        <span
                          className={`screen-switcher-group-arrow${isCollapsed ? '' : ' screen-switcher-group-arrow-expanded'}`}
                        >
                          ▶
                        </span>
                        {group.title}
                      </button>
                    ) : (
                      <div className="screen-switcher-group-title">{group.title}</div>
                    )}
                    {!isCollapsed &&
                      group.screens.map((screen) => (
                        <button
                          key={screen.id}
                          type="button"
                          className={`screen-switcher-tab${screen.id === activeScreenId ? ' screen-switcher-tab-active' : ''}`}
                          role="tab"
                          aria-selected={screen.id === activeScreenId}
                          onClick={() => handleScreenChange(screen.id)}
                        >
                          {screen.label}
                        </button>
                      ))}
                  </div>
                );
              })}
            </div>
          )}
        </nav>

        <div className="prototype-content">
          <UX3801FlatListPrototype
            key={`${activePrototypeId}::${activeScreenId}`}
            variant={variant}
          />
        </div>
      </main>
    </ThemeProvider>
  );
}
