# Ayurplex MVP — Design Specification

**Status:** Draft — Pending User Approval
**Author:** Multi-Agent Dev Team (Manager)
**Date:** 2026-04-11
**Source:** Based on [Priya Jaiswal's Behance project](https://www.behance.net/gallery/232160019/Ayurplex-Smart-AI-Medication-Reminders)

---

## PR Overview

Ayurplex is a smart, adaptive medication reminder app. Unlike traditional reminder apps that fire on rigid schedules, Ayurplex reads the user's Google Calendar, applies deterministic rule-based scheduling logic, and shifts reminders around meetings, meals, and travel. MVP scope: cross-platform PWA (React + Vite + Capacitor) with Supabase backend, faithful to Priya Jaiswal's design.

---

## Goals

1. Build a faithful implementation of Priya Jaiswal's Ayurplex Behance design.
2. Ship an end-to-end happy path: sign up → connect calendar → add meds (manual or via prescription upload) → receive reminders → log doses (manual or voice) → see basic adherence.
3. Deploy as a PWA and as iOS/Android app-store builds from a single React codebase via Capacitor.
4. Adaptive scheduling via a deterministic rule engine (no LLM for scheduling decisions).
5. Safe-by-default: medication safety is R1; LLM-parsed prescriptions require user review before saving.

## Non-Goals (v1)

| Feature                                                                | Deferred to                                              |
| ---------------------------------------------------------------------- | -------------------------------------------------------- |
| AR glasses integration                                                 | Not on roadmap                                           |
| Multi-place / advanced location mapping                                | v2                                                       |
| Caregiver collaboration & data sharing                                 | v2                                                       |
| Document vault (lab results, vaccinations, etc.)                       | v3 or separate product                                   |
| Full Insights dashboard (trends, category analytics, provider reports) | v1.5                                                     |
| Travel itinerary view                                                  | v1.5                                                     |
| Multi-user / family accounts                                           | v2                                                       |
| LLM-powered scheduling explanations                                    | v2 (hybrid rule+LLM)                                     |
| Medication interaction warnings                                        | v2 (significant liability; needs drug DB + legal review) |
| Apple Sign-In                                                          | v1.1 (required for App Store)                            |
| Full offline mode                                                      | v2 (MVP is online-first with optimistic updates)         |

---

## Technology Decisions

| Area                    | Decision                                       | Rationale                                                                                                        |
| ----------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Design fidelity**     | Faithful to Priya's Behance                    | Colors, typography, layouts, navigation as-designed                                                              |
| **Client framework**    | React 18 + Vite                                | Fast dev server, SPA model fits the designs                                                                      |
| **Native wrapper**      | Capacitor 6                                    | Single codebase for PWA + iOS/Android app-store builds                                                           |
| **Backend**             | Supabase                                       | Postgres + Auth + Storage + Edge Functions; relational fit for meds/schedules/adherence; open-source, no lock-in |
| **AI scheduling**       | Rule-based (deterministic)                     | Cheap, predictable, explainable, no LLM cost; ships fast                                                         |
| **Voice**               | Voice logging only, Web Speech API             | Free, in-browser, covers 80% of value                                                                            |
| **Prescription upload** | Upload + Claude Vision extraction              | LLM vision parses handwritten scripts; mandatory user review for safety                                          |
| **Auth**                | Google OAuth only                              | Bundles login with Calendar permission in one flow                                                               |
| **Notifications**       | Web Push + Capacitor native (FCM)              | Single codebase, both delivery paths                                                                             |
| **Location**            | Home geofence + manual room selection          | No hardware; GPS is reliable at "home" scale; room-level is user-tapped                                          |
| **Styling**             | Tailwind CSS + CSS variables (Priya's palette) | Utility-first, easy theming                                                                                      |
| **State**               | Zustand + TanStack Query                       | Client state in Zustand; Supabase data via TanStack Query                                                        |
| **Forms**               | React Hook Form + Zod                          | Type-safe Add Medication forms                                                                                   |
| **Testing**             | Vitest + RTL + Playwright                      | Unit + component + E2E pyramid                                                                                   |
| **Monorepo**            | pnpm workspaces + Turborepo                    | Shared packages (rule-engine, UI) across apps and edge fns                                                       |

### Design tokens (from Priya's Behance)

**Colors**

- Primary: `#007972` (Forest Green), `#19AFA2` (Leafy Green), `#4D9999` (Dark Green), `#27879F` (Secondary Blue)
- Accent: `#F9E169` (Yellow), `#D7BD37` (Dark Yellow)
- Neutrals: `#111111` (Dark Black), `#2C2C2C` (Mild Black), `#092C4C` (Dark Blue), gray scale

**Typography**

- Headings: **Lexend** (Google Fonts) — H1 39px → H5 16px
- Body: **Roboto** (Google Fonts) — Large 31px, Medium 20px, Normal 16px, Small 14px

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT (React + Vite)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐ │
│  │   Home   │  │ Calendar │  │ Add Med  │  │   Adherence    │ │
│  │Dashboard │  │   View   │  │  Modal   │  │    (basic)     │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘ │
│                                                                 │
│  Capacitor Plugins: Push | Geolocation | Camera | SpeechRec    │
└─────────────────────────────────────────────────────────────────┘
           │ HTTPS + WebSocket (Supabase JS client)
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                          SUPABASE                               │
│  ┌──────────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐    │
│  │  Postgres    │ │   Auth   │ │Storage │ │Edge Functions│    │
│  │  (RLS on)    │ │ (Google) │ │(Rx img)│ │  (Deno/TS)   │    │
│  └──────────────┘ └──────────┘ └────────┘ └──────────────┘    │
└─────────────────────────────────────────────────────────────────┘
           │                                        │
           ▼                                        ▼
┌─────────────────────────┐         ┌──────────────────────────────┐
│   Google Calendar API   │         │    External Services         │
│   (OAuth token stored)  │         │  • Claude Vision (Rx parse)  │
└─────────────────────────┘         │  • FCM / APNs (push)         │
                                    │  • pg_cron (schedule jobs)   │
                                    └──────────────────────────────┘
```

---

## Data Model

All tables have `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`, and **Row Level Security (RLS) policies scoped to `auth.uid() = user_id`**.

### Tables

**`users`** — managed by Supabase Auth

- `id`
- `email`
- `google_refresh_token` (encrypted, for Calendar API server-side refresh)

**`profiles`**

- `user_id` FK → users
- `display_name`
- `timezone` (IANA string, e.g. `America/Toronto`)
- `home_lat`, `home_lng`, `home_radius_m` (nullable — user can defer during onboarding)
- `notification_prefs` (jsonb: channels, quiet hours)

**`rooms`**

- `user_id`
- `name` (`"Kitchen"`, `"Bedroom"`, etc.)
- `icon`
- Default room `"Home"` auto-created on first login so `preferred_room_id` always has a valid default.

**`medications`**

- `user_id`
- `name` (`"Metformin"`)
- `dosage_amount` (500)
- `dosage_unit` (`"mg"`)
- `form` (`"tablet"` | `"capsule"` | `"liquid"`)
- `instructions` (`"with food"`)
- `meal_relationship` (`"before"` | `"with"` | `"after"` | `"any"`)
- `start_date`
- `end_date` (nullable; null = ongoing)
- `prescription_id` FK → prescriptions (nullable)
- `active` (boolean)

**`medication_schedules`**

- `medication_id` FK
- `frequency` (`"daily"` | `"weekly"` | `"as_needed"`)
- `times_of_day` (jsonb: `[{window_start: "08:00", window_end: "11:00"}]`)
- `days_of_week` (int[]: `[1,2,3,4,5]` = weekdays)
- `preferred_room_id` FK → rooms (nullable)

**`prescriptions`**

- `user_id`
- `storage_path` (Supabase Storage URL)
- `uploaded_at`
- `vision_raw_response` (jsonb — raw Claude Vision output for audit)
- `vision_parsed` (jsonb — structured extraction)
- `status` (`"pending_review"` | `"confirmed"` | `"rejected"`)

**`scheduled_doses`** — materialized per day by pg_cron

- `user_id`
- `medication_id`
- `schedule_id`
- `scheduled_for` (timestamptz — original window midpoint)
- `adjusted_for` (timestamptz — after rule engine)
- `adjustment_reason` (`"meeting_conflict"` | `"travel"` | `"quiet_hours"` | `"none"`)
- `status` (`"pending"` | `"taken"` | `"skipped"` | `"missed"`)
- `taken_at`
- `taken_via` (`"manual"` | `"voice"` | `"auto"`)

**`calendar_events_cache`** — refreshed every 15 min per user

- `user_id`
- `google_event_id`
- `summary`
- `start_time`, `end_time`
- `location`
- `is_travel` (boolean — derived from distance from home)

**`location_events`** — geofence + room tracking

- `user_id`
- `event_type` (`"entered_home"` | `"left_home"` | `"room_selected"`)
- `room_id` FK (nullable)
- `occurred_at`

**`notification_log`** — audit + dedupe

- `user_id`
- `scheduled_dose_id` FK
- `channel` (`"push"` | `"in_app"`)
- `sent_at`
- `delivery_status`

### Design rationale

- **`scheduled_doses` is materialized** — rule engine pre-computes each day's doses. Adherence math is trivial, adjustments are transparent (you can see _why_ a dose was shifted).
- **`vision_raw_response` stored separately** — can re-parse without re-hitting Claude if extraction logic changes; audit trail for health data.
- **`calendar_events_cache`** — avoids hitting Google Calendar API on every reminder check. 15-min refresh via pg_cron.
- **`prescriptions.status = pending_review`** — LLM extraction is NEVER auto-saved to `medications`. User review is mandatory (safety rail).
- **All tables have `user_id` + RLS** — defense in depth. Database refuses cross-user reads even if API logic has a bug.

---

## Core Flows

### Flow A — Onboarding & Calendar Connect

```
1. Sign in with Google (Supabase Auth + Google OAuth + Calendar read scope)
2. Welcome screen → "Set your home" prompt
   - Home location on map + radius (default 50m)
   - SKIPPABLE — user can defer and set later from Settings
3. Notification permission prompt → Web Push / native push token
4. Onboarding complete → Home Dashboard with CTA "Add your first medication"

(Rooms are NOT part of onboarding. Default room "Home" is auto-created.
 Custom rooms added later from Settings → Places, or inline during Add Medication.)
```

### Flow B — Add Medication (manual)

```
1. Tap "+" → modal opens (Priya's add-med flow)
2. Search medication name (typeahead)
3. Enter dosage, form, instructions
4. Pick meal relationship (visual apple icons: before/with/after/any)
5. Set schedule (frequency + time windows + days)
6. Optional: assign preferred room
7. Set start date, optional end date
8. Save → insert medications + medication_schedules rows
9. pg_cron job materializes scheduled_doses for next 7 days on the next tick
```

### Flow C — Add Medication (prescription upload)

```
1. Tap "Upload Prescription" → Capacitor Camera (or file picker in PWA)
2. Image uploaded to Supabase Storage via signed URL
   Storage path: {user_id}/prescriptions/{uuid}.jpg
3. Insert prescriptions row with status='pending_review'
4. Client calls Edge Function `parse-prescription` with prescription.id
5. Edge Function:
   a. Fetches image bytes from Storage
   b. Calls Claude Vision API with structured prompt
   c. Stores raw response in vision_raw_response
   d. Stores parsed JSON in vision_parsed
   e. Returns to client
6. Client renders "Review extracted medications" screen with editable fields
7. User confirms each → creates medications + medication_schedules rows
8. prescriptions.status flipped to 'confirmed'
```

**Safety rule:** no medication is ever auto-saved from vision output. User review is mandatory.

### Flow D — Smart Reminder Scheduling (the heart of Ayurplex)

```
Runs every 5 minutes via pg_cron → calls Edge Function `schedule-reminders`:

1. For each user with active medications:
   a. Read today's scheduled_doses where status='pending' and scheduled_for within next 60 min
   b. For each dose, read calendar_events_cache for the same day
   c. Apply rule engine (below) to compute adjusted_for
   d. If adjusted_for is within next 10 min, enqueue a notification
2. Insert row into notification_log (dedupe by scheduled_dose_id + channel)
3. Edge Function dispatches push via:
   - FCM for Capacitor native
   - Web Push API for PWA

RULE ENGINE (deterministic):
  - If scheduled_for window overlaps a calendar event:
      IF meal_relationship = 'with' AND event has keyword [lunch|dinner|breakfast]:
          adjusted_for = event.start_time
      ELSE:
          adjusted_for = event.end_time + 10 min
          reason = 'meeting_conflict'
  - If user is traveling (calendar event with location > 100km from home):
      Split dose into AM/PM bundles, batch-notify once at start of day
      reason = 'travel'
  - Otherwise: adjusted_for = middle of scheduled window
      reason = 'none'
  - Quiet hours: if adjusted_for falls inside notification_prefs.quiet_hours,
      shift to quiet_hours.end or mark as "self-serve" (no push, app badge only)
      reason = 'quiet_hours'
```

### Flow E — Voice Logging

```
1. User long-presses Status Ring on Home Dashboard OR taps mic icon
2. Web Speech API starts listening (language = browser locale)
3. On result, client matches phrases against patterns:
   - "took (my)? (morning|afternoon|evening|night) meds?" → mark all due in that window
   - "took (my)? <med name>" → mark specific med
   - "skip (my)? (<med name>|next dose)" → mark skipped
4. Match → update scheduled_doses.status + taken_at + taken_via='voice'
5. Show toast confirmation ("Marked Metformin as taken at 9:14 AM")
6. No match → show transcribed text, offer manual disambiguation
```

Fallback: if Web Speech API unavailable, show disabled mic with tooltip "Voice not supported — use tap to log".

### Flow F — Geofence & Room Check-in

```
1. Capacitor Geolocation registers a geofence at home (lat/lng, radius)
2. Entered home event fires:
   a. Insert location_events row (entered_home)
   b. Read scheduled_doses due in next 60 min
   c. If any exist → fire local notification:
      "Welcome home. You have 2 meds due. Which room are you in?"
      Actions: [Kitchen] [Bedroom] [Other room]
3. User taps action → location_events row (room_selected)
4. If a due med has preferred_room = selected room → auto-surface take-now prompt
5. User taps "Mark as taken" → same as voice/manual flow
```

---

## Project Structure

```
ayurplex/
├── apps/
│   ├── web/                          # React + Vite PWA (the main client)
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── routes/              # React Router routes
│   │   │   │   ├── onboarding/
│   │   │   │   ├── home/            # Home Dashboard (Status Ring)
│   │   │   │   ├── calendar/
│   │   │   │   ├── add-med/         # Add Medication modal flow
│   │   │   │   ├── adherence/            # Basic adherence view (v1); full Insights is v1.5
│   │   │   │   └── settings/
│   │   │   ├── components/          # Shared UI (Button, Card, StatusRing, ...)
│   │   │   ├── features/            # Feature modules (one folder per domain)
│   │   │   │   ├── medications/
│   │   │   │   ├── schedules/
│   │   │   │   ├── prescriptions/
│   │   │   │   ├── calendar/
│   │   │   │   ├── voice/
│   │   │   │   └── geofence/
│   │   │   ├── lib/
│   │   │   │   ├── supabase.ts      # Supabase client singleton
│   │   │   │   ├── capacitor.ts     # Capacitor platform helpers
│   │   │   │   └── date.ts          # Timezone-aware date utils
│   │   │   ├── hooks/
│   │   │   ├── stores/              # Zustand stores
│   │   │   └── types/               # Generated Supabase types
│   │   ├── public/
│   │   │   ├── manifest.webmanifest
│   │   │   └── service-worker.ts
│   │   ├── capacitor.config.ts
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   └── mobile/                       # Capacitor wrapper (generated)
│       ├── ios/                     # Xcode project
│       └── android/                 # Android Studio project
│
├── packages/
│   ├── shared/                       # Types + pure logic shared across apps + edge fns
│   │   └── src/
│   │       ├── types.ts             # Medication, Schedule, Dose, etc.
│   │       ├── rule-engine/         # Deterministic scheduling rules (pure fns)
│   │       │   ├── index.ts
│   │       │   ├── conflicts.ts
│   │       │   ├── meal-windows.ts
│   │       │   ├── quiet-hours.ts
│   │       │   └── __tests__/
│   │       └── voice-patterns.ts    # Regex patterns for voice-logging
│   │
│   └── ui/                           # Design system (Tailwind + React components)
│       └── src/
│           ├── theme.ts             # Colors, typography tokens (Priya's palette)
│           ├── Button.tsx
│           ├── Card.tsx
│           ├── StatusRing.tsx
│           └── ...
│
├── supabase/
│   ├── migrations/                   # SQL schema migrations (versioned)
│   │   ├── 0001_init.sql
│   │   ├── 0002_rls_policies.sql
│   │   └── ...
│   ├── seed.sql                     # Dev seed data
│   ├── functions/                    # Edge Functions (Deno/TS)
│   │   ├── parse-prescription/
│   │   │   ├── index.ts
│   │   │   └── claude-client.ts
│   │   ├── schedule-reminders/
│   │   │   └── index.ts
│   │   ├── refresh-calendar/
│   │   │   └── index.ts
│   │   └── dispatch-push/
│   │       └── index.ts
│   └── config.toml
│
├── docs/
│   ├── superpowers/
│   │   ├── specs/                   # Design docs (this spec lives here)
│   │   └── plans/                   # Implementation plans
│   └── decisions/                   # ADRs + manager decision logs
│
├── .env.example
├── .gitignore
├── package.json                      # pnpm workspace root
├── pnpm-workspace.yaml
├── turbo.json                        # Turborepo for parallel builds
└── README.md
```

### Environment config

```
.env.example
─────────────
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_OAUTH_CLIENT_ID=

# Edge function secrets (supabase secrets set)
ANTHROPIC_API_KEY=                  # For prescription vision
FCM_SERVER_KEY=                     # For push
GOOGLE_CALENDAR_CLIENT_SECRET=      # For server-side token refresh
```

### Why this structure

- **`packages/shared/rule-engine`** — deterministic scheduling logic is pure TypeScript, unit-tested in isolation, imported by both the client (for preview) and the `schedule-reminders` Edge Function. One source of truth.
- **`packages/ui`** — design system isolated so tokens and components can evolve without touching app code.
- **`supabase/` at repo root** — required layout for Supabase CLI (migrations, functions, local dev).
- **Monorepo** — all related code in one PR'able unit. Turborepo caches builds so CI stays fast.

---

## Testing Strategy

### Pyramid

```
              ┌─────────────┐
              │   E2E (5%)  │  ← Playwright: 5-8 critical flows
              ├─────────────┤
              │ Integration │  ← Edge Functions + Supabase (local)
              │    (20%)    │
              ├─────────────┤
              │    Unit     │  ← Rule engine, pure logic, components
              │    (75%)    │
              └─────────────┘
```

### Layer 1 — Unit tests

**Rule engine** (`packages/shared/rule-engine`) — pure functions, no mocks.

```
__tests__/
├── conflicts.test.ts
│   ├── "shifts meal-dependent med to after meeting"
│   ├── "keeps med in window when no conflict"
│   ├── "handles back-to-back meetings"
│   ├── "respects preferred_room constraint"
│   └── "short meeting (<15 min) doesn't trigger shift"
│
├── meal-windows.test.ts
│   ├── "detects breakfast/lunch/dinner from event title"
│   └── "falls back to default meal times when no calendar event"
│
├── quiet-hours.test.ts
│   ├── "defers pre-quiet-hour reminder to after wake-up"
│   ├── "marks mid-quiet-hour dose as self-serve (no push)"
│   └── "handles quiet hours crossing midnight"
│
└── travel.test.ts
    ├── "detects travel from event location distance"
    └── "batches doses into AM/PM when traveling"
```

**Components** — React Testing Library: `StatusRing`, `AddMedicationModal`, `VoiceLogButton` with unsupported-browser fallback.

**Voice patterns** — regex patterns tested against realistic utterances.

### Layer 2 — Integration tests

Run against `supabase start` local stack in CI:

- `parse-prescription` Edge Function — fixture-driven, Claude API mocked
- `schedule-reminders` Edge Function — seed DB with meds + fake calendar cache, assert `scheduled_doses.adjusted_for`
- `refresh-calendar` — mocked Google API, assert cache table populates
- **RLS policy tests** — one per table, verify user A can't read/write user B's data

### Layer 3 — E2E tests (Playwright)

Critical happy paths only:

1. Sign in → add medication → see it on dashboard
2. Upload prescription → review extraction → confirm → meds appear
3. Mark a dose as taken → Status Ring updates
4. Voice-log "took my morning meds" → meds marked taken
5. Geofence simulation → room prompt → tap Kitchen → med surfaces
6. Calendar conflict → dose shifts → reason visible in UI

**Mocked externals in e2e:** Google Calendar API, Claude Vision API, push delivery.

### What we DON'T test

- Real push delivery — manual QA pre-release
- Real Google Calendar OAuth — manual QA pre-release
- Cross-browser voice recognition — documented support matrix, Chrome/Safari manual test
- Performance benchmarks — post-MVP

### TDD discipline

Every new function gets a failing test first (RED → GREEN → REFACTOR). The rule engine is the hardest thing to get right and the most dangerous if wrong — it receives the most aggressive TDD (happy + edge case tests per rule, written before implementation).

### CI gates (GitHub Actions)

On every PR to `main`:

```
1. pnpm install
2. pnpm build          (full monorepo)
3. pnpm typecheck
4. pnpm lint
5. pnpm test           (unit + integration)
6. pnpm test:e2e       (headless Playwright)
```

All must pass before merge.

### Test data & seeding

`supabase/seed.sql` creates:

- 2 test users with linked Google tokens (stub)
- 4 medications across different meal-relationship types
- 10 scheduled_doses for the next 7 days
- 3 fake calendar events (one conflict, one lunch, one far-away)

---

## Risks & Mitigations

**🔴 R1 — Medication safety (HIGH)** — Wrong reminders or misparsed prescriptions can cause harm.

- Rule engine is deterministic and fully unit-tested
- LLM vision output NEVER auto-saved — user review required
- Adherence logs append-only for audit
- "Missed" doses stay visible 24h
- User-facing disclaimer: "Ayurplex is not a substitute for medical advice"

**🔴 R2 — Push reliability (HIGH)** — A reminder app that can't reliably push is worthless.

- Dual-channel: `notification_log` tracks dispatch + delivery
- In-app badge fallback
- Retry dispatch up to 3 times on failure
- Manual QA on iOS Safari, Chrome, Capacitor iOS/Android pre-launch

**🟠 R3 — Calendar API rate limits & staleness (MEDIUM)**

- 15-min cache refresh balances quota vs freshness
- Exponential backoff on 429s
- UI shows "Last synced X min ago"
- Manual force-refresh in Settings

**🟠 R4 — LLM vision extraction accuracy (MEDIUM)**

- Confidence score displayed per field (green/yellow/red)
- Mandatory user review, all fields editable
- "Reject and enter manually" escape hatch
- Store raw + parsed for debug / re-parsing

**🟠 R5 — Timezone bugs (MEDIUM)**

- All timestamps stored in UTC; rendered in user's profile timezone
- Rule engine operates in user's IANA timezone
- Integration tests cover DST transitions and travel scenarios
- Single `lib/date.ts` wrapper — no raw `Date` in feature code

**🟡 R6 — Browser compatibility (LOW)**

- Capability detection + graceful degradation
- Documented support matrix in README
- Capacitor native builds cover iOS App Store users

**🟡 R7 — Supabase vendor (LOW)**

- Supabase is open-source and self-hostable; schema is standard Postgres
- Migration path to any Postgres host exists

---

## Open Questions

1. **Medication dictionary source** — in-app list, RxNorm API, or free-text for MVP? Leaning: free-text + server-side autocomplete cache in v1.
2. **Prescription image privacy** — does Supabase Storage meet data-residency needs? Default yes for v1; revisit for HIPAA/GDPR markets.
3. **Apple Sign-In requirement** — required for iOS App Store; not MVP blocker but must be in v1.1.
4. **Accessibility audit** — Priya's designs call out accessible labels; pre-launch audit for Status Ring and Add-Med modal.
5. **Quiet hours defaults** — 10pm–7am default or opt-in per user? Leaning: default on with easy override.

---

## Manager's Notes (Decision Log)

All decisions made during brainstorming (2026-04-11):

| #   | Decision                                             | Consulted     | Rationale                                                                         |
| --- | ---------------------------------------------------- | ------------- | --------------------------------------------------------------------------------- |
| 1   | Faithful to Priya's Behance design                   | User          | Avoids design debate, leverages existing research                                 |
| 2   | React + Vite + Capacitor (not Next.js, not Expo)     | User, Manager | PWA + app store from one codebase; SPA fits a personal health app                 |
| 3   | Supabase over Firebase                               | User, Manager | Relational data model fits meds/schedules/adherence; no vendor lock-in            |
| 4   | Rule-based scheduling (not LLM)                      | User, Manager | Deterministic, cheap, testable, explainable                                       |
| 5   | Voice logging only (Web Speech API)                  | User          | 80% of value, zero cost, no cloud dependency                                      |
| 6   | Prescription upload + Claude Vision                  | User          | LLM vision beats traditional OCR on handwriting; mandatory user review gates risk |
| 7   | Google OAuth only in MVP                             | User          | Bundles Calendar permission in sign-in; Apple Sign-In deferred to v1.1            |
| 8   | Web Push + Capacitor native (FCM)                    | User          | Single codebase, dual delivery                                                    |
| 9   | Home geofence + manual room check-in                 | User          | No hardware dependency; GPS works at "home" scale; room-level stays user-tapped   |
| 10  | Onboarding: sign-in → home → notifications (3 steps) | User          | User pushback on room setup during onboarding — deferred to Settings              |
| 11  | MVP = happy path end-to-end                          | User          | Insights/reports/Documents deferred to v1.5+                                      |
| 12  | AR glasses explicitly out of scope                   | User          | Not on roadmap at all                                                             |

Final authority on all decisions: the Manager (with user override). No other agent is authorized to make technical or business decisions.
