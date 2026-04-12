# Prescription Upload — Design Spec

## Goal

Let users photograph a prescription and have Claude Vision extract medication details, which the user reviews and confirms before saving.

## Architecture

**Flow:** User taps "Upload Prescription" → camera/gallery picker → image uploads to Supabase Storage → DB row created → Edge Function calls Claude Vision API → extracted meds returned → review screen with per-med confirm/skip → confirmed meds become medication + schedule rows.

**Components:**

1. **Client**: Upload button on Home page, image picker with `capture="environment"` for mobile camera hint, loading state, review screen
2. **Supabase Storage**: Bucket `prescriptions`, path `{user_id}/prescriptions/{uuid}.jpg`, private, 10MB max
3. **DB table**: `prescriptions` (new migration)
4. **Edge Function**: `parse-prescription` — fetches image from Storage, calls Anthropic Claude API with structured prompt, stores raw + parsed response
5. **Review UI**: List of extracted meds with confidence indicators (green/yellow/red), editable fields, individual confirm/skip per medication
6. **On confirm**: Reuses existing `createMedication` + `createSchedule` APIs

**Safety rails:**

- No auto-save. User must explicitly confirm each medication.
- Raw Claude response stored for audit trail (`vision_raw_response`)
- "Reject all & enter manually" escape hatch always visible

## Data Model

### `prescriptions` table (new migration)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | default gen_random_uuid() |
| user_id | uuid FK → auth.users | not null |
| storage_path | text | e.g., `{user_id}/prescriptions/{uuid}.jpg` |
| uploaded_at | timestamptz | default now() |
| vision_raw_response | jsonb | full Claude API response for audit |
| vision_parsed | jsonb | structured extraction (schema below) |
| status | text | 'pending_review' / 'confirmed' / 'rejected', default 'pending_review' |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now(), auto-updated by trigger |

**RLS policies:** Users can SELECT, INSERT, UPDATE their own rows only. No DELETE (audit trail).

### `vision_parsed` JSON schema

```json
{
  "medications": [
    {
      "name": "Ashwagandha",
      "dosage_amount": 500,
      "dosage_unit": "mg",
      "frequency": "daily",
      "times_of_day": [{"window_start": "08:00", "window_end": "09:00"}],
      "meal_relationship": "after",
      "duration_days": 30,
      "confidence": {
        "name": 0.95,
        "dosage": 0.90,
        "frequency": 0.70,
        "times": 0.40,
        "meal": 0.60
      }
    }
  ],
  "doctor_name": "Dr. Sharma",
  "date_prescribed": "2026-04-10",
  "notes": "Take with warm milk"
}
```

- Fields Claude can't find → `null` with low confidence
- Confidence thresholds: >0.8 = green, 0.5-0.8 = yellow, <0.5 = red
- `frequency` maps to existing `ScheduleFrequency` type: 'daily' | 'weekly' | 'as_needed'
- `meal_relationship` maps to existing `MealRelationship` type: 'before' | 'with' | 'after' | 'any'
- `times_of_day` uses existing `TimeWindow` shape: `{window_start, window_end}`

## Edge Function: `parse-prescription`

- **Runtime**: Supabase Edge Function (Deno)
- **Auth**: Requires service_role Bearer token (called from client with user's session, but function uses service role for Storage access)
- **Dependencies**: `@anthropic-ai/sdk` via npm: specifier
- **Model**: `claude-sonnet-4-20250514` (vision capable, cost-effective)
- **Input**: `{ prescription_id: string }` in request body
- **Process**:
  1. Validate user owns the prescription row
  2. Fetch image bytes from Supabase Storage using service role
  3. Call Anthropic API with image (base64) + structured prompt requesting the `vision_parsed` JSON schema
  4. Store `vision_raw_response` (full API response) and `vision_parsed` on the prescriptions row
  5. Return `vision_parsed` to client
- **Error handling**: If Claude can't parse the image, return `{ medications: [] }` with an error message. Don't throw.
- **Env vars needed**: `ANTHROPIC_API_KEY` (new secret in Supabase)

### Claude prompt (structured output)

The prompt should:

- Describe it's analyzing a medical prescription image
- Request output in the exact JSON schema above
- Ask for confidence scores per field (0.0-1.0)
- Handle handwritten and printed prescriptions
- Return null for fields it can't determine
- Map frequency/meal_relationship to the app's enum values

## Client-Side Flow

### Screen 1 — Upload (new route: `/upload-prescription`)

- Large tap target: "Take a photo of your prescription"
- `<input type="file" accept="image/*" capture="environment">` — on mobile, hints camera
- After image selected: show thumbnail preview + "Upload & Analyze" button
- On submit: upload to Storage → create DB row → call edge function → navigate to review
- Loading state: spinner with "Analyzing prescription..."

### Screen 2 — Review (`/upload-prescription/review/:id`)

- Header: "We found X medications" (or "No medications found — enter manually" with link to /add-med)
- List of medication cards, each showing:
  - Name (editable text input) — colored confidence dot
  - Dosage: amount (number input) + unit (text input) — confidence dot
  - Frequency (dropdown: daily/weekly/as_needed) — confidence dot
  - Times of day (time inputs) — confidence dot or blank if not extracted
  - Meal relationship (dropdown: before/with/after/any) — confidence dot or blank
  - **"Confirm"** button (green) and **"Skip"** button (gray) per card
- Footer: "Reject all & enter manually" link
- Confidence legend at top

### Screen 3 — Done

- "X medications added! Reminders will start based on your schedule."
- "Back to Home" button

### On confirm per medication:

1. Call `createMedication()` with extracted+edited fields, setting `prescription_id` to this prescription's ID
2. Call `createSchedule()` to create schedule and materialize doses
3. After all confirmed meds saved, update `prescriptions.status` to 'confirmed'
4. Invalidate medication and dose queries

### On "Reject all":

1. Update `prescriptions.status` to 'rejected'
2. Navigate to /add-med for manual entry

## File Structure

### New files:

- `supabase/migrations/0007_prescriptions.sql` — table, RLS, storage bucket
- `supabase/functions/parse-prescription/index.ts` — edge function
- `apps/web/src/features/prescriptions/api.ts` — client API (upload, get, update status)
- `apps/web/src/features/prescriptions/types.ts` — VisionParsed, ExtractedMedication types
- `apps/web/src/features/prescriptions/usePrescriptionUpload.ts` — upload + parse hook
- `apps/web/src/routes/upload-prescription/index.tsx` — upload screen
- `apps/web/src/routes/upload-prescription/ReviewScreen.tsx` — review screen
- `apps/web/src/routes/upload-prescription/MedicationCard.tsx` — editable medication card
- `apps/web/src/routes/upload-prescription/ConfidenceDot.tsx` — green/yellow/red dot component
- `apps/web/src/routes/upload-prescription/DoneScreen.tsx` — success screen

### Modified files:

- `apps/web/src/App.tsx` — add route for `/upload-prescription`
- `apps/web/src/routes/home/index.tsx` — add "Upload Prescription" button
- `packages/shared/src/types.ts` — add Prescription types

## Existing APIs reused:

- `createMedication(input: MedicationInput)` from `features/medications/api.ts`
- `createSchedule(medication, scheduleInput, options)` from `features/schedules/api.ts`
- `useProfile()` for timezone

## Error Handling

- Image too large (>10MB): show error before upload
- Upload fails: show retry button
- Claude API fails: show "Couldn't analyze. Try again or enter manually" with both options
- Individual medication save fails: show error on that card, let user retry

## Secrets Required

- `ANTHROPIC_API_KEY` — Supabase Edge Function secret (new)
- Existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` already available
