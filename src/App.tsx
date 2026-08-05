import {
  ThemeProvider,
  MainWindow,
  defaultBottomPanelContent,
  DEFAULT_SERVICES_TREE_DATA,
  DEFAULT_SERVICES_LEFT_TOOLBAR,
  DEFAULT_SERVICES_RIGHT_TOOLBAR,
  type PanelContext,
} from '@jetbrains/int-ui-kit';
import { ServicesToolWindow } from './components/ServicesToolWindow';
import { KUBERNETES_TREE_NODE } from './data/kubernetesTree';

const servicesTree = [KUBERNETES_TREE_NODE, ...DEFAULT_SERVICES_TREE_DATA];

function bottomPanelContent(stripeId: string, context: PanelContext) {
  if (stripeId !== 'services') return defaultBottomPanelContent(stripeId, context);

  return (
    <ServicesToolWindow
      treeData={servicesTree}
      defaultSelectedId="kubernetes"
      leftToolbar={DEFAULT_SERVICES_LEFT_TOOLBAR}
      rightToolbar={DEFAULT_SERVICES_RIGHT_TOOLBAR}
      layoutMode={context.toolWindowLayoutMode}
      focused={context.focusedPanel === 'bottom'}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainWindow
        projectName="kubernetes-prototypes"
        projectIcon="KP"
        defaultOpenToolWindows={['project', 'services']}
        bottomPanelContent={bottomPanelContent}
        initialBottomPanelHeight={500}
      />
    </ThemeProvider>
  );
}
