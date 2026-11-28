import { AuthProvider } from "./auth.tsx";
import { ConvexProvider } from "./convex.tsx";
import { QueryClientProvider } from "./query-client.tsx";
import { ThemeProvider } from "./theme.tsx";
import { Toaster } from "../ui/sonner.tsx";
import { TooltipProvider } from "../ui/tooltip.tsx";
import { ProcessModeProvider } from "./process-mode.tsx";
import { DemoProvider } from "./demo.tsx";
import HardwareBridge from "../hardware-bridge.tsx";
import LiveWorkspaceRecovery from "../live-workspace-recovery";
import EthmAssistant from "../ethm-assistant";
import { useLocation } from "react-router-dom";

export function DefaultProviders({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <AuthProvider>
      <ConvexProvider>
        <QueryClientProvider>
          <TooltipProvider>
            <ThemeProvider>
              <ProcessModeProvider>
                <DemoProvider>
                  <Toaster />
                  <LiveWorkspaceRecovery>
                    {(pathname === "/live" || pathname.startsWith("/live/")) && <HardwareBridge />}
                    {children}
                    <EthmAssistant />
                  </LiveWorkspaceRecovery>
                </DemoProvider>
              </ProcessModeProvider>
            </ThemeProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ConvexProvider>
    </AuthProvider>
  );
}
