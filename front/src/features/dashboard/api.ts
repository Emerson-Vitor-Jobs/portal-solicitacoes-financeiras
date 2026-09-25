import { api, unwrap } from '../../api/client';

export const dashboardQueryKey = ['dashboard'] as const;

export function fetchSummary() {
  return unwrap(api.GET('/api/dashboard/summary'));
}
