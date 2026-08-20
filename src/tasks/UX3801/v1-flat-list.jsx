// UX-3801 — Variant 1: flat pod list with a per-row namespace badge.
// Figma reference: "Connection to several Namespaces", node 33:225.
// Demonstrates Scenario 1 (Incident Investigation) end-to-end: manually add
// namespaces to a working set, scan the merged status-sorted table, spot the
// failing pod. See Prototype Boundary.md for scope.
// ui-contract-allow-file dynamic-icon-name -- every dynamic `icon={...}` reference in this file resolves to STUB_ICON ('misc/stub'), a fixed constant already verified against the icon registry.

import { useEffect, useRef, useState } from 'react'
import {
    MainWindow,
    ToolWindow,
    Table,
    Icon,
    ToolbarIconButton,
    ToolbarSeparator,
    PositionedPopup,
    Popup,
    PopupCell,
    useDraggable,
    defaultBottomPanelContent,
} from '@jetbrains/int-ui-kit'
import Tree from './Tree'
import { NAMESPACES, PODS, STATUS_ICON, sortPods, sortPodsByNamespace } from './shared'
import './UX3801.css'

// Category-node icons are stubbed for now (misc/stub — the kit's own
// unresolved-icon fallback) — see Spec Decisions for why.
const STUB_ICON = 'misc/stub'

// Namespace popup: the four reserved namespaces every real cluster has,
// listed ahead of the prototype's own sample namespaces (NAMESPACES).
const SYSTEM_NAMESPACES = ['default', 'kube-public', 'kube-node-lease', 'kube-system']
const ALL_NAMESPACE_IDS = [...SYSTEM_NAMESPACES, ...NAMESPACES]

// Fixed px widths, not percentages — at panel widths this tool window
// realistically gets, seven columns can't all fit legibly. Explicit widths
// make the underlying `table-layout: fixed` element wider than its
// container, so the right pane (`.k8s-right`) scrolls to reveal the rest
// instead of squeezing headers into overlapping text.
const TABLE_COLUMNS = [
    {
        key: 'statusText',
        title: 'Status',
        width: 210,
        render: (value, row) => (
            <span className="k8s-status-cell">
                <Icon name={STATUS_ICON[row.status]} size={16} />
                <span>{value}</span>
            </span>
        ),
    },
    { key: 'name', title: 'Name', width: 230 },
    { key: 'namespace', title: 'Namespaces', width: 100 },
    { key: 'labels', title: 'Labels', width: 170 },
    { key: 'node', title: 'Node', width: 120 },
    { key: 'restarts', title: 'Restart', width: 80 },
    { key: 'age', title: 'Age', width: 80 },
]

function buildTreeData(allNamespacesSelected, selectedNamespaces) {
    const visibleNamespaces = allNamespacesSelected ? ALL_NAMESPACE_IDS : selectedNamespaces

    // Sorted by namespace (not status) per explicit request.
    const podChildren = sortPodsByNamespace(PODS.filter((p) => visibleNamespaces.includes(p.namespace))).map((p) => ({
        id: `pod-${p.id}`,
        label: p.name,
        icon: STUB_ICON,
        secondaryText: `[${p.namespace}]`,
        // Fifth level: the pod's container. Not collapsible — a leaf, no
        // children of its own.
        children: [
            { id: `container-${p.id}`, label: p.container, icon: STUB_ICON },
        ],
    }))

    // Only spell out the working set for a genuine, deliberate subset — "All
    // Namespaces" (the default) or an empty selection both read cleaner as
    // the plain name than a full or empty bracket list.
    const clusterLabel = !allNamespacesSelected && selectedNamespaces.length > 0
        ? `staging-cluster [${selectedNamespaces.join(', ')}]`
        : 'staging-cluster'

    return [
        {
            id: 'cluster',
            label: clusterLabel,
            icon: STUB_ICON,
            isExpanded: true,
            children: [
                {
                    id: 'workloads',
                    label: 'Workloads',
                    icon: STUB_ICON,
                    isExpanded: true,
                    children: [
                        {
                            id: 'pod-group',
                            label: 'Pod',
                            icon: STUB_ICON,
                            isExpanded: true,
                            forceExpandable: true,
                            children: podChildren,
                        },
                        { id: 'deployment', label: 'Deployment', icon: STUB_ICON, forceExpandable: true },
                        { id: 'stateful-set', label: 'Stateful Set', icon: STUB_ICON, forceExpandable: true },
                        { id: 'daemon-set', label: 'Daemon Set', icon: STUB_ICON, forceExpandable: true },
                        { id: 'job', label: 'Job', icon: STUB_ICON, forceExpandable: true },
                        { id: 'cron-job', label: 'Cron Job', icon: STUB_ICON, forceExpandable: true },
                        { id: 'replica-set', label: 'Replica Set', icon: STUB_ICON, forceExpandable: true },
                        { id: 'replication-controller', label: 'Replication Controller', icon: STUB_ICON, forceExpandable: true },
                    ],
                },
                { id: 'network', label: 'Network', icon: STUB_ICON, forceExpandable: true },
                { id: 'configuration', label: 'Configuration', icon: STUB_ICON, forceExpandable: true },
                { id: 'storage', label: 'Storage', icon: STUB_ICON, forceExpandable: true },
                { id: 'crd', label: 'Custom Resource Definition', icon: STUB_ICON },
                { id: 'event', label: 'Event', icon: STUB_ICON },
            ],
        },
    ]
}

