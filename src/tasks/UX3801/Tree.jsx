import { useState } from 'react';
import TreeNode from './TreeNode';
import './Tree.css';

// Detached from @jetbrains/int-ui-kit's Tree to support `forceExpandable` —
// a node that shows a collapse/expand chevron even with no children yet
// (e.g. a resource category with nothing populated in this static mock).
// The kit's own Tree only shows a chevron when `children.length > 0`.
// ui-contract-allow kit-component-collision -- intentional detach (see above), keeps the kit's own name per the detach-pattern convention.
function Tree({ data = [], defaultSelectedId, onNodeSelect, onNodeToggle, onNodeContextMenu, flat = false, className = '', style, ...rest }) {
    const [selectedNodeId, setSelectedNodeId] = useState(defaultSelectedId || null);

    const renderTreeNodes = (nodes, level = 1) => {
        return nodes.map((node, index) => {
            const nodeId = node.id || `${level}-${index}`;
            const hasRealChildren = node.children && node.children.length > 0;
            return (
                <TreeNode
                    key={nodeId}
                    label={node.label}
                    icon={node.icon}
                    secondaryText={node.secondaryText}
                    level={level}
                    hasChildren={hasRealChildren || !!node.forceExpandable}
                    isExpanded={node.isExpanded}
                    isSelected={selectedNodeId === nodeId}
                    flat={flat}
                    onToggle={(expanded) => {
                        if (onNodeToggle) {
                            onNodeToggle(nodeId, expanded);
                        }
                    }}
                    onSelect={(selected) => {
                        if (selected) {
                            setSelectedNodeId(nodeId);
                        } else {
                            setSelectedNodeId(null);
                        }
                        if (onNodeSelect) {
                            onNodeSelect(nodeId, selected);
                        }
                    }}
                    onContextMenu={(event) => {
                        if (onNodeContextMenu) {
                            onNodeContextMenu(nodeId, event);
                        }
                    }}
                >
                    {hasRealChildren &&
                        renderTreeNodes(node.children, level + 1)
                    }
                </TreeNode>
            );
        });
    };

    return (
        <div className={`tree ${className}`.trim()} style={style} {...rest}>
            {renderTreeNodes(data)}
        </div>
    );
}

export default Tree;
