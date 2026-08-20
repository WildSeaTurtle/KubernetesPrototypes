// UX-3801 — Variant 1: flat pod list with a per-row namespace badge.
// Figma reference: "Connection to several Namespaces", node 33:225.
// Demonstrates Scenario 1 (Incident Investigation) end-to-end: manually add
// namespaces to a working set, scan the merged status-sorted table, spot the
// failing pod. See Prototype Boundary.md for scope.
// ui-contract-allow-file dynamic-icon-name -- every dynamic `icon={...}` reference in this file resolves to STUB_ICON ('misc/stub'), a fixed constant already verified against the icon registry.

import { useState } from 'react'
import {
    MainWindow,
    ToolWindow,
    Table,
    Icon,
    ToolbarIconButton,
    ToolbarSeparator,
    ToolbarButton,
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

// Row order in the Namespace popup: selected favourites, then selected, then
// favourites, then everything else. `sort` is stable in every engine this runs
// on, so rows keep their ALL_NAMESPACE_IDS order within a group.
function namespaceRank(namespace, selected, favorites) {
    const isSelected = selected.includes(namespace)
    const isFavorite = favorites.includes(namespace)
    if (isSelected && isFavorite) return 0
    if (isSelected) return 1
    if (isFavorite) return 2
    return 3
}

function orderNamespaces(selected, favorites) {
    return [...ALL_NAMESPACE_IDS].sort(
        (a, b) => namespaceRank(a, selected, favorites) - namespaceRank(b, selected, favorites),
    )
}

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

// The two blocks below are shared by all three context menus (cluster,
// Workloads, other resource categories) — reference screenshots show them
// identically in each. They are kept separate rather than as one block
// because the cluster menu interleaves "Connect Telepresence…" between them,
// while the other two menus render them back to back.
function ClusterActionsMenuItems({ onDismiss, onOpenNamespace }) {
    return (
        <>
            <PopupCell icon={STUB_ICON} onClick={onOpenNamespace}>Set Namespaces…</PopupCell>
            <PopupCell icon={STUB_ICON} onClick={onDismiss}>Open Kubeconfig File in Editor</PopupCell>
            <PopupCell iconGap submenu onClick={onDismiss}>Add Clusters</PopupCell>
            <PopupCell icon={STUB_ICON} onClick={onDismiss}>Cluster Settings…</PopupCell>
        </>
    )
}

function OpenInTabMenuItems({ onDismiss }) {
    return (
        <>
            <PopupCell iconGap onClick={onDismiss}>Open in New Tab</PopupCell>
            <PopupCell iconGap onClick={onDismiss}>Open Each in New Tab</PopupCell>
            <PopupCell iconGap onClick={onDismiss}>Open Each Type in New Tab</PopupCell>
            <PopupCell iconGap onClick={onDismiss}>Open in Separate Tool Window</PopupCell>
        </>
    )
}

// Reference: cluster-node menu screenshot supplied by the user. Five groups:
// connection state, cluster actions, Telepresence, tab placement, removal.
// Decorative only — every item just closes the menu, no icon carries its real
// meaning (all use STUB_ICON: of the icons in the reference, only the gear is
// findable in the kit registry, so none are used rather than mixing one real
// icon into an otherwise stubbed menu).
function ClusterContextMenu({ rect, onDismiss, onOpenNamespace }) {
    return (
        <PositionedPopup triggerRect={rect} onDismiss={onDismiss}>
            <Popup visible style={{ position: 'static' }}>
                <PopupCell icon={STUB_ICON} onClick={onDismiss}>Disconnect</PopupCell>
                <PopupCell iconGap onClick={onDismiss}>Set Cluster as Current</PopupCell>
                <PopupCell icon={STUB_ICON} onClick={onDismiss}>Open Cluster Logs Tab</PopupCell>
                <PopupCell type="separator" />
                <ClusterActionsMenuItems onDismiss={onDismiss} onOpenNamespace={onOpenNamespace} />
                <PopupCell type="separator" />
                <PopupCell icon={STUB_ICON} onClick={onDismiss}>Connect Telepresence…</PopupCell>
                <PopupCell type="separator" />
                <OpenInTabMenuItems onDismiss={onDismiss} />
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
                <ClusterActionsMenuItems onDismiss={onDismiss} onOpenNamespace={onOpenNamespace} />
                <PopupCell type="separator" />
                <OpenInTabMenuItems onDismiss={onDismiss} />
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
                <ClusterActionsMenuItems onDismiss={onDismiss} onOpenNamespace={onOpenNamespace} />
                <PopupCell type="separator" />
                <OpenInTabMenuItems onDismiss={onDismiss} />
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
// Each namespace row carries a favourite star in the kit's right-hand
// `shortcut` slot: filled (`nodes/star`) when favourited and always visible,
// outline (`nodes/starEmpty`) only while the row is hovered. Clicking the star
// stops propagation so it toggles the favourite without also toggling the
// row's selection.
function NamespacePopup({ rect, allSelected, selected, favorites, onToggle, onToggleAll, onToggleFavorite, onDismiss }) {
    const { delta, onDragHandleMouseDown } = useDraggable()

    // Row order is frozen for as long as this popup stays open. The component
    // is unmounted on close (see KubernetesServicesPanel), so this snapshot is
    // recomputed on each open — which is exactly the required behaviour:
    // starring a namespace leaves it in place now and lifts it to the top only
    // next time the popup is opened, never re-sorting under the pointer.
    const [orderedNamespaces] = useState(() => orderNamespaces(selected, favorites))

    return (
        <PositionedPopup triggerRect={rect} onDismiss={onDismiss}>
            {/* The drag offset goes on this wrapper, not on `Popup` — that is the
                pattern `useDraggable` documents (transform on the draggable root,
                mousedown on the handle), and it leaves `Popup`'s own reveal
                transform alone. */}
            <div
                className="k8s-namespace-popup"
                style={{ transform: `translate(${delta.dx}px, ${delta.dy}px)` }}
            >
                {/* Drag handle: the top 7px of the popup. The header that used to
                    serve as one is gone, so this strip replaces it. It sits above
                    the popup body so the mousedown reaches it and not the first
                    row, and above PositionedPopup's dismiss overlay so starting a
                    drag doesn't close the popup. */}
                <div
                    className="k8s-namespace-popup-drag-handle"
                    onMouseDown={onDragHandleMouseDown}
                />
                <Popup visible style={{ position: 'static' }}>
                    <PopupCell
                        icon={allSelected ? <Icon name="general/checkmark" size={16} /> : undefined}
                        iconGap={!allSelected}
                        onClick={onToggleAll}
                    >
                        All Namespaces
                    </PopupCell>
                    <PopupCell type="separator" />
                    {orderedNamespaces.map((namespace) => {
                        const isSelected = !allSelected && selected.includes(namespace)
                        const isFavorite = favorites.includes(namespace)
                        return (
                            <PopupCell
                                key={namespace}
                                icon={isSelected ? <Icon name="general/checkmark" size={16} /> : undefined}
                                iconGap={!isSelected}
                                onClick={() => onToggle(namespace)}
                                shortcut={
                                    <span
                                        className={`k8s-namespace-star ${isFavorite ? '' : 'k8s-namespace-star-empty'}`.trim()}
                                        role="button"
                                        aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            onToggleFavorite(namespace)
                                        }}
                                    >
                                        {isFavorite ? (
                                            <Icon name="nodes/star" size={16} />
                                        ) : (
                                            <Icon name="nodes/starEmpty" size={16} />
                                        )}
                                    </span>
                                }
                            >
                                {namespace}
                            </PopupCell>
                        )
                    })}
                    <PopupCell type="separator" />
                    {/* Decorative, like every other action in these menus — it
                        just closes the popup. `type="footer"` gives the kit's own
                        footer band and rounded bottom corners; the link colour
                        and pointer cursor are set in UX3801.css, since PopupCell
                        does not forward `className`. */}
                    <PopupCell type="footer" onClick={onDismiss}>Create Namespace…</PopupCell>
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
    // Which of the two panes owns the active selection. The other pane keeps
    // its selection but renders it with `--selection-bg-inactive`, the way the
    // IDE greys out a selection in a pane that isn't the focused one. Both
    // panes keep their own selection independently — moving between them only
    // changes which one reads as active.
    const [activePane, setActivePane] = useState('tree')
    // Favourites live here, not in NamespacePopup, so they survive the popup
    // being closed and reopened — which is what makes the reorder-on-reopen
    // behaviour observable at all.
    const [favoriteNamespaces, setFavoriteNamespaces] = useState([])

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

    // Favouriting is independent of selection — it only affects row order, and
    // only from the next time the popup opens.
    function toggleFavoriteNamespace(namespace) {
        setFavoriteNamespaces((current) =>
            current.includes(namespace)
                ? current.filter((ns) => ns !== namespace)
                : [...current, namespace]
        )
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
                <div className={`k8s-left ${activePane === 'tree' ? '' : 'k8s-pane-inactive'}`.trim()}>
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
                            // Selecting a node only hands the active selection to
                            // the tree — it deliberately does not select the
                            // matching table row. Table selection is driven by
                            // clicking a row directly. Context menus open on
                            // right-click only, via onNodeContextMenu below.
                            onNodeSelect={() => setActivePane('tree')}
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
                            favorites={favoriteNamespaces}
                            onToggle={toggleNamespace}
                            onToggleAll={toggleAllNamespaces}
                            onToggleFavorite={toggleFavoriteNamespace}
                            onDismiss={() => setNamespacePopupRect(null)}
                        />
                    )}
                </div>

                <div className={`k8s-right ${activePane === 'table' ? '' : 'k8s-pane-inactive'}`.trim()}>
                    {/* Hand-rolled instead of Table's own `showToolbar`: that API
                        takes a flat `toolbarActions` array and can only render
                        icon buttons, so it has no way to express a separator or a
                        ToolbarButton. Styled to match `.table-toolbar` exactly, and
                        placed inside `.k8s-right` where Table's toolbar already sat,
                        so the pane still scrolls as one unit. */}
                    <div className="k8s-right-toolbar" role="toolbar">
                        <ToolbarIconButton icon={STUB_ICON} />
                        <ToolbarSeparator />
                        <ToolbarButton
                            showChevron
                            text={
                                <>
                                    <span className="k8s-toolbar-button-label">Namespaces:</span>
                                    {' default'}
                                </>
                            }
                        />
                    </div>
                    <Table
                        columns={TABLE_COLUMNS}
                        data={visiblePods}
                        selectedRowIndex={selectedIndex >= 0 ? selectedIndex : null}
                        onRowClick={(row) => {
                            setActivePane('table')
                            selectPod(row.id)
                        }}
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
