# MoneyFlow Mobile (Expo SDK 56)

Native iOS/Android client for MoneyFlow. Full feature parity with the web app — Home,
Analytics, Bills (Kanban), Profile. Authenticates via **Clerk** and talks to the
Next.js **API routes** from M5; never touches Supabase directly.

Built on **Expo SDK 56 · React Native 0.83 · React 19.2 · Expo Router 6** with the
**New Architecture** and **react-native-worklets** for Reanimated 4.

## Quick start (5 minutes)

```bash
cd mobile
npm install
cp .env.example .env.local
# edit .env.local — see "Environment" below
npx expo start
```

Scan the QR with **Expo Go** on your phone, or press `i` for iOS Simulator / `a` for
Android Emulator.

## Prerequisites

- Node.js 20+
- `npx expo start` requires no global install — it ships with the package.
- For physical-device testing: install **Expo Go** from the App Store / Play Store
  on your phone, and make sure the phone is on the same Wi-Fi as your laptop.

## Environment

Copy `.env.example` → `.env.local` and fill in:

| Var | Value |
|---|---|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Same `pk_test_…` key the web app uses. Get it from your Clerk dashboard → API keys. |
| `EXPO_PUBLIC_API_BASE_URL` | Your **LAN IP** of the Next.js dev server, e.g. `http://192.168.0.12:3000`. **Not `localhost`** — your phone can't see the laptop's localhost. Look at the `Network:` line `npm run dev` prints in the web app. |

For builds (TestFlight / Play Internal), set these in EAS Secrets instead.

## Architecture (mirror of the web app)

```
mobile/
├── app/                       # Expo Router file-based routing
│   ├── _layout.tsx           # ClerkProvider + auth gate
│   ├── (auth)/
│   │   └── sign-in.tsx       # Google OAuth + email/password
│   └── (tabs)/
│       ├── _layout.tsx       # Bottom tab bar
│       ├── index.tsx         # Home (Dashboard)
│       ├── analytics.tsx     # Charts (hand-rolled, no chart lib)
│       ├── bills.tsx         # Paged Kanban + long-press action sheet
│       └── profile.tsx       # User info + sign out
├── components/
│   ├── ui/                   # Card, SegmentedFilter
│   ├── SummaryCards.tsx
│   ├── SpendChart.tsx
│   ├── AddTransactionSheet.tsx
│   └── bills/
│       ├── BillCard.tsx
│       └── AddBillSheet.tsx
└── lib/
    ├── api.ts                # Fetch wrapper — attaches Clerk JWT as Bearer
    ├── theme.ts              # Design tokens (light + dark, port of globals.css)
    ├── types.ts              # Mirror of web src/lib/types.ts
    ├── recurrence.ts         # Mirror of web recurrence helpers
    ├── format.ts             # Money + date formatting
    └── token-cache.ts        # SecureStore-backed Clerk persistence
```

## How auth flows

1. User signs in on the mobile app via Clerk (`useSignIn` or `useOAuth`).
2. Clerk gives the device a **session token** and persists it via `expo-secure-store`
   (iOS Keychain / Android EncryptedSharedPreferences).
3. Every API call in `lib/api.ts` calls `getToken()` from `useAuth()` and sets
   `Authorization: Bearer <token>` on the request.
4. Next.js sees that header, the Clerk middleware resolves the user, and the API
   handler's `getSupabaseForUser()` issues a per-request Supabase client with the
   same token forwarded — so Postgres RLS scopes the query to that user's rows.

No service-role keys leave the server. No Supabase keys touch the mobile app.

## Sanity check

After signing in on the phone:

1. Add a transaction on the mobile app → it should appear on the web `/` after a
   refresh, with the same data.
2. Sign in as a different Clerk user on a second device → that user sees zero
   shared data (RLS isolation).
3. Toggle period on Home — `/api/transactions?period=…` re-fetches.
4. Long-press a bill card → action sheet → "Paid" → a transaction is created on
   the web's dashboard with category "Bills" and (if recurring) a fresh bill
   appears in Upcoming.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Sign-in screen loops back after Google OAuth | `redirectUrl` scheme mismatch — confirm `scheme: "moneyflow"` in `app.json` matches `Linking.createURL("…", { scheme: "moneyflow" })` in `sign-in.tsx`, and that the URL is registered as a redirect URL in your Clerk dashboard. |
| "Network request failed" on every API call | Wrong `EXPO_PUBLIC_API_BASE_URL` — must be the LAN IP, must include `http://`, no trailing slash. Try `curl` from your laptop first: `curl http://192.168.0.12:3000/api/transactions`. |
| Stuck on splash forever | `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` not set. Expo bundles env at build time — restart with `npx expo start -c` after editing `.env.local`. |
| Reanimated worklet errors | The `babel.config.js` plugin order matters — `react-native-worklets/plugin` **must be last**. (SDK 54+ replaced the old `react-native-reanimated/plugin`.) |

## Building for production

For TestFlight / Play Internal:

```bash
npm install -g eas-cli
eas login
eas build:configure          # one-time
eas build -p ios --profile preview     # or android
```

EAS asks for the secret env vars on first build — paste your prod `pk_live_…` Clerk
key and prod API URL there.

## Future polish (not v1)

- Replace hand-rolled analytics with `victory-native` (Skia) once we hit >100 categories
  or want gesture-driven tooltips.
- Drag-and-drop on Bills via `react-native-reanimated` shared values + `Gesture.Pan`.
- Push notifications for "due tomorrow" bills via `expo-notifications`.
- Apple Watch / Wear OS complications for the 30-second logger (PRD M9+ feature).
