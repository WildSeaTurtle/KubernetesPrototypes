import { ThemeProvider } from '@jetbrains/int-ui-kit';
import UX3801FlatListPrototype from './tasks/UX3801/v1-flat-list';

/**
 * UX-3801 — Kubernetes Services tool window, copied from int-ui-prototypes
 * (`src/tasks/UX3801/`). The prototype brings its own `MainWindow`, so this
 * app only supplies the theme.
 *
 * The files under `src/tasks/UX3801/` are verbatim copies, kept as `.jsx` so
 * they can be re-synced from int-ui-prototypes without a rewrite. The earlier
 * spike here (`components/ServicesToolWindow.tsx`, `data/kubernetesTree.ts`)
 * is left in place but is no longer rendered.
 */
export default function App() {
  return (
    <ThemeProvider>
      <UX3801FlatListPrototype />
    </ThemeProvider>
  );
}
