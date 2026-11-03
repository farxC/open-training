# UI components

Gluestack behavior primitives use `@gluestack-ui/core` 3.x and
`@gluestack-ui/utils` 3.x with NativeWind 4 / Tailwind 3.
Components are composed locally following gluestack's copy-in model.
Expo 52 and React 18 are preserved.

`AppShell` provides the animated desktop navigation. Mobile uses the existing
Expo Router tabs. `ActionButton`, `IconButton` and `FilterChip` are shared
controls. `GluestackUIProvider` is mounted within the existing SafeAreaProvider
and does not override the system color scheme.

`src/theme/palette.json` is the shared palette for React Native components and
Tailwind. Carmine is for actions/selection; slate blue for charts; gold for
records; green for progress. Fonts are bundled locally through expo-font.

The former `/ui-prototype` bookmark redirects to the implemented application.

Documentation: https://v4.gluestack.io/ui/docs/components/button
