import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import { useServiceWorker } from "@/hooks/use-service-worker.ts";
import AuthCallback from "./pages/auth/Callback.tsx";
import AppLayout from "./pages/layout.tsx";
import Dashboard from "./pages/dashboard/page.tsx";
import Analytics from "./pages/analytics/page.tsx";
import About from "./pages/about/page.tsx";
import Simulation from "./pages/simulation/page.tsx";
import Alerts from "./pages/alerts/page.tsx";
import AIDecision from "./pages/ai-decision/page.tsx";
import Maintenance from "./pages/maintenance/page.tsx";
import Reports from "./pages/reports/page.tsx";
import DigitalTwin from "./pages/digital-twin/page.tsx";
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
    <DefaultProviders>
      <BrowserRouter>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/simulation" element={<Simulation />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/ai-decision" element={<AIDecision />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/digital-twin" element={<DigitalTwin />} />
            <Route path="/remote-monitoring" element={<RemoteMonitoring />} />
            <Route path="/historical" element={<HistoricalData />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/devices" element={<DeviceManager />} />
            <Route path="/thresholds" element={<ThresholdsPage />} />
            <Route path="/activity-log" element={<ActivityLog />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/data-source" element={<DataSource />} />
            <Route path="/about" element={<About />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </DefaultProviders>
  );
}
