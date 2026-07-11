# Unified In-App Modal for Confirm/Alert Actions — Design

**Date:** 2026-07-11
**Status:** Approved (pending spec review)

## Context

Confirm and alert-style messages today are split across two separate, inconsistent implementations:

- `src/utils/confirm.ts` — `confirmAction(title, message, confirmLabel, onConfirm)` and `notify(title, message)`. On native it calls `Alert.alert`; on web it falls back to `window.confirm`/`window.alert`, because `Alert.alert` is a no-op on react-native-web.
- `src/utils/notify.ts` (native) / `src/utils/notify.web.ts` (web) — a second, simpler `notify(title, message)` used only by `app/settings.tsx`, resolved per-platform via Metro's `.web.ts` file convention.

Call sites (all destructive-confirm or info-only, no other variants):

| File | Calls |
|---|---|
| `app/routine/program/[id].tsx` | `confirmAction` ×2, `notify` ×1 |
| `app/routine/[id].tsx` | `confirmAction` ×2 |
| `app/session/new.tsx` | `confirmAction` ×1, `notify` ×1 |
| `app/session/[id].tsx` | `confirmAction` ×1 |
| `app/settings.tsx` | `notify` ×3 (imports from `@/utils/notify`, not `@/utils/confirm`) |

The app already has a rich `Modal`-based UI language (`SessionFinishModal`, `DatePickerModal`, `ExercisePickerModal`, `DayDetailModal`, …) but all of them are full-screen `pageSheet`/slide-from-bottom presentations for data entry. There is no lightweight centered dialog pattern today — confirm/alert actions instead lean on OS-native `Alert`/`window.confirm`, which look inconsistent across platforms and can't be styled to match the app's editorial visual language (Fraunces/Hanken Grotesk, warm ink/surface/brand palette).

## Decision

Replace both existing implementations with a single component, `src/components/AppModal.tsx`, exposing:

- **`<AppModalHost />`** — mounted once in `app/_layout.tsx`. The only place that actually renders RN's `Modal`.
- **`confirmAction(title: string, message: string, confirmLabel: string, onConfirm: () => void): void`** — same signature as today.
- **`notify(title: string, message: string): void`** — same signature as today.

Both functions stay plain, imperative, callable from anywhere (event handlers, no hook needed) — this is a drop-in swap of the rendering engine, not an API redesign.

### Why a component, not per-platform utils

RN's `Modal` is a real component (works via react-native-web), unlike `Alert.alert`/`window.confirm`, which are incompatible native APIs requiring the platform-branching fallback in `confirm.ts` today. Rendering our own dialog inside `Modal` removes the need for that branch entirely, and gives full styling control that neither `Alert.alert` nor `window.confirm` allow.

### Store shape

A module-level store (state object + subscriber list, read via `useSyncExternalStore`) holds at most one pending dialog request:

```ts
type AppModalRequest = {
  title: string;
  message: string;
  actions: Array<{
    label: string;
    variant: "cancel" | "destructive" | "neutral";
    onPress?: () => void;
  }>;
} | null;
```

`confirmAction` sets `{ title, message, actions: [{ label: "Cancelar", variant: "cancel" }, { label: confirmLabel, variant: "destructive", onPress: onConfirm }] }`.

`notify` sets `{ title, message, actions: [{ label: "OK", variant: "neutral" }] }`.

`AppModalHost` subscribes to the store and renders `null` (no `Modal` mounted) when the request is `null`, or the dialog when set. Calling either function while a dialog is already visible replaces the current request (no queue — no call site today fires two in succession).

Pressing any action: hide the dialog first (set store back to `null`), then invoke that action's `onPress` (if any) on the next tick, so `onConfirm` doesn't run concurrently with the modal's own unmount/close.

## Visual Design

Centered card dialog, not a sheet:

- **Overlay:** `rgba(0,0,0,0.5)`, fades in/out with the modal.
- **Card:** `bg-surface-card`, `rounded-2xl`, max-width ~340, padding 24, pronounced shadow. Centered in the viewport (flex center), independent of safe-area insets (small enough to never conflict with them).
- **Title:** `font-display` (Fraunces), semibold, `text-xl`, `text-ink`.
- **Message:** `text-ink-soft`, `text-sm`, comfortable line-height.
- **Actions:** row, right-aligned, `gap-3`.
  - `cancel` variant: ghost/outline — `border border-surface-border`, `text-ink-soft`, transparent fill.
  - `destructive` variant: filled `accent-red` background, white text — used for the confirm button of every `confirmAction` today (all current uses are deletions).
  - `neutral` variant: filled `brand-500` background, white text — used for `notify`'s single "OK" button, matching the primary-button style already used in `SessionFinishModal`.
- **Motion:** overlay fades; the card animates in with a spring scale (0.92 → 1) + fade using RN's built-in `Animated` API (no new dependency). Exit is the reverse, faster. This spring "pop" is the distinctive signature — it reads as a quick, contained action rather than a navigational transition, in contrast to the slide-from-bottom sheets used elsewhere.
- **Android back button (`onRequestClose`):** treated as pressing the `cancel` action (or the single `neutral` action for `notify`) — never leaves the dialog stuck with no way out.
- **Backdrop tap:** does nothing (decided against dismiss-on-backdrop-tap, to avoid accidentally cancelling — or worse, silently dropping — a destructive confirmation).

## Migration

- Delete `src/utils/confirm.ts`, `src/utils/notify.ts`, `src/utils/notify.web.ts`.
- Add `src/components/AppModal.tsx` with `AppModalHost`, `confirmAction`, `notify` as described above.
- Mount `<AppModalHost />` in `app/_layout.tsx`, inside `GestureHandlerRootView`, alongside `SessionRecorderProvider` (sibling, not wrapping — it renders its own top-level `Modal`, not app content).
- Update imports in the 5 call-site files (table above) to `@/components/AppModal`. No changes to the call expressions themselves.

## Edge Cases

- **Concurrent calls:** second call replaces the first (see Store shape). Acceptable — no existing call site triggers two dialogs back to back.
- **Callback timing:** `onConfirm`/action `onPress` fires after the store is cleared (dialog already closing), so any navigation it triggers doesn't race the modal's own close animation.
- **Multiple platforms:** since this renders through RN's `Modal` (already proven on web via existing full-screen modals), no platform branching is needed in `AppModal.tsx` itself.

## Testing

No pure business logic to unit test — this is a rendering/store swap. Manual verification (web + native):

- Trigger each of the 5 call sites' `confirmAction`/`notify` and confirm the dialog renders centered, with correct button variant colors (red for delete confirmations, dark brand fill for the settings import/export `notify` calls).
- Confirm tapping "Cancelar" and the destructive button both close the dialog and only the destructive one runs its callback.
- Confirm tapping the overlay does nothing.
- Confirm Android hardware back button closes the dialog as "Cancelar"/"OK" would.
- Confirm two calls to `notify`/`confirmAction` in quick succession only ever show the latest request.

## Out of Scope

- New variants beyond `cancel`/`destructive`/`neutral` (e.g. multi-action dialogs, icons/glyphs) — not requested, no current call site needs them.
- A dialog queue for concurrent requests — no current call site needs it.
- Changing any call site's call expression or business logic — this is purely a rendering-engine swap behind the existing `confirmAction`/`notify` signatures.
