# FLIXFIX — Katastash Ergou (Κατάσταση Έργου)

> Αρχείο σύνοψης: τι έχει γίνει, τι υπάρχει, τι μένει.

---

## 1. SXEDIO (Σχέδιο Εφαρμογής)

**Flixfix** — Σύστημα διαχείρισης παραδόσεων για πολλαπλά μαγαζιά και οδηγούς.

| Ρόλος   | Τι κάνει |
|---------|----------|
| **Owner**  | Βλέπει live παραγγελίες, εγκρίνει χρήστες, στατιστικά |
| **Shop**   | Δημιουργεί παραγγελίες, παρακολουθεί κατάσταση |
| **Driver** | Παίρνει διαθέσιμες παραγγελίες, ολοκληρώνει παραδόσεις |

**Platforms:** iOS · Android · Web (browser dashboard)  
**Stack:** React Native + Expo · TypeScript · Supabase · TanStack Table

---

## 2. DOMH FAKELVN (Δομή Φακέλων)

```
flixfix-app/
├── src/
│   ├── constants/          → Κοινά χρώματα (Colors)
│   ├── lib/
│   │   ├── supabase.ts     → Supabase client
│   │   ├── notifications.ts → Push notifications
│   │   └── orderHelpers.ts → Κοινές συναρτήσεις παραγγελιών ★ ΝΕΟ
│   ├── types/              → Shared TypeScript types
│   ├── navigation/         → AppNavigator, OwnerNavigator, ShopNavigator, DriverNavigator
│   ├── screens/            → Native mobile screens
│   │   ├── driver/         → AvailableOrders, MyOrders, DriverHistory
│   │   ├── owner/          → LiveOrders, Approvals, OwnerHistory, Stats
│   │   └── shop/           → NewOrder, ShopOrders, ShopHistory
│   └── web/                → Web dashboard (browser)
│       ├── components/     → Sidebar, TopBar
│       ├── screens/
│       │   ├── driver/     → Web εκδόσεις driver screens
│       │   ├── owner/      → Web εκδόσεις owner screens
│       │   └── shop/       → Web εκδόσεις shop screens
│       ├── WebApp.tsx      → Stub (native - επιστρέφει null)
│       ├── WebApp.web.tsx  → Πραγματικό web app shell
│       ├── WebAuthGate.tsx → Web login form
│       ├── theme.ts        → Web χρώματα (από Colors)
│       └── global.css      → Βασικό CSS για web
├── supabase-setup.sql      → Βάση δεδομένων setup script
├── KATASTASH.md            → Αυτό το αρχείο
├── app.json                → Expo config
└── package.json            → Dependencies
```

---

## 3. ALLAGHES (Αλλαγές που Έγιναν)

### 3.1 Auto-Offline Odigoi & Magazia

**Πρόβλημα:** Χρήστες που διαγράφονταν ή έκλειναν την εφαρμογή έμεναν ως "ενεργοί".

**Λύσεις:**

| # | Αρχείο | Τι έγινε |
|---|--------|----------|
| 1 | `supabase-setup.sql` (STEP 7) | SQL trigger: όταν διαγράφεται auth user → `online_status = false` |
| 2 | `src/navigation/AppNavigator.tsx` | AppState listener: όταν app πάει background → offline (mobile) |
| 3 | `src/web/WebApp.web.tsx` | `beforeunload` + `visibilitychange`: όταν κλείνει tab → offline (web) |

### 3.2 Katharismos Diplo Kodikas (Καθαρισμός)

| Αρχείο | Τι αφαιρέθηκε |
|--------|---------------|
| `StatsWeb.tsx` | Νεκρές μεταβλητές `platformFee = 0` και `totalRevenue = 0` |

### 3.3 Koines Synartiseis (Κοινές Συναρτήσεις)

Δημιουργήθηκε **`src/lib/orderHelpers.ts`** με:
- `addOrderTimeline(orderId, event)` — προστέθηκε timeline event (5 αρχεία το χρησιμοποιούν τώρα)
- `formatOrderTime(dateStr)` — μορφοποίηση ώρας "14:35"
- `formatOrderDateTime(dateStr)` — μορφοποίηση "03/07 14:35"

**Αρχεία που ενημερώθηκαν:**
- `screens/driver/AvailableOrdersScreen.tsx`
- `screens/driver/MyOrdersScreen.tsx`
- `screens/owner/LiveOrdersScreen.tsx`
- `web/screens/driver/AvailableOrdersWeb.tsx`
- `web/screens/driver/MyOrdersWeb.tsx`

### 3.4 Supabase Setup SQL (Ξαναγράφτηκε)

Το `supabase-setup.sql` ξαναγράφτηκε εξ αρχής (clean v2):
- Ενοποιήθηκαν όλα τα scripts σε ένα
- Προστέθηκε `email` column στο `users`
- Ενημερώθηκε `create_user_profile` με email support
- Προστέθηκε STEP 7: trigger για auto-offline

### 3.5 Mobile Bugfix Sprint (2026-07-11)

Διορθώθηκαν 10 προβλήματα που ανέφερε ο χρήστης στο mobile app (driver/shop/owner). Σειρά με βάση τα αρχεία:

