import type { ReactNode } from "react";
import { OverlayProvider } from "@gluestack-ui/core/overlay/creator";

// Use the app's existing theme and SafeAreaProvider; gluestack owns its overlays.
export function GluestackUIProvider({ children }: { children: ReactNode }) {
  return <OverlayProvider>{children}</OverlayProvider>;
}
