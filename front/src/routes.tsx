import type { RouteObject } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { NotFoundPage } from './components/NotFoundPage';
import { LoginPage } from './features/auth/LoginPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { RequireRole } from './features/auth/RequireRole';
import { SessionExpiryListener } from './features/auth/SessionExpiryListener';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { NewRequestPage } from './features/requests/NewRequestPage';
import { RequestDetailPage } from './features/requests/RequestDetailPage';
import { RequestListPage } from './features/requests/RequestListPage';

export const routes: RouteObject[] = [
  {
    element: <SessionExpiryListener />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/', element: <DashboardPage /> },
              { path: '/requests', element: <RequestListPage /> },
              {
                path: '/requests/new',
                element: (
                  <RequireRole role="REQUESTER">
                    <NewRequestPage />
                  </RequireRole>
                ),
              },
              { path: '/requests/:id', element: <RequestDetailPage /> },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
];
