import { createContext, useContext } from "react";
import type { DemoState } from "@/lib/demo-state";
import type { DemoScenario } from "@/lib/monitoring";

export type DemoContextValue = {
  state: DemoState;
  applyScenario: (scenario: DemoScenario) => void;
  acknowledgeRecovery: () => void;
  resetDemo: () => void;
  setResponseMode: (mode: "auto" | "manual") => void;
  setManualPump: (pumpOn: boolean) => void;
  triggerEmergency: () => void;
};
export const DemoContext = createContext<DemoContextValue | null>(null);
export function useDemo(): DemoContextValue {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo must be used within DemoProvider");
  return value;
}
