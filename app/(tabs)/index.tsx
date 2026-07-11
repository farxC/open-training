import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { SessionCard } from "@/components/SessionCard";
import { useSessions } from "@/hooks/useSessions";
import type { SessionSummary } from "@/types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function FeedScreen() {
  const { sessions, refresh } = useSessions();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top"]}>
      {/* Header */}
      <View className="px-4 pt-3 pb-4">
        <Text style={{ color: '#928d80', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 2 }}>
          {DAY_NAMES[new Date().getDay()].toUpperCase()}
        </Text>
        <View className="flex-row items-center">
          <View className="flex-1">
            <Text className="text-ink font-display font-semibold text-3xl" style={{ letterSpacing: -0.6 }}>Open Training Project</Text>
            <Text className="text-ink-mute text-xs mt-0.5">
              {sessions.length > 0
                ? `${sessions.length} session${sessions.length !== 1 ? "s" : ""} logged`
                : "No sessions yet"}
            </Text>
          </View>
          <TouchableOpacity
            className="w-10 h-10 rounded-full items-center justify-center"
            onPress={() => router.push("/settings")}
            style={{ marginRight: 8 }}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="cog-outline" size={22} color="#5c594f" />
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-ink w-11 h-11 rounded-full items-center justify-center"
            onPress={() => router.push("/session/new")}
            style={{
              shadowColor: '#26241f',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '300', lineHeight: 28, marginTop: -1 }}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: '#ddd8ce', marginHorizontal: 16, marginBottom: 8 }} />

      <FlatList<SessionSummary>
        data={sessions}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <SessionCard
            session={item}
            onPress={() => router.push(`/session/${item.id}`)}
          />
        )}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center" style={{ paddingTop: 80 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#ebe7df', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 22 }}>🏋️</Text>
            </View>
            <Text className="text-ink-soft text-base font-medium">No sessions yet</Text>
            <Text className="text-ink-mute text-sm mt-1">Tap + to log your first workout</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
