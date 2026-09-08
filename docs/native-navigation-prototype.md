# Native navigation prototype — 7 September 2026

Prepared as version 4.0.3 (iOS build 3) on 8 September 2026 for the requested source push. The separate guest-persistence release hold below remains open; a Git push is not App Store release approval.

## Before-state backup

`../oku-backups/oku-before-native-tabs-2026-09-07.tar.gz` contains the entire pre-navigation working tree, including uncommitted and untracked work. It excludes Git metadata, node_modules, dist, and iOS build output. The archive was listed successfully after creation (295 entries).

SHA-256: `283ce250a613bf5b99a01dde52b79ea3ddc70cd86eb1bcd6e38e49542acbea1d`.

The working smooth-bubble implementation was also preserved before the permanent-container change in `../oku-backups/oku-before-stable-screen-container-2026-09-07.tar.gz` (eight navigation-related files, including the then-current uncommitted content).

For a rollback, extract into a separate comparison directory first. Restore only navigation-related changes after comparing against any newer edits; never blindly overwrite the live working tree or reset Git.

A reversible visual fallback is also available: run `VITE_OKU_NAVIGATION=legacy npm run dev -- --port 5175` (stop the existing development server first). For an iPhone legacy build use `VITE_OKU_NAVIGATION=legacy npm run build && npx cap copy ios`. The native bar starts hidden and remains hidden when the bridge isn't enabled.

## Design and integration

- Play, Market, Oku Shop, Stats, Profile, in that order, equal native tabs.
- UIKit UITabBarController uses Apple's system appearance (Liquid Glass on iOS 26); older iOS keeps its standard native tab style.
- Exactly one CAPBridgeViewController is mounted permanently in OkuRootViewController. A sibling, transparent UITabBarController owns only the native navigation and empty tab hosts. The overlay intercepts touches only within the visible bar; the WebView receives all other touches and never changes parents during navigation. UIKit selects and animates immediately; `didSelect` notifies React. Numbered acknowledgements prevent older responses from undoing newer taps. React can reconcile a rejected tap (for example, a dialog appearing during the bridge round trip).
- Returning to Play from another tab skips the entrance cascade, progress-counter replay, and interaction delay. Initial app entrance and non-tab gameplay/book transitions are preserved.
- Ordinary tab switches do not use the screen-settle interaction lock. Unchanged appearance, badges and visibility are not reapplied during selection, and selection is never wrapped in `performWithoutAnimation`.
- Settings is in the upper-right header. Diamonds move to the upper-left. Existing settings, purchases, profiles, book selection, and gameplay remain in React.
- Gameplay and splash have no tab bar. Book selection remains within Play.
- Modal dialogs hide native navigation because a web z-index cannot cover UIKit. Shared modals use data-navigation-blocking; profile dialogs use aria-modal.
- Native layout reports the actual bottom overlap. Screens stay full-height behind the bar; each main scroll container adds that overlap plus 24px of end padding so its last controls can scroll above the bar. Browser/Android uses a restrained opaque fallback, without an animated CSS blur. Native material and haptics must be judged on an actual iPhone.
- Selected tabs use Oku charcoal (#292524), with warm white (#f5f5f4) in dark mode. This applies to UIKit tint and browser icons/labels; the browser selection capsule is neutral gray.
- Tab taps use the existing click feedback and respect sound/haptic preferences.
- No new timer or animation loop is added for navigation.

## Verification

Run `node scripts/test-navigation.mjs`, `npm run lint`, and the existing shop/market/hold-notes/profile/storage/auth/hint tests.

Manual checks: all five tabs, Settings open/close, purchase cancel, profile dialogs and keyboard, book selection and game back, light/dark appearance, small iPhone widths, bottom safe area, native badges, foreground/background, and VoiceOver. Thermal or battery improvement is not assumed; measure on device if needed.

References: https://developer.apple.com/videos/play/wwdc2025/284/ and https://capacitorjs.com/docs/ios/custom-code

## Results and release hold

- 4.0.3 source-push checks (8 September): TypeScript, navigation, daily gift, shop layout, market styles, hold notes, profiles, storage consistency, auth safety, cloud save, and all 23 hint cases passed. Production assets rebuilt and synced to iOS. Native Debug Simulator build succeeded (`/tmp/oku-4.0.3-build.log`). These checks do not resolve the guest restart issue documented below.
- Permanent-container refinement: navigation/bridge tests, TypeScript, shop layout, production web build, and native Simulator build passed (`/tmp/oku-stable-container-build.log`). Simulator spot checks verified Play → Oku Shop, screen-button hit testing, Settings hiding/restoration, dark appearance, level selection, full-screen gameplay, and navigation restoration on return. Simulator drag/wheel automation did not demonstrate scrolling (also inconclusive before this change); verify scrolling and frame-level smoothness on the physical iPhone. No claim of measured frame-time improvement.
- Selection-animation refinement: navigation tests now execute the native bridge hook against a deterministic mock, covering rapid selections before a React commit, return-to-original taps, stale events, same-tab acknowledgements, and a dialog rejecting an in-flight tap. TypeScript, web production build, shop layout, and the native Simulator build passed. Simulator spot checks verified Market/Profile/Play synchronization and Settings hiding/restoring the bar. Actual iPhone animation smoothness still needs user retesting; screenshots are not a frame-time measurement. Build log: `/tmp/oku-native-selection-build.log`.
- TypeScript, production web build, navigation tests, shop layout, market styles, hold-notes, profile policy/storage, storage consistency, auth safety, and all 23 hint cases passed.
- Final iOS Simulator and generic physical-iPhone Debug builds succeeded (code signing disabled). Logs are in `/tmp/oku-native-tabs-final-simulator.log` and `/tmp/oku-native-tabs-device-build.log`.
- Dedicated simulator `Oku Navigation QA` (`2D2D78FE-7C84-4BB0-A526-42B4DC05FD84`, iPhone 17 Pro, iOS 26.5) verified five native destinations, real system bar, Settings and Profile-dialog hiding/restoration, light/dark appearance, level books, and full-screen gameplay with bar restored on return.
- Browser fallback tested at 390×844 and 320×568. At 320 wide, all five labels fit and targets measured about 54×54 CSS pixels, with no horizontal overflow.
- No physical-phone, VoiceOver, older-iOS runtime, thermal/battery, or final keyboard/purchase-cancel sign-off yet.

**Separate pre-existing guest persistence issue found; do not recommend release before it is addressed.** No storage code was changed by the navigation work.

Reproduction (mocked storage, also observed after relaunching the isolated simulator): initializeNative → initializeProfiles(null) → claimWelcomeGift → saveSettings(appearance: dark) → flushPendingWrites → initializeNative → initializeProfiles(null). Before reload: 100 points, gift claimed, dark theme. After reload: 0 points, gift unclaimed, light theme.

Cause: `saveData` mirrors changes into the active account cache but not the active guest cache. `initializeNative` then explicitly prefers the isolated guest cache when the active marker is guest, even though it is stale. The exact same two code paths were confirmed in the pre-navigation archive. Existing regression tests did not cover this complete guest-mutation/reload sequence.

Next step requires user approval: repair guest mirroring with focused regression coverage while preserving sign-out/account-isolation semantics. Do not simply pick the newest generic slot by timestamp; it may belong to an account during an interrupted sign-out.