// Second-level nodes that get the "resource category" menu (ResourceCategoryContextMenu)
// rather than the "Workloads" menu — every direct child of the cluster node except Workloads.
const RESOURCE_CATEGORY_NODE_IDS = ['network', 'configuration', 'storage', 'crd', 'event']

// Shared block reused by all three context menus below (cluster, Workloads,
// other resource categories) — reference screenshots show it identically in
// each, positioned differently relative to the menu-specific items around it.
function CommonNamespaceMenuItems({ onDismiss, onOpenNamespace }) {
    return (
        <>
            <PopupCell icon={STUB_ICON} onClick={onOpenNamespace}>Namespace</PopupCell>
            <PopupCell icon={STUB_ICON} onClick={onDismiss}>Open Kubeconfig File in Editor</PopupCell>
            <PopupCell icon={STUB_ICON} submenu onClick={onDismiss}>Add Clusters</PopupCell>
            <PopupCell icon={STUB_ICON} onClick={onDismiss}>Show Cluster Settings…</PopupCell>
            <PopupCell type="separator" />
            <PopupCell iconGap onClick={onDismiss}>Open in New Tab</PopupCell>
            <PopupCell iconGap onClick={onDismiss}>Open Each in New Tab</PopupCell>
            <PopupCell iconGap onClick={onDismiss}>Open Each Type in New Tab</PopupCell>
            <PopupCell iconGap onClick={onDismiss}>Open in Separate Tool Window</PopupCell>
        </>
    )
}

// Reference: cluster-node right-click menu screenshot supplied by the user.
// Decorative only — every item just closes the menu, no icon carries its
// real meaning (all use STUB_ICON per direct instruction).
function ClusterContextMenu({ rect, onDismiss, onOpenNamespace }) {
    return (
        <PositionedPopup triggerRect={rect} onDismiss={onDismiss}>
            <Popup visible style={{ position: 'static' }}>
                <PopupCell icon={STUB_ICON} onClick={onDismiss}>Disconnect</PopupCell>
                <PopupCell iconGap onClick={onDismiss}>Set Cluster as Current</PopupCell>
                <PopupCell type="separator" />
                <PopupCell icon={STUB_ICON} onClick={onDismiss}>Open Cluster Logs Tab</PopupCell>
                <PopupCell type="separator" />
                <CommonNamespaceMenuItems onDismiss={onDismiss} onOpenNamespace={onOpenNamespace} />
                <PopupCell type="separator" />
                <PopupCell icon={STUB_ICON} onClick={onDismiss}>Connect Telepresence</PopupCell>
                <PopupCell type="separator" />
                <PopupCell
                    iconGap
                    shortcut={<Icon name={STUB_ICON} size={16} />}
                    onClick={onDismiss}
                >
                    Remove from Tool Window…
                </PopupCell>
            </Popup>
        </PositionedPopup>
    )
}

// Reference: "Workloads" node right-click menu screenshot supplied by the user.
function WorkloadsContextMenu({ rect, onDismiss, onOpenNamespace }) {
    return (
        <PositionedPopup triggerRect={rect} onDismiss={onDismiss}>
            <Popup visible style={{ position: 'static' }}>
                <PopupCell icon={STUB_ICON} onClick={onDismiss}>Open Cluster Logs Tab</PopupCell>
                <PopupCell type="separator" />
                <CommonNamespaceMenuItems onDismiss={onDismiss} onOpenNamespace={onOpenNamespace} />
            </Popup>
        </PositionedPopup>
    )
}