| # | Πρόβλημα | Αρχείο(α) | Τι έγινε |
|---|----------|-----------|----------|
| 1 | Session δεν επέμενε στο native — αδικαιολόγητο logout, "Remember me" άχρηστο | `src/lib/supabase.ts` | Προστέθηκε `@react-native-async-storage/async-storage` ως storage adapter στο Supabase client (`persistSession: true`). Πριν δεν υπήρχε storage adapter καθόλου στο native, οπότε το session χανόταν σε κάθε restart ανεξαρτήτως του checkbox. |
| 2 | "Remember me" | `src/screens/LoginScreen.tsx` | Αντικαταστάθηκε η web-only λογική (`window.localStorage`) με `AsyncStorage` που δουλεύει σε όλα τα platforms. Αποθηκεύει/προσυμπληρώνει μόνο το email. |
| 3 | Σύνδεση/επαναφορά κωδικού με SMS δεν δούλευε (χρειάζεται πληρωμένο πάροχο SMS στο Supabase) | `LoginScreen.tsx`, `ForgotPasswordScreen.tsx`, `AppNavigator.tsx` | Αφαιρέθηκε εντελώς κατόπιν επιλογής χρήστη — καμία αναφορά OTP/phone auth πλέον. Διαγράφηκε το `screens/OTPVerificationScreen.tsx` και η route `OTPVerification`. Το προαιρετικό πεδίο τηλεφώνου στο Register παραμένει (είναι απλά στοιχείο επικοινωνίας, όχι auth). |
| 4 | Emoji "μαϊμού" (🙈) στην απόκρυψη κωδικού | `LoginScreen.tsx`, `RegisterScreen.tsx` | Αντικαταστάθηκαν τα 🙈/👁️ με `Ionicons` (`eye`/`eye-off`) από `@expo/vector-icons`. |
| 5 | Το on/off βάρδια (driver) και ανοιχτό/κλειστό (shop) δεν μπλόκαρε τίποτα | `screens/driver/AvailableOrdersScreen.tsx`, `screens/shop/ShopOrdersScreen.tsx` | Εκτός βάρδιας ο driver δεν βλέπει καν τη λίστα διαθέσιμων παραγγελιών. Με κλειστό μαγαζί το κουμπί "Νέα Παραγγελία" είναι disabled με μήνυμα. |
| 6 | Πληκτρολόγιο κάλυπτε το πεδίο αλλαγής κωδικού | `screens/ProfileScreen.tsx` | `KeyboardAvoidingView` behavior `'height'` στο Android + `keyboardVerticalOffset` από `useHeaderHeight()`. |
| 7 | "Αποσύνδεση" σε κάθε tab header | `navigation/DriverNavigator.tsx`, `ShopNavigator.tsx`, `OwnerNavigator.tsx`, `screens/ProfileScreen.tsx` | Αφαιρέθηκε το `headerRight` και από τα 3 navigators. Το logout μετακόμισε μέσα στο tab "Προφίλ". Ο owner δεν είχε καν tab Προφίλ — προστέθηκε (`OwnerProfile`). Το `ProfileScreen` ενημερώθηκε να δουλεύει και για τους 3 ρόλους (skip shop/driver table lookup όταν `role === 'owner'`). |
| 8, 2 (γενικό) | Ιστορικό/κατάσταση παραγγελίας αργούσε, ήθελε restart app | `screens/driver/DriverHistoryScreen.tsx`, `screens/shop/ShopHistoryScreen.tsx`, `screens/owner/OwnerHistoryScreen.tsx` | Οι οθόνες ιστορικού έκαναν fetch μόνο μία φορά στο mount (τα tabs μένουν mounted στο background). Προστέθηκε realtime `postgres_changes` subscription + `useFocusEffect` refetch σε κάθε επίσκεψη του tab. |
| — | Διαφορετικό theme owner vs shop/driver | `screens/owner/LiveOrdersScreen.tsx`, `ApprovalsScreen.tsx`, `StatsScreen.tsx`, `OwnerHistoryScreen.tsx` | Ο owner ήταν ολόκληρος σε ανοιχτόχρωμο hardcoded theme (`#f8fafc` κ.λπ.) ενώ shop/driver σε σκούρο (`Colors`). Ενοποιήθηκαν όλα στο σκούρο theme από `constants/colors.ts`. Βρέθηκε και διορθώθηκε bonus bug: σπασμένο/κατεστραμμένο emoji char στο tab icon "Ιστορικό" του owner. |

**Νέα dependencies:** `@react-native-async-storage/async-storage`, `@expo/vector-icons` (και τα δύο μπήκαν με `expo install` για συμβατότητα SDK 54).

⚠️ **Native module — χρειάζεται νέο dev build.** Το `@react-native-async-storage/async-storage` είναι native module, δεν αρκεί JS reload. Πρέπει `eas build --profile development` (ή αντίστοιχο) πριν δοκιμαστούν οι αλλαγές σε πραγματική συσκευή/emulator.

### 3.6 Web/Mobile Business Logic Parity Sweep + SaaS Auth Completion (2026-07-11)

Πλήρης σάρωση για διαφορές λογικής μεταξύ `src/screens/` (mobile) και `src/web/screens/` (browser dashboard), μετά διόρθωση με βάση 4 βήματα, μετά ολοκλήρωση του Update Password flow.

**Parity gaps που βρέθηκαν και διορθώθηκαν:**

| Πρόβλημα | Αρχείο(α) | Τι έγινε |
|---|---|---|
| Λείπε εντελώς το guard βάρδιας στο web | `web/screens/driver/AvailableOrdersWeb.tsx` | Πρόσθεσε ίδιο guard με mobile: κρυμμένη λίστα + μπλοκαρισμένο `takeOrder` όταν εκτός βάρδιας. |
| Mobile `NewOrderScreen` είχε μόνο entry-point gating (όχι μέσα στο ίδιο submit) | `screens/shop/NewOrderScreen.tsx` | Πρόσθεσε δικό του `isOpen` state + realtime + banner + μπλοκάρισμα στο submit, ίδιο επίπεδο με το web. |
| Λείπαν realtime listeners σε 3 οθόνες Ιστορικού στο web | `web/screens/shop/ShopHistoryWeb.tsx`, `web/screens/driver/DriverHistoryWeb.tsx`, `web/screens/owner/HistoryWeb.tsx` | Πρόσθεσε `postgres_changes` subscriptions matching mobile. |
| StatsWeb έδειχνε all-time νούμερα, mobile Stats "Σήμερα" — διαφορετικοί αριθμοί ανά πλατφόρμα | `web/screens/owner/StatsWeb.tsx` | Πρόσθεσε το ίδιο φίλτρο Σήμερα/Χθες/7 Μέρες. |
| Λείπε το τμήμα «Παραγγελίες ανά Μαγαζί» στο StatsWeb | `web/screens/owner/StatsWeb.tsx` | Πρόσθεσε bar-chart section ίδιο με mobile. |
| Καμία σελίδα αλλαγής κωδικού/στοιχείων στο web | Νέο `web/screens/ProfileWeb.tsx` | Name/phone edit (shop/driver), αλλαγή κωδικού (inline SVG eye toggle, όχι emoji), sign out. Καλωδιώθηκε σε `Sidebar.tsx`/`TopBar.tsx`/`WebApp.web.tsx` ως νέο tab "Προφίλ" και στους 3 ρόλους. |
| `Alert.alert()` είναι no-op στο `react-native-web` — αόρατα μηνύματα λάθους/επιτυχίας στο web auth flow | Νέο `src/lib/alert.ts`, εφαρμόστηκε σε `LoginScreen.tsx`, `RegisterScreen.tsx`, `ForgotPasswordScreen.tsx`, `AppNavigator.tsx` | Cross-platform helper: `window.alert`/`window.confirm` στο web, κανονικό `Alert.alert` στο native. |
| `src/web/WebAuthGate.tsx` ήταν dead code (ποτέ δεν γινόταν import) | Διαγράφηκε | Το πραγματικό login/register/forgot-password στο web ήταν ήδη τα ίδια mobile screens μέσω react-native-web (`AppNavigator` δεν κάνει platform split πριν το auth). |
| **Δεν υπήρχε καμία οθόνη να ολοκληρώσει το "forgot password" flow** (ούτε σε mobile ούτε σε web) — ο χρήστης έπαιρνε email αλλά δεν υπήρχε "set new password" screen | Νέο `screens/UpdatePasswordScreen.tsx`, ενημερώθηκε `navigation/AppNavigator.tsx` | Cross-platform οθόνη (νέος κωδικός + επιβεβαίωση). Το `AppNavigator` πιάνει το `PASSWORD_RECOVERY` event: στο web αυτόματα (`detectSessionInUrl`), στο native χειροκίνητα μέσω `Linking` (υποστηρίζει και PKCE `?code=` και implicit `#access_token=` links). Μετά επιτυχή αλλαγή κωδικού → sign out → Login screen (όχι Welcome). |

