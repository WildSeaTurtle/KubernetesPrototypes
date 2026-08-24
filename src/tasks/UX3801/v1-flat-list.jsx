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
    Checkbox,
    ValidationTooltip,
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

// The namespace an empty working set falls back to on close — kubectl's own
// default context, so "nothing chosen" resolves to the same scope the CLI would
// use rather than to an empty tree and table.
const DEFAULT_NAMESPACE = 'default'

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

// How the working set is named wherever it is summarised — the table toolbar's
// Namespaces button and the cluster tree node. Shared so the threshold lives in
// one place and the two readouts cannot disagree.
//
// Spelling out the whole set stops paying off past a few names (the toolbar
// button has `nowrap` text, so a long list widens the toolbar past the pane), so
// past the limit it names the first few and counts the rest — the names carry
// what the count alone couldn't, that this is a hand-picked set and which
// namespaces are in it. Order is selection order, so the first names shown are
// the first ones picked. "All Namespaces" and an empty deliberate selection are
// both real, reachable states (see NamespacePopup's radio-vs-checkbox note) and
// have to be named rather than rendered blank — though the tree node opts out of
// the empty case and drops its suffix instead.
const NAMESPACE_LIST_LIMIT = 3

function namespaceSummary(allSelected, selected) {
    if (allSelected) return 'All Namespaces'
    if (selected.length === 0) return 'None'
    const listed = selected.slice(0, NAMESPACE_LIST_LIMIT).join(', ')
    if (selected.length <= NAMESPACE_LIST_LIMIT) return listed
    return `${listed}, and ${selected.length - NAMESPACE_LIST_LIMIT} more`
}

