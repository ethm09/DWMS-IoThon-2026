import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import { useServiceWorker } from "@/hooks/use-service-worker.ts";
import AuthCallback from "./pages/auth/Callback.tsx";
import AppLayout from "./pages/layout.tsx";
import Landing from "./pages/landing/page.tsx";
import Dashboard from "./pages/dashboard/page.tsx";
import About from "./pages/about/page.tsx";
import Alerts from "./pages/alerts/page.tsx";
import AIDecision from "./pages/ai-decision/page.tsx";
import RemoteMonitoring from "./pages/remote-monitoring/page.tsx";
import HistoricalData from "./pages/historical/page.tsx";
import AdminPage from "./pages/admin/page.tsx";
import DeviceManager from "./pages/devices/page.tsx";
import ThresholdsPage from "./pages/thresholds/page.tsx";
import ActivityLog from "./pages/activity-log/page.tsx";
import NotificationsPage from "./pages/notifications/page.tsx";
import DataSource from "./pages/data-source/page.tsx";
import NotFound from "./pages/NotFound.tsx";

export default function App() {
  useServiceWorker();
  return (
    <BrowserRouter>
      <DefaultProviders>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          {(["demo", "live"] as const).map((workspace) => <Route key={workspace} path={`/${workspace}`} element={<AppLayout workspace={workspace} />}>
            <Route index element={<Dashboard />} />
            <Route path="trends" element={<HistoricalData />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="devices" element={<DeviceManager />} />
            <Route path="sites" element={<RemoteMonitoring />} />
            <Route path="assistant" element={<AIDecision />} />
            <Route path="rules" element={<ThresholdsPage />} />
            <Route path="about" element={<About />} />
            {workspace === "live" && <>
              <Route path="access" element={<AdminPage />} />
              <Route path="events" element={<ActivityLog />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="connection" element={<DataSource />} />
            </>}
          </Route>)}
          <Route path="/dashboard" element={<Navigate to="/demo" replace />} />
            <Route path="/analytics" element={<Navigate to="/historical" replace />} />
            <Route path="/simulation" element={<Navigate to="/demo" replace />} />
            <Route path="/alerts" element={<Navigate to="/demo/alerts" replace />} />
            <Route path="/ai-decision" element={<Navigate to="/live/assistant" replace />} />
            <Route path="/maintenance" element={<Navigate to="/remote-monitoring" replace />} />
            <Route path="/reports" element={<Navigate to="/historical" replace />} />
            <Route path="/digital-twin" element={<Navigate to="/remote-monitoring" replace />} />
            <Route path="/remote-monitoring" element={<Navigate to="/demo/sites" replace />} />
            <Route path="/historical" element={<Navigate to="/demo/trends" replace />} />
            <Route path="/admin" element={<Navigate to="/live/access" replace />} />
            <Route path="/devices" element={<Navigate to="/demo/devices" replace />} />
            <Route path="/thresholds" element={<Navigate to="/demo/rules" replace />} />
            <Route path="/activity-log" element={<Navigate to="/live/events" replace />} />
            <Route path="/notifications" element={<Navigate to="/live/notifications" replace />} />
            <Route path="/data-source" element={<Navigate to="/live/connection" replace />} />
            <Route path="/about" element={<Navigate to="/demo/about" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </DefaultProviders>
    </BrowserRouter>
  );
}
