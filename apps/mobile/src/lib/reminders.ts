import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/** expo-notifications runs on Android and iOS only; the web build hides the setting. */
export const REMINDERS_SUPPORTED = Platform.OS !== "web";

export type ReminderTime = { hour: number; minute: number };
const KEY = "daily-reminder";
const CHANNEL = "reminders";

if (REMINDERS_SUPPORTED) {
  // Show the reminder even if it fires while the app is open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export async function getReminder(): Promise<ReminderTime | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v ? (JSON.parse(v) as ReminderTime) : null;
  } catch {
    return null;
  }
}

/** Schedule one local reminder a day at `time`, or turn it off with null. Resolves false if notifications are not allowed. */
export async function setReminder(time: ReminderTime | null): Promise<boolean> {
  // The app schedules nothing else, so clearing everything clears the old reminder.
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!time) {
    await AsyncStorage.removeItem(KEY);
    return true;
  }
  // Android 13+ shows the permission prompt only once a channel exists.
  if (Platform.OS === "android") {
    // eslint-disable-next-line import/namespace -- AndroidImportance is re-exported via `export *` from a .types file, which this rule can't follow
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: "Daily practice reminder", importance: Notifications.AndroidImportance.DEFAULT });
  }
  let { granted } = await Notifications.getPermissionsAsync();
  if (!granted) ({ granted } = await Notifications.requestPermissionsAsync());
  if (!granted) return false;

  await Notifications.scheduleNotificationAsync({
    content: { title: "Time to practise English", body: "A few minutes today keeps your streak going." },
    // A daily trigger is Android-only; iOS repeats a calendar trigger instead.
    trigger: Platform.OS === "android"
      ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: time.hour, minute: time.minute, channelId: CHANNEL }
      : { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, hour: time.hour, minute: time.minute, repeats: true },
  });
  await AsyncStorage.setItem(KEY, JSON.stringify(time));
  return true;
}
