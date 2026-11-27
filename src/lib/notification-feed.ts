/** Account feed visibility only. Never deletes events or changes safety decisions. */
export type NotificationLevel = "critical" | "warning" | "info";
export type NotificationCategory = "threshold" | "device" | "system" | "maintenance";
export type FeedPreferences = {
  enableCritical: boolean;
  enableWarning: boolean;
  enableInfo: boolean;
  enableThreshold: boolean;
  enableDevice: boolean;
  enableSystem: boolean;
  enableMaintenance: boolean;
};

export function filterNotificationFeed<T extends { level: NotificationLevel; category: NotificationCategory }>(
  records: readonly T[], preferences: FeedPreferences,
  level: NotificationLevel | "all", category: NotificationCategory | "all",
): T[] {
  const levels = { critical: preferences.enableCritical, warning: preferences.enableWarning, info: preferences.enableInfo };
  const categories = { threshold: preferences.enableThreshold, device: preferences.enableDevice, system: preferences.enableSystem, maintenance: preferences.enableMaintenance };
  return records.filter(record => levels[record.level] && categories[record.category]
    && (level === "all" || record.level === level)
    && (category === "all" || record.category === category));
}
