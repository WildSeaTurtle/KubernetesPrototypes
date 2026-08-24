import { useEffect, useState } from 'react';
import { ThemeProvider } from '@jetbrains/int-ui-kit';
import UX3801FlatListPrototype, { POPUP_VARIANTS } from './tasks/UX3801/v1-flat-list';
import './App.css';

/**
 * Prototype shell, ported from VCSprototypes (its src/App.jsx) so both repos
 * navigate the same way: a fixed left panel listing the prototypes on top and
 * their screens below, with the content shifted over by the panel's width.
 *
 * As there, the panel toggles with a shortcut (here Cmd/Ctrl+Shift+S) and the
 * active screen is remembered per prototype in localStorage. Unlike there it
 * starts open, so it is visible without having to know the shortcut, and the URL
 * hash carries the screen as well as the prototype — `#multi-namespace/v2` — so
 * a link opens on the exact variant it was copied from. The hash wins over
 * localStorage on load; localStorage only supplies the screen for a hash that
 * names none.
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

function allScreensOf(prototypeId: string): Screen[] {
  const prototype = PROTOTYPES.find((p) => p.id === prototypeId) ?? PROTOTYPES[0];
  return prototype.screenGroups.flatMap((group) => group.screens);
}

// `#<prototype>/<screen>` — both halves validated against the tables above, so a
// stale or hand-edited link degrades to the first prototype/screen instead of
// rendering nothing. A one-segment hash is still accepted (that was the format
// before screens were addressable, and links to it are already out there); its
// screen comes back as null, which is the caller's cue to fall back to
// localStorage.
function parseHash(): { prototypeId: string; screenId: string | null } {
  const [prototypeSegment, screenSegment] = window.location.hash.slice(1).split('/');
  const prototypeId = PROTOTYPES.some((p) => p.id === prototypeSegment)
    ? prototypeSegment
    : PROTOTYPES[0].id;
  const screenId = allScreensOf(prototypeId).some((s) => s.id === screenSegment)
    ? screenSegment
    : null;
  return { prototypeId, screenId };
}

function getInitialScreenId(prototypeId: string): string {
  const screens = allScreensOf(prototypeId);
  const fromHash = parseHash();
  if (fromHash.prototypeId === prototypeId && fromHash.screenId) return fromHash.screenId;
  const stored = window.localStorage.getItem(`${ACTIVE_SCREEN_STORAGE_KEY}-${prototypeId}`);
  return screens.some((s) => s.id === stored) ? (stored as string) : screens[0].id;
}

export default function App() {
  const [activePrototypeId, setActivePrototypeId] = useState(() => parseHash().prototypeId);
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

  // Both directions of the same address. A hash change — someone pasting a link,
  // or the browser's Back button after switching variants — applies prototype and
  // screen together; the handlers below write the hash when the panel is used.
  useEffect(() => {
    const handleHashChange = () => {
      const { prototypeId, screenId } = parseHash();
      setActivePrototypeId(prototypeId);
      if (screenId) setScreenIds((prev) => ({ ...prev, [prototypeId]: screenId }));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // A hash naming no screen (or none at all) is normalised to the screen actually
  // rendered, so the address bar is copy-pasteable the moment the app loads
  // rather than only after the first click. `replaceState` rather than assigning
  // `location.hash`: this is the same state the user arrived in, not a place to
  // go Back to.
  useEffect(() => {
    const target = `#${activePrototypeId}/${screenIds[activePrototypeId]}`;
    if (window.location.hash !== target) {
      window.history.replaceState(null, '', target);
    }
  }, [activePrototypeId, screenIds]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+Shift+S on macOS, Ctrl+Shift+S elsewhere. `event.key` is 'S' while
      // Shift is held, hence the case-insensitive compare.
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 's') {
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

  // Assigning `location.hash` (rather than replacing it) is deliberate here and
  // in handleScreenChange: each pick becomes a history entry, so Back walks the
  // variants you looked at — which is how you compare two of them.
  const handlePrototypeChange = (prototypeId: string) => {
    window.location.hash = `${prototypeId}/${screenIds[prototypeId]}`;
    setActivePrototypeId(prototypeId);
  };

  const handleScreenChange = (screenId: string) => {
    window.localStorage.setItem(`${ACTIVE_SCREEN_STORAGE_KEY}-${activePrototypeId}`, screenId);
    window.location.hash = `${activePrototypeId}/${screenId}`;
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
