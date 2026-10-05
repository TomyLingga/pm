import { Alert, Platform, ToastAndroid } from 'react-native';

/** Short, non-blocking confirmation message. */
export function toast(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert(message);
  }
}
