import type { TreeNodeData } from '@jetbrains/int-ui-kit';

/**
 * Kubernetes node for the Services tool window.
 *
 * PLACEHOLDER: структура повторяет дерево плагина Kubernetes в IntelliJ
 * (cluster → namespace → категории ресурсов). Содержимое будет заменено
 * на выгрузку из Figma "Connection to several Namespaces" (node 111-263).
 */

const resourceGroups = (ns: string): TreeNodeData[] => [
  {
    id: `${ns}-workloads`,
    label: 'Workloads',
    icon: 'nodes/folder',
    children: [
      { id: `${ns}-deployments`, label: 'Deployments', icon: 'nodes/folder' },
      { id: `${ns}-statefulsets`, label: 'Stateful Sets', icon: 'nodes/folder' },
      { id: `${ns}-daemonsets`, label: 'Daemon Sets', icon: 'nodes/folder' },
      { id: `${ns}-replicasets`, label: 'Replica Sets', icon: 'nodes/folder' },
      { id: `${ns}-pods`, label: 'Pods', icon: 'nodes/folder' },
      { id: `${ns}-jobs`, label: 'Jobs', icon: 'nodes/folder' },
      { id: `${ns}-cronjobs`, label: 'Cron Jobs', icon: 'nodes/folder' },
    ],
  },
  { id: `${ns}-network`, label: 'Network', icon: 'nodes/folder' },
  { id: `${ns}-configuration`, label: 'Configuration', icon: 'nodes/folder' },
  { id: `${ns}-storage`, label: 'Storage', icon: 'nodes/folder' },
  { id: `${ns}-events`, label: 'Events', icon: 'nodes/folder' },
];

const namespace = (id: string, label: string, isExpanded = false): TreeNodeData => ({
  id,
  label,
  icon: 'aqua/wi/locators/name',
  isExpanded,
  children: resourceGroups(id),
});

export const KUBERNETES_TREE_NODE: TreeNodeData = {
  id: 'kubernetes',
  label: 'Kubernetes',
  icon: 'toolwindows/toolWindowKubernetes',
  isExpanded: true,
  children: [
    {
      id: 'k8s-cluster-prod',
      label: 'production-cluster',
      icon: 'nodes/services',
      secondaryText: 'gke_prod_europe-west4',
      isExpanded: true,
      children: [
        namespace('k8s-ns-default', 'default', true),
        namespace('k8s-ns-monitoring', 'monitoring'),
        namespace('k8s-ns-kube-system', 'kube-system'),
      ],
    },
    {
      id: 'k8s-cluster-minikube',
      label: 'minikube',
      icon: 'nodes/services',
      secondaryText: 'local',
      children: [namespace('k8s-ns-minikube-default', 'default')],
    },
  ],
};
