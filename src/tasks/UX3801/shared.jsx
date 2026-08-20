// Sample data for UX-3801 prototypes — mirrors the Figma reference's own
// sample set (payments, users, messaging, monitoring, ingress-nginx; 10 pods,
// one seeded failure, one seeded warning). Shared between tree-grouping
// variants (v1 flat list, a future v2 grouped tree) so both stay consistent.

export const NAMESPACES = ['payments', 'users', 'messaging', 'monitoring', 'ingress-nginx']

export const STATUS_ORDER = { failed: 0, warning: 1, running: 2 }

export const STATUS_ICON = {
    failed: 'status/error',
    warning: 'status/warning',
    running: 'general/greenCheckmark',
}

export const PODS = [
    {
        id: 'payment-api-2xkqr',
        name: 'payment-api-7f4c8d6d9b-2xkqr',
        namespace: 'payments',
        status: 'running',
        statusText: 'Running',
        labels: 'app: payment-api, tier: backend',
        node: 'gke-staging-node-1',
        restarts: 0,
        age: '6 hours',
        container: 'payment-api',
    },
    {
        id: 'payment-api-jm8wt',
        name: 'payment-api-7f4c8d6d9b-jm8wt',
        namespace: 'payments',
        status: 'running',
        statusText: 'Running',
        labels: 'app: payment-api, tier: backend',
        node: 'gke-staging-node-2',
        restarts: 0,
        age: '6 hours',
        container: 'payment-api',
    },
    {
        id: 'payment-worker-k8lmn',
        name: 'payment-worker-5f6c7b8d9f-k8lmn',
        namespace: 'payments',
        status: 'failed',
        statusText: 'Failed. ContainerCreateError',
        labels: 'app: payment-worker, tier: backend',
        node: 'gke-staging-node-1',
        restarts: 0,
        age: '6 hours',
        container: 'payment-worker',
    },
    {
        id: 'user-api-abc12',
        name: 'user-api-6df78d8cf7-abc12',
        namespace: 'users',
        status: 'running',
        statusText: 'Running',
        labels: 'app: user-api, tier: backend',
        node: 'gke-staging-node-2',
        restarts: 0,
        age: '6 hours',
        container: 'user-api',
    },
    {
        id: 'user-api-def34',
        name: 'user-api-6df78d8cf7-def34',
        namespace: 'users',
        status: 'warning',
        statusText: 'Running. 1/5 containers failed',
        labels: 'app: user-api, tier: backend',
        node: 'gke-staging-node-1',
        restarts: 0,
        age: '6 hours',
        container: 'user-api',
    },
    {
        id: 'kafka-0',
        name: 'kafka-0',
        namespace: 'messaging',
        status: 'running',
        statusText: 'Running',
        labels: 'app: kafka, tier: messaging',
        node: 'gke-staging-node-2',
        restarts: 0,
        age: '6 hours',
        container: 'kafka',
    },
    {
        id: 'kafka-1',
        name: 'kafka-1',
        namespace: 'messaging',
        status: 'running',
        statusText: 'Running',
        labels: 'app: kafka, tier: messaging',
        node: 'gke-staging-node-1',
        restarts: 0,
        age: '6 hours',
        container: 'kafka',
    },
    {
        id: 'prometheus-0',
        name: 'prometheus-0',
        namespace: 'monitoring',
        status: 'running',
        statusText: 'Running',
        labels: 'app: prometheus, tier: monitoring',
        node: 'gke-staging-node-2',
        restarts: 0,
        age: '6 hours',
        container: 'prometheus',
    },
    {
        id: 'grafana-x7mnp',
        name: 'grafana-5d8f6f9c7b-x7mnp',
        namespace: 'monitoring',
        status: 'running',
        statusText: 'Running',
        labels: 'app: grafana, tier: monitoring',
        node: 'gke-staging-node-1',
        restarts: 0,
        age: '6 hours',
        container: 'grafana',
    },
    {
        id: 'ingress-nginx-lmno1',
        name: 'ingress-nginx-controller-7bc4d5c6f8-lmno1',
        namespace: 'ingress-nginx',
        status: 'running',
        statusText: 'Running',
        labels: 'app: ingress-nginx, tier: network',
        node: 'gke-staging-node-2',
        restarts: 0,
        age: '6 hours',
        container: 'controller',
    },
]

const POD_LOGS = {
    'payment-worker-k8lmn': [
        { level: 'info', text: 'Pulling image "registry.internal/payments/payment-worker:1.4.2"' },
        { level: 'error', text: 'Failed to pull image: rpc error: code = NotFound desc = manifest unknown' },
        { level: 'error', text: 'ContainerCreateError: failed to create containerd task: failed to create shim' },
        { level: 'warn', text: 'Back-off restarting failed container' },
    ],
    'user-api-def34': [
        { level: 'info', text: 'Started container user-api' },
        { level: 'warn', text: 'Sidecar container "envoy-proxy" exited with code 1' },
        { level: 'error', text: 'connect: connection refused — upstream messaging/kafka:9092 unreachable' },
        { level: 'info', text: 'Retrying connection to kafka in 5s…' },
    ],
}

const DEFAULT_LOGS = [
    { level: 'info', text: 'Started container' },
    { level: 'info', text: 'Readiness probe succeeded' },
]

export function podLogs(podId) {
    return POD_LOGS[podId] ?? DEFAULT_LOGS
}

export function sortPods(pods) {
    return [...pods].sort((a, b) => {
        const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
        if (byStatus !== 0) return byStatus
        return a.name.localeCompare(b.name)
    })
}

export function sortPodsByNamespace(pods) {
    return [...pods].sort((a, b) => {
        const byNamespace = a.namespace.localeCompare(b.namespace)
        if (byNamespace !== 0) return byNamespace
        return a.name.localeCompare(b.name)
    })
}