**Νέα αρχεία:** `src/lib/alert.ts`, `src/web/screens/ProfileWeb.tsx`, `src/screens/UpdatePasswordScreen.tsx`.
**Διαγραμμένα:** `src/web/WebAuthGate.tsx` (dead code).

⚠️ Το deep-link URL scheme (`flixfix://`) ήταν ήδη ρυθμισμένο στο `app.json` (iOS/Android) από πριν — δεν χρειάζεται νέο native build για το recovery flow, μόνο JS reload.

### 3.7 Production Deploy: EAS builds + Crash Fix (2026-07-11)

Μετά τα παραπάνω, χτίστηκαν πραγματικά EAS builds (development και preview) και βρέθηκαν/διορθώθηκαν 2 προβλήματα deployment που δεν φαίνονταν ποτέ με `tsc`:

| Πρόβλημα | Τι έγινε |
|---|---|
| Το `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` δεν ήταν καταχωρημένα στο EAS environment variables system — standalone (preview/production) builds τα χτίζουν "ψημένα" μέσα στο APK, άρα χωρίς αυτά ο Supabase client παίρνει `undefined` και πετάει σφάλμα. | Καταχωρήθηκαν με `eas env:create` (visibility: plaintext, είναι public/anon keys) και για τα 3 environments (development/preview/production), ώστε να μη ξαναλείψουν σε μελλοντικά builds. |
| **Πραγματικό crash στην εκκίνηση** (`FATAL EXCEPTION: java.lang.NoSuchMethodError ... ReturnTypeKt.getDirectConverter ... at expo.modules.font.FontLoaderModule`) — βρέθηκε μέσω `adb logcat` σε πραγματική συσκευή (Samsung SM-S938B). Αιτία: όταν προστέθηκε το `@expo/vector-icons` (§3.5), δεν εγκαταστάθηκε ρητά το peer dependency του `expo-font`, με αποτέλεσμα δύο ασύμβατες εκδόσεις του να συνυπάρχουν (`expo-font@57.0.0` top-level vs `expo-font@14.0.12` μέσα στο SDK 54) — crash σε κάθε standalone build. | `npx expo install expo-font` για να ευθυγραμμιστεί με το SDK 54. Επιβεβαιώθηκε με `npx expo-doctor` (16/17 → πέρασαν όλα εκτός από ένα ασήμαντο warning για μη τετράγωνο εικονίδιο). |

**Εργαλεία που εγκαταστάθηκαν στο μηχάνημα ανάπτυξης:** `adb` (μέσω `scoop install adb`) — χρήσιμο ξανά για μελλοντικό crash debugging σε πραγματική συσκευή (`adb logcat`).

💡 **Μάθημα για το μέλλον:** Όταν προστίθεται νέο Expo-native πακέτο, τρέξε `npx expo-doctor` πριν το build — θα πιάσει missing/duplicate peer dependencies πριν φτάσουν σε crash σε πραγματική συσκευή.

### 3.8 Owner Directory + Driver Restrictions + Owner-Created Orders (2026-07-11)

⚠️ **Χρειάζεται να ξανατρέξεις το `supabase-setup.sql` στο Supabase SQL Editor** πριν δουλέψει οτιδήποτε από αυτά — πρόσθεσε STEP 8 (`users.active`, default true) και STEP 9 (`users.can_view_orders`, default true). Δεν έχω δικαίωμα εκτέλεσης SQL απευθείας στη βάση, μόνο το anon key.

