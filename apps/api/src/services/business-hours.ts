import { Workspace } from "@prisma/client";

export interface BusinessHoursConfig {
  timezone: string;
  schedule: Record<
    string,
    { isOpen: boolean; openTime: string; closeTime: string }
  >; // e.g., "monday": { isOpen: true, openTime: "09:00", closeTime: "17:00" }
}

export function isWithinBusinessHours(
  workspace: Workspace,
  currentTime = new Date()
): boolean {
  if (!workspace.businessHours) {
    // If no config, assume always open
    return true;
  }

  const config = workspace.businessHours as unknown as BusinessHoursConfig;
  
  // Use formatting based on workspace timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone || "UTC",
    weekday: "long",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(currentTime);
  const weekdayObj = parts.find((p) => p.type === "weekday");
  const hourObj = parts.find((p) => p.type === "hour");
  const minuteObj = parts.find((p) => p.type === "minute");

  if (!weekdayObj || !hourObj || !minuteObj) return true;

  const currentDay = weekdayObj.value.toLowerCase();
  const currentHour = parseInt(hourObj.value, 10);
  const currentMinute = parseInt(minuteObj.value, 10);
  const currentMinutesFromMidnight = currentHour * 60 + currentMinute;

  const dayConfig = config.schedule[currentDay];
  if (!dayConfig || !dayConfig.isOpen) {
    return false;
  }

  const parseTime = (timeStr: string) => {
    const parts = timeStr.split(":");
    const h = Number(parts[0] || 0);
    const m = Number(parts[1] || 0);
    return h * 60 + m;
  };

  const openTime = parseTime(dayConfig.openTime);
  const closeTime = parseTime(dayConfig.closeTime);

  return currentMinutesFromMidnight >= openTime && currentMinutesFromMidnight <= closeTime;
}
