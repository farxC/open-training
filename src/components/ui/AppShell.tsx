import type { ReactNode } from "react";
import { View, useWindowDimensions } from "react-native";
import { router, usePathname } from "expo-router";
import { DesktopNavigation } from "./DesktopNavigation";
import colors from "@/theme/palette.json";

const navigation = [
  { page: "Histórico", icon: "view-day-outline" as const, href: "/" as const },
  { page: "Treino", icon: "dumbbell" as const, href: "/session/new" as const },
  {
    page: "Rotina",
    icon: "calendar-blank-outline" as const,
    href: "/routine" as const,
  },
  { page: "Evolução", icon: "chart-line" as const, href: "/profile" as const },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const desktop = width >= 960;
  const current = pathname.startsWith("/session/new")
    ? "Treino"
    : pathname.startsWith("/routine")
      ? "Rotina"
      : pathname.startsWith("/profile") || pathname.startsWith("/exercises")
        ? "Evolução"
        : pathname === "/settings"
          ? ""
          : "Histórico";

  return (
    <View
      style={{ flex: 1, flexDirection: "row", backgroundColor: colors.paper }}
    >
      {desktop && (
        <DesktopNavigation
          items={navigation}
          current={current}
          colors={colors}
          onCreate={() => router.push("/session/new")}
          onSettings={() => router.push("/settings")}
          onSelect={(page) => {
            const item = navigation.find((entry) => entry.page === page);
            if (item) router.navigate(item.href);
          }}
        />
      )}
      <View
        style={{
          flex: 1,
          minWidth: 0,
          paddingHorizontal: desktop ? 28 : 0,
          paddingVertical: desktop ? 22 : 0,
        }}
      >
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: 1140,
            alignSelf: "center",
          }}
        >
          {children}
        </View>
      </View>
    </View>
  );
}
