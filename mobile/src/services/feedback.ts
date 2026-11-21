import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import type { AnalysisResult } from '../types/api';

// A short vibration that matches the result, so the user feels a warning before reading it.
// Haptics are a nice extra: if the phone can't do them, nothing happens.
export function resultFeedback(result: AnalysisResult) {
  if (Platform.OS === 'web') return;
  let type = Haptics.NotificationFeedbackType.Success;
  if (result.status === 'CHECK_UNAVAILABLE' || result.concern_level === 'CAUTION') type = Haptics.NotificationFeedbackType.Warning;
  if (result.concern_level === 'HIGH_CONCERN') type = Haptics.NotificationFeedbackType.Error;
  Haptics.notificationAsync(type).catch(() => {});
}

export function tapFeedback() {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}