| Feature | Αρχεία | Τι έγινε |
|---|---|---|
| **Κατάλογος οδηγών/μαγαζιών (owner)** | Νέο `screens/owner/DirectoryScreen.tsx` + `web/screens/owner/DirectoryWeb.tsx` | Toggle Μαγαζιά/Οδηγοί, δείχνει name/phone/email/online status. |
| **Απενεργοποίηση αντί για διαγραφή** | Ίδια αρχεία + `users.active` | Επιλέχθηκε soft-delete αντί για πραγματικό DELETE, γιατί ένα shop/driver με ιστορικό παραγγελιών θα έσπαγε το FK constraint (`orders.shop_id`/`driver_id`). Το κουμπί κάνει toggle (Απενεργοποίηση ⇄ Ενεργοποίηση). `AppNavigator.tsx` μπλοκάρει login αν `active = false` (ίδιο pattern με το `approved` check). |
| **Driver order-visibility toggle** | Ίδια αρχεία + `users.can_view_orders`, `screens/driver/AvailableOrdersScreen.tsx`, `web/screens/driver/AvailableOrdersWeb.tsx` | Switch ανά οδηγό στον Κατάλογο. Όταν false, ο οδηγός δεν βλέπει καθόλου τη λίστα διαθέσιμων παραγγελιών (mobile+web), αλλά ο owner μπορεί ακόμα να του αναθέσει παραγγελία χειροκίνητα από το Live Orders. |
| **Owner-created order για μαγαζί χωρίς πρόσβαση στην εφαρμογή** | Νέο `screens/owner/OwnerNewOrderScreen.tsx` + `web/screens/owner/OwnerNewOrderWeb.tsx` | Ίδια φόρμα με το κανονικό New Order, με επιλογή μαγαζιού (chip list σε mobile, dropdown σε web). Αντίθετα με το κανονικό Shop New Order, **δεν ελέγχει `online_status`** — δεν έχει νόημα το "ανοιχτό/κλειστό" για μαγαζί που δεν συνδέεται ποτέ. |
| **Navigation** | `navigation/OwnerNavigator.tsx`, `web/components/Sidebar.tsx`, `web/components/TopBar.tsx`, `web/WebApp.web.tsx` | Mobile: το OwnerNavigator τυλίχτηκε σε Stack (όπως το ShopNavigator) ώστε να γίνεται push το OwnerNewOrder από κουμπί μέσα στο Directory. Web: 2 νέα items στο sidebar ("Κατάλογος", "Νέα Παραγγελία"). |
| **Αφαίρεση "Αποσύνδεση" από το πάνω-δεξιά του web** | `web/components/TopBar.tsx` | Αφαιρέθηκε εντελώς — υπάρχει ήδη στο tab «Προφίλ» (§3.6). |
| **Bug: αόρατο κείμενο στο "Σε βάρδια" (mobile)** | `screens/driver/AvailableOrdersScreen.tsx` | Το background ήταν `rgba(255,255,255,0.15)` (λευκό πάνω σε λευκό κείμενο) — αντικαταστάθηκε με συμπαγές σκούρο πράσινο ώστε το λευκό κείμενο να έχει πάντα αντίθεση. |

**Θέματα που ΔΕΝ διορθώθηκαν με κώδικα** (χρειάζονται ενέργεια εκτός repo):
- **Email επαναφοράς κωδικού στα Αγγλικά**: το πρότυπο email είναι Supabase Dashboard config (Authentication → Email Templates → Reset Password), όχι κάτι στον κώδικα της εφαρμογής.
- **Ο σύνδεσμος επαναφοράς δεν ανοίγει από άλλη συσκευή/δίκτυο**: όταν ζητείται reset από το **web**, το `redirectTo` γίνεται `window.location.origin` — δηλαδή ό,τι dev URL (localhost/LAN IP/tunnel) έτρεχε εκείνη τη στιγμή. Καμία μόνιμη δημόσια διεύθυνση δεν υπάρχει ακόμα για το web dashboard. Μέχρι να γίνει πραγματικό deploy κάπου σταθερά (Vercel/Netlify/κ.ά.), το reset μέσω **mobile app** είναι το αξιόπιστο path (χρησιμοποιεί το `flixfix://` deep link — δουλεύει ήδη σωστά, §3.6).

### 3.9 Owner-created shops χωρίς λογαριασμό (2026-07-11)

Προστέθηκε στο §3.8 SQL STEP 10: RPC `create_shop_without_account(p_name, p_phone)` — δημιουργεί ένα `shops`+`users` ζευγάρι με φρέσκο UUID που **δεν** αντιστοιχεί σε κανένα `auth.users` λογαριασμό (email = NULL). SECURITY DEFINER function, ελέγχει ότι ο καλών είναι `role='owner'` πριν επιτρέψει την εισαγωγή (bypass RLS σαν το υπάρχον `create_user_profile`).

UI: νέο κουμπί «🏪 Δημιουργία Μαγαζιού» στο tab Μαγαζιά του Κατάλογου (mobile + web) — μικρό modal με Όνομα (υποχρεωτικό) + Τηλέφωνο (προαιρετικό). Αυτά τα μαγαζιά εμφανίζονται στο Κατάλογο με ένδειξη «Χωρίς λογαριασμό» αντί για email, και είναι κατευθείαν επιλέξιμα στο dropdown του Owner New Order (§3.8).

---

### 3.10 UI Parity, Login Layout, Remember Me (2026-07-12)

Bugfix batch από πρώτο πραγματικό testing πάνω στο preview APK + browser:

- **Mobile/Web tab parity**: Το web Sidebar είχε ξεχωριστό nav item «Νέα Παραγγελία» για Owner και Shop, ενώ στο mobile ήταν κρυμμένο πίσω από κουμπί μέσα σε άλλη οθόνη (Κατάλογος / Παραγγελίες). Το `OwnerNavigator.tsx` και το `ShopNavigator.tsx` ξαναγράφτηκαν ώστε το «Νέα Παραγγελία» να είναι δικό του bottom tab σε mobile, ίδια σειρά με το web Sidebar (`OWNER_NAV`/`SHOP_NAV`). Τα παλιά κουμπιά-συντομεύσεις έμειναν ως έχουν (δεν πειράζουν).
- **Login/Register/ForgotPassword/UpdatePassword — πλάτος στο browser**: Οι 4 οθόνες αυθεντικοποίησης (κοινές μεταξύ mobile/web μέσω react-native-web) δεν είχαν `maxWidth`, οπότε στο browser τραβιόντουσαν σε όλο το πλάτος της σελίδας. Προστέθηκε wrapper `View` με `maxWidth: 420` + `alignSelf: center` γύρω από το περιεχόμενο και στις 4 οθόνες, ώστε να εμφανίζονται σαν κεντραρισμένη κάρτα (ίδιο look σε mobile και browser).
- **"Remember me" — άλλαξε σε πραγματικό auto-login**: Πριν, το checkbox απλά θυμόταν το email (prefill) ενώ το session πάντα persisted (localStorage/AsyncStorage), άρα η συμπεριφορά δεν ταίριαζε με το checkbox. Τώρα: νέο `src/lib/rememberMe.ts` με flag `flixfix_remember_me` (persist πάντα, ξεχωριστό από το session storage). Στο `AppNavigator.tsx`, το `handleSplashFinish()` ελέγχει το flag πριν κάνει auto-navigate σε υπάρχον session — αν είναι ρητά `false` (το checkbox ήταν unchecked στο τελευταίο login), κάνει `signOut()` και πάει στο Login αντί να μπει κατευθείαν. Αν το flag λείπει (παλιά sessions πριν την αλλαγή) ή είναι `true`, μπαίνει κατευθείαν όπως πριν.
- **"Δεν γίνεται live ανανέωση" (μαγαζί κλείνει / οδηγός βγαίνει εκτός βάρδιας)**: Ελέγχθηκε όλος ο σχετικός κώδικας (`LiveOrdersScreen`/`LiveOrdersWeb`/`DirectoryScreen`/`DirectoryWeb`) — όλοι έχουν ήδη σωστό realtime subscribe στο `postgres_changes` του πίνακα `users`. Ο χρήστης επιβεβαίωσε ότι ο πίνακας `users` είναι ήδη ενεργοποιημένος στο Supabase Dashboard → Database → Replication (`supabase_realtime`), άρα δεν είναι θέμα SQL/publication. Πιθανότερη αιτία: το realtime websocket «πεθαίνει» σιωπηλά (κινητό σε sleep/background, αλλαγή δικτύου) χωρίς άμεση επανασύνδεση. Προστέθηκε **defensive fallback** και στις 4 οθόνες: (α) `setInterval` κάθε 8 δευτερόλεπτα που ξανακάνει fetch ό,τι κι αν γίνει με το socket, (β) στο mobile, `AppState` listener που κάνει άμεσο refetch μόλις η εφαρμογή επανέλθει σε foreground (ώστε να μη χρειάζεται να περιμένεις τα 8 δευτερόλεπτα όταν ξανανοίγεις την εφαρμογή). Το realtime subscription παραμένει ενεργό για τις στιγμιαίες ενημερώσεις όταν το socket δουλεύει κανονικά — το polling είναι απλά δίχτυ ασφαλείας.
- **Διευκρίνιση (όχι bug)**: Τα ονόματα οδηγών («Alex», «Mimis», «Αντωνής», «Σβέρκος» κ.λπ.) στο φίλτρο του Ιστορικού είναι πραγματικοί λογαριασμοί `drivers` που δημιουργήθηκαν κατά τα tests — όχι hardcoded δεδομένα. Περιττοί test-λογαριασμοί μπορούν να απενεργοποιηθούν από τον Κατάλογο (§3.8).

