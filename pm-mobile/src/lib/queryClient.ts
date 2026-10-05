import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Do not retry client errors (auth, permission, validation, not found).
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

// React Native has no window focus events: refetch stale queries when the app returns to foreground.
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
}
AppState.addEventListener('change', onAppStateChange);

export const queryKeys = {
  workOrders: ['work-orders'] as const,
  workOrderList: (scope: string, filters: Record<string, unknown>) => ['work-orders', scope, filters] as const,
  workOrder: (id: number) => ['work-order', id] as const,
  executorUnits: ['executor-units', 'work_order'] as const,
  staff: (unitId: number) => ['executor-unit-staff', unitId] as const,
  notifications: ['notifications'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
  // Form Request & approvals
  requests: ['service-requests'] as const,
  requestList: (scope: string, filters: Record<string, unknown>) => ['service-requests', scope, filters] as const,
  request: (id: number) => ['service-request', id] as const,
  approvals: ['approvals'] as const,
  pendingApprovals: ['approvals', 'pending'] as const,
  pendingApprovalCount: ['approvals', 'pending-count'] as const,
  offices: ['offices'] as const,
  requestExecutorUnits: ['executor-units', 'request'] as const,
  mySuperior: ['my-superior'] as const,
};
