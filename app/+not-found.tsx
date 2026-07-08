import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not Found" }} />
      <View className="flex-1 bg-surface items-center justify-center p-6">
        <Text className="text-ink text-xl font-bold mb-2">Page not found</Text>
        <Link href="/" className="text-brand-500 mt-4">
          Go home
        </Link>
      </View>
    </>
  );
}
