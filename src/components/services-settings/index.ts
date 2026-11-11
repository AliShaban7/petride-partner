/**
 * Shared pieces of the Services & Settings page group (not part of the design system):
 * draft / dirty-state helpers, the sticky save bar, callouts, the app preview frame and the
 * mock "extras" store for fields the PartnerApi doesn't cover yet.
 */
export { AppPreviewFrame } from "./AppPreviewFrame";
export { controlClass, EMAIL_RE, isClock, normalizeAzPhone, parsePrice, parseWhole, priceInputText, toMinutes, type PriceParse } from "./controls";
export {
  EXTRAS_TAG,
  extrasApi,
  type DeviceSession,
  type HoursBreak,
  type HoursException,
  type NotificationChannels,
  type NotificationEvent,
  type NotificationPrefs,
  type PartnerExtras,
  type ProfileExtrasPatch,
  type TeamMember,
  type TeamRole,
} from "./extras";
export { Notice, type NoticeTone } from "./Notice";
export { SaveBar, type SaveBarProps } from "./SaveBar";
export { deepEqual, useDraft, useUnsavedGuard, type Draft } from "./useDraft";
export { useExtras, useExtrasMutation } from "./useExtras";
export {
  WEEKDAYS,
  buildWeek,
  dayRangeLabel,
  groupWeek,
  hoursOn,
  isoWeekday,
  localDateKey,
  openState,
  type DayHours,
  type HoursGroup,
  type OpenState,
} from "./hours";
export { useMinuteNow } from "./useMinuteNow";