⚠️ **Εκκρεμεί ακόμα** να επιβεβαιωθεί ότι το `supabase-setup.sql` (STEP 8-10) έχει τρέξει στο Supabase — χωρίς αυτό, Κατάλογος / Deactivate / Create-Shop / can_view_orders δεν θα δουλέψουν.

---

### 3.11 Auto-offline μετά από αδράνεια (2026-07-12)

Πρόβλημα: αν ένα μαγαζί/οδηγός αφήσει την εφαρμογή ανοιχτή (browser tab ή κινητό) χωρίς να κάνει logout, εμφανίζεται στον ιδιοκτήτη ως «ανοιχτό»/«σε βάρδια» επ' αόριστον, ακόμα κι αν έχει φύγει από τον υπολογιστή/κινητό.

Νέο `src/lib/useIdleTimeout.ts` — hook που παρακολουθεί δραστηριότητα (touch στο mobile, mousemove/keydown/click/scroll στο web) και:
- Μετά από **25 λεπτά** αδράνειας, δείχνει προειδοποίηση («Είσαι ακόμα εκεί;»)
- Μετά από **30 λεπτά** αδράνειας συνολικά, κάνει αυτόματο `signOut()` — που ήδη μέσω του υπάρχοντος `SIGNED_OUT` handler στο `AppNavigator.tsx` θέτει `online_status = false` για shop/driver.

Ενεργοποιείται μόνο όταν `screen === 'shop' || 'driver'` (όχι για owner). Στο mobile, το `View` wrapper γύρω από το `ShopNavigator`/`DriverNavigator` στο `AppNavigator.tsx` πιάνει `onTouchStart`/`onTouchMove` για reset του timer· στο web γίνεται μέσω `window` event listeners, οπότε δουλεύει και μέσα στο `WebApp` χωρίς αλλαγές εκεί.

(Σημείωση: το `WebApp.web.tsx` είχε ήδη auto-offline σε `beforeunload`/`visibilitychange` για κλείσιμο tab/αλλαγή tab — το idle timeout καλύπτει το ξεχωριστό σενάριο που το tab μένει ανοιχτό και ορατό αλλά αχρησιμοποίητο.)

---

### 3.12 Ιστορικό Owner: Εξαγωγή CSV + Αναλυτικό Timeline Παραγγελίας (2026-07-12)

Δύο νέες δυνατότητες στο Ιστορικό του owner (mobile + web):

