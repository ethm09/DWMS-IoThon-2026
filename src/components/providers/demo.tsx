import { useMemo, useReducer, type ReactNode } from "react";
import { DemoContext } from "@/hooks/use-demo";
import { demoReducer, initialDemoState } from "@/lib/demo-state";
import type { DemoScenario } from "@/lib/monitoring";

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoReducer, undefined, () => initialDemoState(new Date().toISOString()));
  const value = useMemo(() => ({
    state,
    applyScenario: (scenario: DemoScenario) => dispatch({ type: "scenario", scenario, timestamp: new Date().toISOString() }),
    acknowledgeRecovery: () => dispatch({ type: "acknowledge", timestamp: new Date().toISOString() }),
    resetDemo: () => dispatch({ type: "reset", timestamp: new Date().toISOString() }),
    setResponseMode: (mode: "auto" | "manual") => dispatch({ type: "mode", mode, timestamp: new Date().toISOString() }),
    setManualPump: (pumpOn: boolean) => dispatch({ type: "pump", pumpOn, timestamp: new Date().toISOString() }),
    triggerEmergency: () => dispatch({ type: "emergency", timestamp: new Date().toISOString() }),
  }), [state]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