// Reference: right-click menu for every other second-level resource category
// (Network, Configuration, Storage, Custom Resource Definition, Event).
function ResourceCategoryContextMenu({ rect, onDismiss, onOpenNamespace }) {
    return (
        <PositionedPopup triggerRect={rect} onDismiss={onDismiss}>
            <Popup visible style={{ position: 'static' }}>
                <CommonNamespaceMenuItems onDismiss={onDismiss} onOpenNamespace={onOpenNamespace} />
            </Popup>
        </PositionedPopup>
    )
}

// Namespace-selection popup: opened from any of the three context menus
// above via their "Namespace" item.
//
// "All Namespaces" and the individual namespaces below it are NOT one
// uniform checkbox group: "All Namespaces" is radio-exclusive against
// "any individual namespace is selected" (picking one clears the other),
// while the individual namespaces are ordinary independent checkboxes
// among themselves. So exactly one of two states holds at a time:
//   - All Namespaces checked, every individual row unchecked, tree/table
//     show every pod.
//   - All Namespaces unchecked, zero or more individual rows checked
//     (real checkbox toggling), tree/table show only those namespaces.
// Draggable by its header, via the kit's `useDraggable` (same pattern as
// the kit's own draggable `Dialog`).
function NamespacePopup({ rect, allSelected, selected, onToggle, onToggleAll, onDismiss }) {
    const { delta, onDragHandleMouseDown } = useDraggable()
    const wrapperRef = useRef(null)

    // The canonical `header` prop (rather than a manually-rendered header
    // cell) keeps the exact kit padding/placement — the drag handle is
    // wired onto that rendered node directly so only the header (not the
    // whole popup body) starts a drag.
    useEffect(() => {
        const header = wrapperRef.current?.querySelector('.popup-cell-header')
        if (!header) return undefined
        header.style.cursor = 'grab'
        header.addEventListener('mousedown', onDragHandleMouseDown)
        return () => header.removeEventListener('mousedown', onDragHandleMouseDown)
    }, [onDragHandleMouseDown])

    return (
        <PositionedPopup triggerRect={rect} onDismiss={onDismiss}>
            <div ref={wrapperRef}>
                <Popup
                    visible
                    header="Namespace"
                    style={{ position: 'static', transform: `translate(${delta.dx}px, ${delta.dy}px)` }}
                >
                    <PopupCell
                        icon={allSelected ? <Icon name="general/checkmark" size={16} /> : undefined}
                        iconGap={!allSelected}
                        onClick={onToggleAll}
                    >
                        All Namespaces
                    </PopupCell>
                    {ALL_NAMESPACE_IDS.map((namespace) => {
                        const isSelected = !allSelected && selected.includes(namespace)
                        return (
                            <PopupCell
                                key={namespace}
                                icon={isSelected ? <Icon name="general/checkmark" size={16} /> : undefined}
                                iconGap={!isSelected}
                                onClick={() => onToggle(namespace)}
                            >
                                {namespace}
                            </PopupCell>
                        )
                    })}
                </Popup>
            </div>
        </PositionedPopup>
    )
}

