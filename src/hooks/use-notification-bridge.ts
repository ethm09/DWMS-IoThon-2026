import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { useProcessMode } from "@/hooks/use-process-mode.ts";
import { useAuth } from "@/hooks/use-auth.ts";
import type { SafetyLevel } from "@/lib/dwms-safety.ts";

/**
 * Bridges the local process-mode safety engine with the database-persisted
 * notification system. When the system decision quality changes to warning
 * or critical, a notification is automatically created for the current user.
 *
 * Safe to call at any auth state — silently no-ops when unauthenticated.
 */
export function useNotificationBridge() {
  const { user } = useAuth();
  const { decision, quality, mode } = useProcessMode();
  const createNotification = useMutation(api.notifications.create);
  const lastLevel = useRef<SafetyLevel>("safe");
  const lastEmergency = useRef(false);

  useEffect(() => {
    // Skip if not authenticated
    if (!user) return;

    // Only fire notifications on transitions (not continuously)
    if (quality === lastLevel.current && (mode === "emergency") === lastEmergency.current) {
      return;
    }

    const prevLevel = lastLevel.current;
    const prevEmergency = lastEmergency.current;
    lastLevel.current = quality;
    lastEmergency.current = mode === "emergency";

    // Transition to emergency
    if (mode === "emergency" && !prevEmergency) {
      createNotification({
        level: "critical",
        category: "system",
        title: "EMERGENCY SHUTDOWN",
        message: `${decision.parameter}: ${decision.reason}`,
        parameter: decision.parameter,
      });
      return;
    }

    // Transition to critical
    if (quality === "critical" && prevLevel !== "critical") {
      createNotification({
        level: "critical",
        category: "threshold",
        title: `CRITICAL: ${decision.parameter}`,
        message: decision.reason,
        parameter: decision.parameter,
      });
      return;
    }

    // Transition to warning
    if (quality === "warning" && prevLevel === "safe") {
      createNotification({
        level: "warning",
        category: "threshold",
        title: `WARNING: ${decision.parameter}`,
        message: decision.reason,
        parameter: decision.parameter,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, mode, user]);
}
