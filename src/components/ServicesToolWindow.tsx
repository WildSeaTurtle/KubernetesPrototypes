import {
  ToolWindow,
  ToolbarIconButton,
  Tree,
  EmptyState,
  DEFAULT_SERVICES_LEFT_TOOLBAR,
  DEFAULT_SERVICES_RIGHT_TOOLBAR,
  type ServicesToolbarItem,
  type ToolWindowLayoutMode,
  type TreeNodeData,
} from '@jetbrains/int-ui-kit';

/**
 * Services tool window with a hierarchical tree.
 *
 * The kit's own `ServicesWindow` renders its `treeData` through `Tree` in
 * `flat` mode — no chevrons, no indentation — which flattens the Kubernetes
 * cluster → namespace → resources hierarchy. This is the same layout and
 * chrome, but with the library `Tree` in normal (expandable) mode.
 */

export interface ServicesToolWindowProps {
  title?: string;
  /** Height in standalone mode. Ignored when docked — the shell drives the size. */
  height?: number | string;
  layoutMode?: ToolWindowLayoutMode;
  treeData?: TreeNodeData[];
  defaultSelectedId?: string;
  detailEmptyText?: string;
  leftToolbar?: ServicesToolbarItem[];
  rightToolbar?: ServicesToolbarItem[];
  onNodeSelect?: (id: string, selected: boolean) => void;
  onNodeToggle?: (id: string, expanded: boolean) => void;
  onActionClick?: (action: string, payload?: unknown) => void;
  focused?: boolean;
}

function Toolbar({ items, prefix }: { items: ServicesToolbarItem[]; prefix: string }) {
  return items.map((item, index) =>
    item.type === 'separator' ? (
      <span key={`${prefix}-sep-${index}`} className="services-toolbar-separator" aria-hidden />
    ) : (
      <ToolbarIconButton
        key={`${prefix}-${item.icon}-${index}`}
        icon={item.icon ?? ''}
        tooltip={item.tooltip}
        onClick={item.onClick}
      />
    ),
  );
}

export function ServicesToolWindow({
  title = 'Services',
  height = 500,
  layoutMode = 'standalone',
  treeData = [],
  defaultSelectedId,
  detailEmptyText = 'Double-click on the server node to connect',
  leftToolbar = DEFAULT_SERVICES_LEFT_TOOLBAR,
  rightToolbar = DEFAULT_SERVICES_RIGHT_TOOLBAR,
  onNodeSelect,
  onNodeToggle,
  onActionClick,
  focused = true,
}: ServicesToolWindowProps) {
  return (
    <ToolWindow
      title={title}
      height={height}
      layoutMode={layoutMode}
      showSeparator
      actions={['more', 'minimize']}
      onActionClick={onActionClick}
      toolbarExtra={
        <ToolbarIconButton
          icon="general/locate"
          tooltip="Locate"
          onClick={() => onActionClick?.('locate')}
        />
      }
      focused={focused}
      className="services-window"
    >
      <div className="services-master-detail">
        <div className="services-left">
          <div className="services-left-toolbar" role="toolbar">
            <Toolbar items={leftToolbar} prefix="left" />
          </div>
          <div className="services-left-tree">
            <Tree
              data={treeData}
              defaultSelectedId={defaultSelectedId}
              onNodeSelect={onNodeSelect}
              onNodeToggle={onNodeToggle}
            />
          </div>
        </div>
        <div className="services-right">
          <div className="services-right-toolbar" role="toolbar">
            <Toolbar items={rightToolbar} prefix="right" />
          </div>
          <div className="services-right-body">
            <EmptyState explanation={detailEmptyText} />
          </div>
        </div>
      </div>
    </ToolWindow>
  );
}