function KubernetesServicesPanel({ focused, onFocus, onActionClick, layoutMode, className }) {
    const [selectedPodId, setSelectedPodId] = useState(null)
    const [nodeContextMenu, setNodeContextMenu] = useState(null)
    const [namespacePopupRect, setNamespacePopupRect] = useState(null)
    // "All Namespaces" selected by default, so the tree/table keep showing
    // the full reference set until the user deliberately narrows the
    // working set via the Namespace popup. `selectedNamespaces` only holds
    // meaningful content while `allNamespacesSelected` is false — see
    // NamespacePopup's comment for the radio-vs-checkbox relationship.
    const [allNamespacesSelected, setAllNamespacesSelected] = useState(true)
    const [selectedNamespaces, setSelectedNamespaces] = useState([])

    const visibleNamespaces = allNamespacesSelected ? ALL_NAMESPACE_IDS : selectedNamespaces
    const visiblePods = sortPods(PODS.filter((p) => visibleNamespaces.includes(p.namespace)))
    const selectedIndex = visiblePods.findIndex((p) => p.id === selectedPodId)

    function selectPod(podId) {
        setSelectedPodId(podId)
    }

    function openNamespacePopup(event) {
        setNodeContextMenu(null)
        setNamespacePopupRect({ x: event.clientX, y: event.clientY })
    }

    // Selecting any individual namespace always drops out of "All
    // Namespaces" mode first (even if it's already off) — the two are
    // mutually exclusive, not a shared checkbox set.
    function toggleNamespace(namespace) {
        setAllNamespacesSelected(false)
        setSelectedNamespaces((current) =>
            current.includes(namespace)
                ? current.filter((ns) => ns !== namespace)
                : [...current, namespace]
        )
    }

    // Radio-button semantics: clicking "All Namespaces" while it's already
    // selected is a no-op (a selected radio can't be unchecked by clicking
    // it again). Clicking it while an individual subset is selected clears
    // that subset and switches to "All Namespaces".
    function toggleAllNamespaces() {
        if (allNamespacesSelected) return
        setAllNamespacesSelected(true)
        setSelectedNamespaces([])
    }

    return (
        <ToolWindow
            title="Services"
            actions={['more', 'minimize']}
            onActionClick={onActionClick}
            focused={focused}
            onFocus={onFocus}
            layoutMode={layoutMode}
            showSeparator
            className={`k8s-services-window ${className ?? ''}`.trim()}
        >
            <div className="k8s-master-detail">
                <div className="k8s-left">
                    <div className="k8s-left-toolbar" role="toolbar">
                        <ToolbarIconButton icon="general/add" dropdown />
                        <ToolbarIconButton icon="general/show" dropdown tooltip="Show" />
                        <ToolbarIconButton icon="general/openNewTab" tooltip="Open in New Tab" />
                        <ToolbarSeparator />
                        <ToolbarIconButton icon="general/expandAll" tooltip="Expand All" />
                        <ToolbarIconButton icon="general/collapseAll" tooltip="Collapse All" />
                    </div>
                    <div className="k8s-left-tree">
                        <Tree
                            data={buildTreeData(allNamespacesSelected, selectedNamespaces)}
                            onNodeSelect={(nodeId) => {
                                if (nodeId.startsWith('pod-')) selectPod(nodeId.slice(4))
                            }}
                            onNodeContextMenu={(nodeId, event) => {
                                let type = null
                                if (nodeId === 'cluster') type = 'cluster'
                                else if (nodeId === 'workloads') type = 'workloads'
                                else if (RESOURCE_CATEGORY_NODE_IDS.includes(nodeId)) type = 'resource-category'
                                if (!type) return
                                event.preventDefault()
                                setNodeContextMenu({ type, rect: { x: event.clientX, y: event.clientY } })
                            }}
                        />
                    </div>
                    {nodeContextMenu?.type === 'cluster' && (
                        <ClusterContextMenu
                            rect={nodeContextMenu.rect}
                            onDismiss={() => setNodeContextMenu(null)}
                            onOpenNamespace={openNamespacePopup}
                        />
                    )}
                    {nodeContextMenu?.type === 'workloads' && (
                        <WorkloadsContextMenu
                            rect={nodeContextMenu.rect}
                            onDismiss={() => setNodeContextMenu(null)}
                            onOpenNamespace={openNamespacePopup}
                        />
                    )}
                    {nodeContextMenu?.type === 'resource-category' && (
                        <ResourceCategoryContextMenu
                            rect={nodeContextMenu.rect}
                            onDismiss={() => setNodeContextMenu(null)}
                            onOpenNamespace={openNamespacePopup}
                        />
                    )}
                    {namespacePopupRect && (
                        <NamespacePopup
                            rect={namespacePopupRect}
                            allSelected={allNamespacesSelected}
                            selected={selectedNamespaces}
                            onToggle={toggleNamespace}
                            onToggleAll={toggleAllNamespaces}
                            onDismiss={() => setNamespacePopupRect(null)}
                        />
                    )}
                </div>

                <div className="k8s-right">
                    <Table
                        columns={TABLE_COLUMNS}
                        data={visiblePods}
                        showToolbar
                        toolbarActions={[{ icon: STUB_ICON }]}
                        selectedRowIndex={selectedIndex >= 0 ? selectedIndex : null}
                        onRowClick={(row) => selectPod(row.id)}
                    />
                </div>
            </div>
        </ToolWindow>
    )
}

export default function UX3801FlatListPrototype() {
    return (
        <MainWindow
            height="100%"
            className="k8s-fill-mainwindow"
            defaultOpenToolWindows={['services']}
            initialBottomPanelHeight={500}
            bottomPanelContent={(id, ctx) =>
                id === 'services' ? (
                    <KubernetesServicesPanel
                        focused={ctx.focusedPanel === 'bottom'}
                        onFocus={() => ctx.setFocusedPanel('bottom')}
                        onActionClick={(action) => {
                            if (action === 'minimize') ctx.setShowBottomPanel(false)
                        }}
                        layoutMode={ctx.toolWindowLayoutMode}
                        className="main-window-tool-window main-window-tool-window-bottom"
                    />
                ) : (
                    defaultBottomPanelContent(id, ctx)
                )
            }
        />
    )
}
