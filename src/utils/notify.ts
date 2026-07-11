import { Alert } from "react-native";

export function notify(title: string, message: string): void {
  Alert.alert(title, message);
}