**Εξαγωγή CSV** — νέο κουμπί «⬇️ CSV» / «⬇️ Λήψη CSV» που κατεβάζει τις παραγγελίες του τρέχοντος φίλτρου (ημερομηνία + κατάσταση + οδηγός/αναζήτηση) σε αρχείο `.csv` (Ημερομηνία, Ώρα, Κατάστημα, Διεύθυνση, Πελάτης, Τηλέφωνο, Ποσό, Οδηγός, Κατάσταση, Αιτία Ακύρωσης — με UTF-8 BOM ώστε τα ελληνικά να ανοίγουν σωστά στο Excel).
- Νέο `src/lib/csv.ts` (`ordersToCsv`) — κοινό και για τα δύο platforms.
- Νέο `src/lib/exportFile.ts` (`exportTextFile`) — στο web κατεβάζει μέσω Blob+`<a download>`, στο mobile γράφει το αρχείο με το **νέο** `expo-file-system` API (`File`/`Paths`, όχι το legacy `writeAsStringAsync`) και ανοίγει το native share sheet με `expo-sharing` (ο χρήστης διαλέγει πού να το αποθηκεύσει/στείλει — δεν υπάρχει direct "Downloads folder" στο Expo managed workflow).
- Νέα dependencies: `expo-file-system`, `expo-sharing` (μπήκαν με `npx expo install`, σωστές εκδόσεις για SDK 54).
- Στο mobile `OwnerHistoryScreen.tsx` προστέθηκαν φίλτρα **Μήνας**/**Χρόνος** (έλειπαν, το web `HistoryWeb.tsx` τα είχε ήδη ως 30d/1y).

**Αναλυτικό timeline ανά παραγγελία** — πάτημα πάνω σε μια γραμμή στο Ιστορικό ανοίγει modal με:
- Όλα τα γεγονότα του `order_timeline` (δημιουργήθηκε, ανατέθηκε σε οδηγό, παραδόθηκε/ακυρώθηκε) σε χρονολογική σειρά, **παλιότερο πάνω → πιο πρόσφατο κάτω**.
- Υπολογισμένη διάρκεια παράδοσης (από «Πήρε ο οδηγός» έως «Παραδόθηκε»).
- Νέο `src/screens/owner/OrderDetailModal.tsx` (mobile) και `src/web/components/OrderDetailModalWeb.tsx` (web), και νέα helpers στο `src/lib/orderHelpers.ts`: `fetchOrderTimeline`, `findTimelineEventTime`, `formatDurationBetween`.
- Fix παράλληλα: το `LiveOrdersWeb.tsx` όταν ο owner αναθέτει οδηγό σε παραγγελία **δεν** κατέγραφε event στο `order_timeline` (το mobile `LiveOrdersScreen.tsx` το έκανε ήδη) — τώρα καταγράφει, ώστε το timeline να είναι πλήρες όποιο platform κι αν χρησιμοποιηθεί για την ανάθεση.

---

### 3.13 "Μαγαζί/οδηγός φαίνεται online αν και δεν έχει συνδεθεί εδώ και μέρες" (2026-07-12)

Root cause: το `online_status` γινόταν `true` στο login και μόνο ένα **καθαρό** sign-out / app-background event το ξαναγύριζε σε `false` (§3.9-3.11). Αν η εφαρμογή/browser κλείσει απότομα — crash, force-quit, τέλος μπαταρίας, διακοπή σύνδεσης, ο υπολογιστής κλείσει απευθείας — κανένα τέτοιο event δεν προλαβαίνει να τρέξει, οπότε το `online_status` μένει κολλημένο σε `true` **επ' αόριστον**, ακόμα και μέρες μετά.

Λύση: **heartbeat** μηχανισμός.
- Νέα στήλη `users.last_seen_at` (SQL STEP 11 στο `supabase-setup.sql` — χρειάζεται να ξανατρέξει).
- Όσο ο shop/driver είναι σε οποιαδήποτε οθόνη του (`AppNavigator.tsx`), το `useIdleTimeout` hook (§3.11) στέλνει heartbeat (`last_seen_at = now()`) κάθε 60 δευτερόλεπτα, ανεξάρτητα από το αν το μαγαζί/η βάρδια είναι ανοιχτά ή κλειστά.
- Νέο `src/lib/onlineStatus.ts`: `isReallyOnline(online_status, last_seen_at)` επιστρέφει `true` μόνο αν `online_status = true` **ΚΑΙ** το `last_seen_at` είναι πιο πρόσφατο από 2 λεπτά. `staleCutoffIso()` για server-side φιλτράρισμα (`.gte('last_seen_at', ...)`).
- Εφαρμόστηκε στο `LiveOrdersScreen`/`LiveOrdersWeb` (λίστα online οδηγών για ανάθεση) και στο `DirectoryScreen`/`DirectoryWeb` (πράσινη/γκρι κουκκίδα).
- **Αυτόματα διορθώνει** ήδη κολλημένους λογαριασμούς: παλιές εγγραφές έχουν `last_seen_at = NULL`, και το `isReallyOnline` τις θεωρεί offline χωρίς να χρειάζεται χειροκίνητο reset — μόλις ξανατρέξει το SQL, θα φανούν σωστά ανενεργές μέχρι να ξανασυνδεθούν.

⚠️ Χρειάζεται να ξανατρέξει το **ολόκληρο** `supabase-setup.sql` (μέχρι το νέο STEP 11) στο Supabase πριν δουλέψει αυτό.

---

### 3.14 Cleanup & Debugging Pass (2026-07-12)

Γενικός καθαρισμός πριν συνεχίσουμε με νέα features:
- Διαγράφηκαν: `metro-errors.txt` (stray debug log), `assets/logo1.png` και `assets/logo2.original.png` (αχρησιμοποίητα/backup εικόνων — το `logo2.png` που όντως χρησιμοποιείται στο `app.json` έμεινε ως έχει).
- Αφαιρέθηκαν orphaned styles στο `LoginScreen.tsx` (`separatorRow`, `socialRow`, κ.λπ. — υπολείμματα από παλιό OAuth-button UI που δεν υπάρχει πια στο JSX).
- Αφαιρέθηκε αχρησιμοποίητο export `formatOrderTime` από `orderHelpers.ts` (ποτέ δεν χρησιμοποιήθηκε — το `formatOrderDateTime` κάλυπτε ήδη τη χρήση).
- `expo-auth-session` / `expo-web-browser`: αχρησιμοποίητα πουθενά στον κώδικα, αλλά **κρατήθηκαν** κατόπιν επιλογής του χρήστη — προορίζονται για το μελλοντικό OAuth login (§5 EPOMENA).
- **Πραγματικό bug που βρέθηκε στο debugging**: το CSV export στο Ιστορικό (§3.12) χρησιμοποιούσε την ήδη-φορτωμένη λίστα οθόνης, η οποία είναι περιορισμένη (300 στο mobile, ~1000 default στο web/PostgREST) — για το φίλτρο «Χρόνος» σε ένα ενεργό μαγαζί αυτό θα παρήγαγε ένα CSV που λείπουν παραγγελίες, **χωρίς καμία ένδειξη** στον χρήστη. Fix: νέο `fetchAllPaginated()` στο `orderHelpers.ts` που φέρνει το ΠΛΗΡΕΣ σύνολο μέσω `.range()` σελιδοποίησης (1000 ανά σελίδα) ειδικά για το export, ανεξάρτητα από το τι δείχνει η οθόνη. Εφαρμόστηκε και στο `OwnerHistoryScreen.tsx` (mobile) και στο `HistoryWeb.tsx` (web, όπου επίσης επανεφαρμόζεται το client-side search filter πάνω στο πλήρες σύνολο πριν το export).
- `npx tsc --noEmit` καθαρό σε όλο το project μετά τις αλλαγές.
- Επιβεβαιώθηκε ότι η αλλαγή ονόματος shop/driver **ήδη υπάρχει** και δουλεύει σωστά (ενότητα «Στοιχεία» στο Profile — mobile `ProfileScreen.tsx` και web `ProfileWeb.tsx` — κάνει update στο σωστό πίνακα `shops`/`drivers` ανάλογα με τον ρόλο, όχι στο `users`) — δεν χρειάστηκε νέος κώδικας.

---

### 3.15 "Coming Soon" tabs: Χάρτης (Owner) + Συνδρομή (Shop) (2026-07-12)

Δύο νέα tabs-placeholder για μελλοντικά features, με επαγγελματικό "🚧 Σύντομα Διαθέσιμο" UI αντί για κενή/λείπουσα οθόνη:

- Νέο κοινό component `src/components/ComingSoonScreen.tsx` (mobile) και `src/web/components/ComingSoonWeb.tsx` (web) — icon + badge + τίτλος + περιγραφή, παίρνει τα πάντα ως props ώστε να ξαναχρησιμοποιηθεί ελεύθερα για επόμενα "coming soon" tabs.
- **Χάρτης** (Owner, mobile tab μετά το Live + web sidebar) — `src/screens/owner/MapScreen.tsx` / `src/web/screens/owner/MapWeb.tsx`. Προορίζεται για live χάρτη με θέση οδηγών + προορισμό παραγγελιών.
- **Συνδρομή** (Shop, mobile tab μετά το Ιστορικό + web sidebar) — `src/screens/shop/SubscriptionScreen.tsx` / `src/web/screens/shop/SubscriptionWeb.tsx`. Προορίζεται για billing (ανά παραγγελία ή μηνιαία συνδρομή).
- Wiring: `OwnerNavigator.tsx`/`ShopNavigator.tsx` (mobile tabs), `Sidebar.tsx` (`OwnerScreen`/`ShopScreen` types + `OWNER_NAV`/`SHOP_NAV`), `TopBar.tsx` (`SCREEN_TITLES`), `WebApp.web.tsx` (routing) — καμία backend/SQL αλλαγή, καθαρά UI placeholders προς το παρόν.
- **Update**: η «Συνδρομή» μπήκε **και στον Owner** (`src/screens/owner/SubscriptionScreen.tsx` / `src/web/screens/owner/SubscriptionWeb.tsx`, δικό της tab σε mobile + web), αφού ο ιδιοκτήτης θα είναι αυτός που θα ορίζει τη συνδρομή κάθε μαγαζιού — όχι μόνο το μαγαζί να τη βλέπει. Στο `WebApp.web.tsx` τα δύο components ονομάστηκαν `OwnerSubscriptionWeb`/`ShopSubscriptionWeb` στο import για να μην συγκρούονται (ίδιο filename `SubscriptionWeb.tsx` σε δύο φακέλους).

---

### 3.16 Νέος ρόλος "Developer" + Support Chat (2026-07-13)

Μεγάλο feature: ξεχωριστός λογαριασμός **developer** (δικό σου login, όχι το ίδιο με τον owner), με πλήρη ορατότητα/έλεγχο σε όλη την εφαρμογή, και **Support Chat** σε κάθε λογαριασμό (owner/shop/driver) για να στέλνουν θέματα κατευθείαν σε σένα.

**⚠️ SECURITY FIX (ανεξάρτητο από το feature, αλλά βρέθηκε ενώ το έφτιαχνα)**: το `create_user_profile` RPC δεχόταν οποιοδήποτε `p_role` χωρίς έλεγχο, ήταν granted σε `anon`, και δεν είχε FK από `users.id` σε `auth.users.id` — οποιοσδήποτε θα μπορούσε τεχνικά να κάνει self-signup ως `role='owner'` καλώντας απευθείας το RPC. Fix (STEP 13): τώρα δέχεται μόνο `p_role IN ('shop','driver')`, αλλιώς κάνει `RAISE EXCEPTION`. Ο μοναδικός τρόπος να γίνει κάποιος `owner` ή `developer` πλέον είναι μέσω του `promote_user_role` (παρακάτω), που απαιτεί ήδη υπάρχοντα developer.

**SQL (νέα STEP 12-15 στο `supabase-setup.sql`)**:
- STEP 12: `users.role` CHECK επεκτάθηκε σε `('owner','shop','driver','developer')`. Οι policies `"Owner can update any user"`/`"Owner can delete users"` επεκτάθηκαν σε `role IN ('owner','developer')`. Νέες policies ώστε developer να μπορεί να επεξεργαστεί οποιοδήποτε shop/driver record. Το `create_shop_without_account` RPC επιτρέπει πλέον και developer, όχι μόνο owner.
- STEP 13: το security fix του `create_user_profile` (πάνω).
- STEP 14: πίνακας `support_messages` (`user_id`, `sender_role: 'user'|'developer'`, `message`, `read`, `created_at`) + RLS (ο καθένας βλέπει/γράφει μόνο το δικό του thread, developer βλέπει/γράφει σε όλα) + realtime.
- STEP 15: RPC `promote_user_role(p_user_id, p_new_role)` — SECURITY DEFINER, callable μόνο από developer (ελέγχει `role='developer'` του caller). Αλλάζει τον ρόλο ενός **ήδη υπάρχοντος** λογαριασμού (δεν φτιάχνει νέο auth account — αυτό απαιτεί κανονικό signup πρώτα) και θέτει `approved=true` αυτόματα.

**⚠️ Πώς να φτιάξεις τον πρώτο σου developer λογαριασμό** (bootstrap — μόνο μία φορά, χειροκίνητα):
1. Κάνε κανονική εγγραφή στην εφαρμογή (Register screen) με το email σου — διάλεξε όποιο ρόλο (Κατάστημα ή Ντελιβεράς), δεν έχει σημασία, είναι προσωρινό.
2. Στο Supabase SQL Editor: `UPDATE users SET role = 'developer', approved = true WHERE email = 'TO-EMAIL-SOU';`
3. Από εκεί και πέρα, ΚΑΘΕ επόμενο owner/developer account το φτιάχνεις μέσα από την εφαρμογή (Developer → Λογαριασμοί → 🔁 Αλλαγή Ρόλου σε κάποιον που έχει ήδη κάνει signup) — δεν χρειάζεται ξανά SQL.

**Support Chat** (`src/lib/supportChat.ts`, `src/screens/SupportChatScreen.tsx` mobile / `src/web/screens/SupportChatWeb.tsx` web) — νέο tab "Υποστήριξη" σε Owner/Shop/Driver (mobile tabs + web sidebar). Chat-bubble UI, realtime, μηνύματα του χρήστη δεξιά / του developer αριστερά.

**Developer Dashboard** — εντελώς νέος navigator:
- Mobile: `src/navigation/DeveloperNavigator.tsx` — tabs Υποστήριξη / Λογαριασμοί / Live / Στατιστικά / Ιστορικό / Προφίλ. Τα Live/Στατιστικά/Ιστορικό είναι τα **ίδια components** με του owner (`LiveOrdersScreen`, `StatsScreen`, `OwnerHistoryScreen`) — δεν φτιάχτηκαν δεύτερη φορά, απλά επαναχρησιμοποιήθηκαν αφού δείχνουν ήδη global δεδομένα.
- Web: `WebApp.web.tsx` πήρε `role: 'developer'` branch, `Sidebar.tsx` νέο `DEVELOPER_NAV`.
- **Υποστήριξη (Inbox)** — `src/screens/developer/SupportInboxScreen.tsx` / `src/web/screens/developer/SupportInboxWeb.tsx`: λίστα με ΟΛΑ τα support threads (ένα ανά λογαριασμό), unread badge, ταξινομημένα κατά πιο πρόσφατο. Mobile: tap ανοίγει το thread σε δικιά του οθόνη. Web: two-pane layout (λίστα αριστερά, chat δεξιά).
- **Λογαριασμοί** — `src/screens/developer/AccountsScreen.tsx` / `src/web/screens/developer/AccountsWeb.tsx`: ΟΛΟΙ οι λογαριασμοί (shop/driver/owner/developer μαζί, με φίλτρα), απενεργοποίηση/ενεργοποίηση (ίδιο με τον Κατάλογο του owner, αλλά εδώ σε ΟΛΟΥΣ τους ρόλους) + κουμπί «🔁 Αλλαγή Ρόλου» που καλεί το `promote_user_role`.
- Νέος τύπος `AccountEntry` στο `types/index.ts`, νέο `src/lib/accounts.ts` (`accountDisplayName`) — αν κάποιος έγινε owner/developer ενώ είχε παλιά shop/driver profile row, δείχνει πάντα το email του, ποτέ το παλιό όνομα μαγαζιού/οδηγού.

---

### 3.17 Follow-ups: Mobile tab bar "Περισσότερα" + Edit UI στους Λογαριασμούς (2026-07-13)

Και τα δύο follow-up items από το §3.16 έγιναν:

**1. Mobile tab bar restructure (μόνο mobile — το web sidebar έμεινε ως έχει)**:
- `OwnerNavigator.tsx`: 4 ορατά tabs (Live, Κατάλογος, Ιστορικό, Στατιστικά) + 5ο tab **"☰ Περισσότερα"** (`src/screens/owner/MoreScreen.tsx`) με λίστα-μενού: Νέα Παραγγελία, Εγκρίσεις, Χάρτης, Συνδρομή, Υποστήριξη, Προφίλ.
- `DeveloperNavigator.tsx`: 4 ορατά tabs (Υποστήριξη, Λογαριασμοί, Live, Ιστορικό) + "Περισσότερα" (`src/screens/developer/MoreScreen.tsx`) → Στατιστικά, Προφίλ.
- Τεχνική λεπτομέρεια: οι "κρυμμένες" οθόνες **δεν αφαιρέθηκαν** από τον Tab.Navigator — έμειναν καταχωρημένες με `tabBarButton: () => null` (δεν εμφανίζουν εικονίδιο στη μπάρα, αλλά παραμένουν προσβάσιμες μέσω `navigation.navigate('OwnerNewOrder')` κ.λπ., π.χ. το κουμπί «Νέα Παραγγελία» μέσα στο Κατάλογο συνεχίζει να δουλεύει κανονικά χωρίς καμία αλλαγή).

**2. Edit name/phone στους Λογαριασμούς (Developer Dashboard)**:
- Νέο κουμπί «✏️ Επεξεργασία» σε κάθε γραμμή shop/driver (mobile `AccountsScreen.tsx` + web `AccountsWeb.tsx`) — δεν εμφανίζεται για owner/developer γραμμές αφού δεν έχουν name/phone πεδία.
- Ανοίγει modal με Όνομα + Τηλέφωνο, κάνει update στον σωστό πίνακα (`shops` ή `drivers` ανάλογα με `entry.role`) — το backend (RLS policies "Developer can update any shop/driver" από το STEP 12) ήταν ήδη έτοιμο, χρειαζόταν μόνο το UI.

---

## 4. VIVLIOTHIKI (Βιβλιοθήκη — Τι υπάρχει ήδη)

### Database Tables

| Πίνακας | Σκοπός |
|---------|--------|
| `users` | Όλοι οι χρήστες (role, approved, online_status, email, push_token, active, can_view_orders) |
| `shops` | Μαγαζιά (name, phone) |
| `drivers` | Οδηγοί (name, phone) |
| `orders` | Παραγγελίες (status, amount, cancel_reason, κ.λπ.) |
| `order_timeline` | Ιστορικό γεγονότων ανά παραγγελία |
| `customers` | Πελατολόγιο ανά μαγαζί (autocomplete) |
| `support_messages` | Support chat 1-προς-1 ανά λογαριασμό ↔ developer (§3.16) |

### Push Notifications (lib/notifications.ts)

- `registerPushToken()` — καταχωρεί token του device
- `sendPushToUsers(ids, title, body)` — στέλνει σε συγκεκριμένους χρήστες
- `sendPushToOnlineDrivers(title, body)` — στέλνει σε online οδηγούς

---

## 5. EPOMENA (Επόμενα / Ιδέες)

| Προτεραιότητα | Ιδέα |
|---------------|------|
| 🔴 Υψηλή | OAuth login (Facebook/Google) — υπάρχουν stubs στο LoginScreen |
| 🟡 Μεσαία | `totalRevenue` + `platformFee` tracking (πεδία υπάρχουν, λογική λείπει) |
| 🟡 Μεσαία | Shared `<StatusBadge>` component για web (επαναλαμβάνεται 5x) |
| 🟢 Χαμηλή | `formatOrderTime` / `formatOrderDateTime` σε web column renderers |
| 🟢 Χαμηλή | Shared `<OrderCard>` component για native screens |

---

## 6. SQL — Pos Na Trexeis (Πώς να τρέξεις)

1. Πήγαινε **Supabase → SQL Editor → New query**
2. Αντέγραψε **όλο** το `supabase-setup.sql`
3. Πάτα **RUN**
4. Είναι ασφαλές να τρέξεις ξανά (IF NOT EXISTS / OR REPLACE παντού)

---

*Τελευταία ενημέρωση: 2026-07-12*