// The Namespaces-popup designs under comparison, described as data rather
// than as a set of near-identical components: everything around the popup (tree,
// table, toolbar, context menus, favourites, drag handle) is the same, and
// stating the differences in one table is what makes them comparable at all.
//
//   control            'checkmark' — a tick only when selected, like a menu
//                      'checkbox'  — a real box on every row
//   separatorUnderAll  rule between the master row and the namespaces
//   indentRows         namespace rows shifted one level in, so their control
//                      starts where the master row's text starts
//   ticksFollowAll     whether rows show a tick while "All Namespaces" is on.
//                      Also drives selection: when they mirror it, unticking one
//                      row has to materialise the full set and drop just that
//                      one; when they don't, the master and the rows are
//                      mutually exclusive and a row click starts a fresh set.
//   allIsRadio         a second click on an already-selected master is a no-op,
//                      as a selected radio cannot be unchecked by clicking it
//   blockEmptyDismiss  refuse to close on an empty set, showing the validation
//                      message instead of silently applying "no namespaces"
//   defaultOnEmpty     the other answer to the same problem: closing on an empty
//                      set is allowed, and selects `default` on the way out. The
//                      two are alternatives, not layers — a variant that blocks
//                      the dismiss never reaches the fallback.
export const POPUP_VARIANTS = [
    {
        id: 'v1',
        label: 'Variant 1 — checkmarks',
        control: 'checkmark',
        separatorUnderAll: true,
        indentRows: false,
        ticksFollowAll: false,
        allIsRadio: true,
        blockEmptyDismiss: false,
        defaultOnEmpty: true,
    },
    {
        id: 'v2',
        label: 'Variant 2 — checkboxes, indented',
        control: 'checkbox',
        separatorUnderAll: false,
        indentRows: true,
        ticksFollowAll: true,
        allIsRadio: false,
        blockEmptyDismiss: true,
        defaultOnEmpty: false,
    },
    {
        id: 'v3',
        label: 'Variant 3 — checkboxes, aligned',
        control: 'checkbox',
        separatorUnderAll: true,
        indentRows: false,
        ticksFollowAll: false,
        allIsRadio: true,
        blockEmptyDismiss: false,
        defaultOnEmpty: true,
    },
    {
        // Variant 2's layout and selection model with Variant 1/3's answer to the
        // empty set: the pair differs in nothing but those two flags, so putting
        // them side by side isolates "block the exit" against "fall back to
        // `default`" without the indent/mirroring differences confounding it.
        id: 'v4',
        label: 'Variant 4 — checkboxes, indented, default fallback',
        control: 'checkbox',
        separatorUnderAll: false,
        indentRows: true,
        ticksFollowAll: true,
        allIsRadio: false,
        blockEmptyDismiss: false,
        defaultOnEmpty: true,
    },
]

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

    // The working set annotation on the cluster node. Built from the same
    // `namespaceSummary` helper as the toolbar button, so the threshold lives
    // in exactly one place and the two readouts can't disagree. The only
    // difference is the empty case: the node drops the suffix altogether rather
    // than spelling out "None".
    //
    // It goes through `secondaryText` rather than being baked into the label so
    // it renders in `.tree-node-secondary` — the same dimmed --text-secondary as
    // the `[namespace]` suffix on the pod rows. Matching by mechanism, not by a
    // second CSS rule that could drift from the pods'.
    const clusterNamespaces = !allNamespacesSelected && selectedNamespaces.length === 0
        ? undefined
        : `[${namespaceSummary(allNamespacesSelected, selectedNamespaces)}]`

    return [
        {
            id: 'cluster',
            label: 'staging-cluster',
            secondaryText: clusterNamespaces,
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
//   - All Namespaces checked, and every row below shows a tick too, because
//     everything really is in scope; tree/table show every pod. Note this is
//     display only — `selected` stays empty, which is what keeps the toolbar
//     button and the cluster node reading "All Namespaces" instead of spelling
//     out all nine names.
//   - All Namespaces unchecked, zero or more individual rows checked
//     (real checkbox toggling), tree/table show only those namespaces.
// Each namespace row carries a favourite star in the kit's right-hand
// `shortcut` slot: filled (`nodes/star`) when favourited and always visible,
// outline (`nodes/starEmpty`) only while the row is hovered. Clicking the star
// stops propagation so it toggles the favourite without also toggling the
// row's selection.
function NamespacePopup({ variant, rect, allSelected, selected, favorites, error, onToggle, onToggleAll, onToggleFavorite, onDismiss }) {
    const { delta, onDragHandleMouseDown } = useDraggable()

    // The selection control for one row. A checkbox is always rendered, so its
    // slot is never empty; a checkmark is absent when unselected, and the caller
    // falls back to `iconGap` to keep the column aligned.
    const renderControl = (checked, indeterminate = false) => {
        if (variant.control === 'checkbox') {
            return (
                <Checkbox
                    className="k8s-namespace-checkbox"
                    checked={checked}
                    indeterminate={indeterminate}
                />
            )
        }
        return checked || indeterminate ? <Icon name="general/checkmark" size={16} /> : undefined
    }

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
                className={`k8s-namespace-popup ${variant.indentRows ? 'k8s-namespace-popup-indented' : ''}`.trim()}
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
                {/* Raised only after a blocked dismiss, and it sits above the
                    popup rather than inside it so no row shifts when it
                    appears. */}
                {error && (
                    <ValidationTooltip
                        className="k8s-namespace-popup-validation"
                        text="Specify at least one namespace"
                    />
                )}
                <Popup visible style={{ position: 'static' }}>
                    {/* Master row. The indeterminate middle state belongs only to
                        the variants whose rows mirror the master: there a partial
                        selection really is "some of all". Where the master is
                        radio-exclusive against the rows it has no middle state —
                        either it is the selection or a subset is — so it simply
                        reads unchecked. */}
                    {(() => {
                        const partial = variant.ticksFollowAll && !allSelected && selected.length > 0
                        const control = renderControl(allSelected, partial)
                        return (
                            <PopupCell icon={control} iconGap={!control} onClick={onToggleAll}>
                                All Namespaces
                            </PopupCell>
                        )
                    })()}
                    {variant.separatorUnderAll && <PopupCell type="separator" />}
                    {orderedNamespaces.map((namespace) => {
                        const isSelected =
                            (variant.ticksFollowAll && allSelected) || selected.includes(namespace)
                        const isFavorite = favorites.includes(namespace)
                        const control = renderControl(isSelected)
                        return (
                            <PopupCell
                                key={namespace}
                                icon={control}
                                iconGap={!control}
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
                </Popup>
            </div>
        </PositionedPopup>
    )
}

function KubernetesServicesPanel({ variant, focused, onFocus, onActionClick, layoutMode, className }) {
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
    // Raised when the user tries to leave the popup with nothing selected. Only
    // ever set by a blocked dismiss, never by opening the popup.
    const [namespaceErrorRaised, setNamespaceErrorRaised] = useState(false)

    const visibleNamespaces = allNamespacesSelected ? ALL_NAMESPACE_IDS : selectedNamespaces
    const visiblePods = sortPods(PODS.filter((p) => visibleNamespaces.includes(p.namespace)))
    const selectedIndex = visiblePods.findIndex((p) => p.id === selectedPodId)

    function selectPod(podId) {
        setSelectedPodId(podId)
    }

    // An empty working set is a legal transient state inside the popup, but not
    // one the user can leave with — "no namespaces" would silently empty the tree
    // and the table. The variants answer that in one of two ways, per their
    // `blockEmptyDismiss` / `defaultOnEmpty` flags: refuse the dismiss and show
    // the validation message, or let it close and resolve to `default`.
    const namespaceSelectionEmpty = !allNamespacesSelected && selectedNamespaces.length === 0

    // While the popup is open, an empty set is mid-edit rather than an applied
    // state, so the button's value reads blank — "Namespaces:" and its chevron,
    // nothing between them. Naming it ("None") would announce a scope the user is
    // in the middle of replacing, and both exits from the empty state overwrite it
    // anyway. Closed-and-empty keeps `namespaceSummary`'s own wording: the guards
    // above make it unreachable for every current variant, not impossible for a
    // variant that sets neither flag.
    const namespaceValue = namespacePopupRect && namespaceSelectionEmpty
        ? ''
        : namespaceSummary(allNamespacesSelected, selectedNamespaces)

    function openNamespacePopup(event) {
        setNodeContextMenu(null)
        setNamespaceErrorRaised(false)
        setNamespacePopupRect({ x: event.clientX, y: event.clientY })
    }

    function dismissNamespacePopup() {
        if (variant.blockEmptyDismiss && namespaceSelectionEmpty) {
            setNamespaceErrorRaised(true)
            return
        }
        // The permissive answer to the same empty set: close, but commit
        // `default` rather than nothing. Applied on the way out, not while the
        // popup is open, so unticking the last row still reads as unticked for as
        // long as the user is looking at it — the fallback is what they get for
        // leaving, not a row that re-ticks itself under the pointer.
        if (variant.defaultOnEmpty && namespaceSelectionEmpty) {
            setSelectedNamespaces([DEFAULT_NAMESPACE])
        }
        setNamespaceErrorRaised(false)
        setNamespacePopupRect(null)
    }

    // The context menus anchor the popup at the pointer; the toolbar button
    // anchors it to itself, so the popup drops directly beneath the button
    // instead of wherever the click happened to land inside it.
    //
    // Horizontally it lines up with the button's *value* — the part after the
    // "Namespaces:" label — not with the button's box or its full text. So the
    // anchor is the value span's own rect, which also means the popup shifts
    // with the label's width instead of assuming a fixed offset. Vertically it
    // stays on the button's box, so the popup clears the whole control rather
    // than starting inside it.
    function openNamespacePopupFromToolbar(event) {
        const button = event.currentTarget
        const buttonRect = button.getBoundingClientRect()
        const valueRect = (button.querySelector('.k8s-toolbar-button-value') ?? button).getBoundingClientRect()
        setNamespaceErrorRaised(false)
        setNamespacePopupRect({
            top: buttonRect.top,
            bottom: buttonRect.bottom,
            left: valueRect.left,
            right: valueRect.right,
        })
    }

    function toggleNamespace(namespace) {
        // Variants whose rows do not mirror the master: the two are mutually
        // exclusive, so picking a row drops out of "All Namespaces" and starts a
        // fresh working set.
        if (!variant.ticksFollowAll) {
            setAllNamespacesSelected(false)
            setSelectedNamespaces((current) =>
                current.includes(namespace)
                    ? current.filter((ns) => ns !== namespace)
                    : [...current, namespace]
            )
            return
        }

        // Variants whose rows do mirror the master: every row shows a tick while
        // "All Namespaces" is on, yet `selectedNamespaces` is empty, so the full
        // set has to be materialised before toggling. Without that, unticking one
        // row would silently drop all the others.
        const base = allNamespacesSelected ? ALL_NAMESPACE_IDS : selectedNamespaces
        const next = base.includes(namespace)
            ? base.filter((ns) => ns !== namespace)
            : [...base, namespace]

        // And the reverse: ticking the last missing row means the same thing as
        // "All Namespaces", so collapse back to that flag rather than leaving the
        // master, the toolbar button and the cluster node reading "9 namespaces"
        // with every row ticked.
        const coversEverything = next.length === ALL_NAMESPACE_IDS.length
        setAllNamespacesSelected(coversEverything)
        setSelectedNamespaces(coversEverything ? [] : next)
    }

    function toggleAllNamespaces() {
        // Radio semantics: a second click on an already-selected master does
        // nothing, the way a selected radio cannot be unchecked by clicking it.
        if (variant.allIsRadio && allNamespacesSelected) return
        // Otherwise it is a plain toggle, and turning it off clears the working
        // set — landing on the empty state `dismissNamespacePopup` refuses to
        // leave in the variant that guards it.
        setAllNamespacesSelected(!allNamespacesSelected)
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
                            variant={variant}
                            rect={namespacePopupRect}
                            allSelected={allNamespacesSelected}
                            selected={selectedNamespaces}
                            favorites={favoriteNamespaces}
                            // Conjunction, not just the flag: selecting anything
                            // clears the message on its own, so the flag can
                            // never go stale.
                            error={variant.blockEmptyDismiss && namespaceErrorRaised && namespaceSelectionEmpty}
                            onToggle={toggleNamespace}
                            onToggleAll={toggleAllNamespaces}
                            onToggleFavorite={toggleFavoriteNamespace}
                            onDismiss={dismissNamespacePopup}
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
                            onClick={openNamespacePopupFromToolbar}
                            text={
                                <>
                                    <span className="k8s-toolbar-button-label">Namespaces:</span>
                                    {' '}
                                    {/* Own span so the popup can be anchored to
                                        where the value starts — a bare text node
                                        has no box to measure. The separating space
                                        stays outside it, so its left edge is the
                                        first glyph of the value. */}
                                    <span className="k8s-toolbar-button-value">{namespaceValue}</span>
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

// `variant` selects which Namespaces-popup design to render — see
// POPUP_VARIANTS. Everything else is identical across the variants, which is
// what makes switching between them a fair comparison.
export default function UX3801FlatListPrototype({ variant = POPUP_VARIANTS[0] }) {
    return (
        <MainWindow
            height="100%"
            className="k8s-ide-stage"
            defaultOpenToolWindows={['services']}
            initialBottomPanelHeight={500}
            bottomPanelContent={(id, ctx) =>
                id === 'services' ? (
                    <KubernetesServicesPanel
                        variant={variant}
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
