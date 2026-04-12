# Prescription Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users photograph a prescription and have Claude Vision extract medication details for review and confirmation.

**Architecture:** Image uploaded to Supabase Storage -> prescriptions DB row created -> Edge Function calls Claude Vision API for extraction -> client renders review screen with editable fields and confidence indicators -> user confirms individual medications which reuse existing createMedication/createSchedule APIs.

**Tech Stack:** React + TypeScript (Vite), Supabase (Storage, Edge Functions, Postgres), Anthropic Claude API (claude-sonnet-4-20250514), web-push for notifications

---

## Task 1: Database migration + Storage bucket

**Files:**
- Create `supabase/migrations/0007_prescriptions.sql`

**Steps:**

- [ ] Create `supabase/migrations/0007_prescriptions.sql` with the following complete contents:

```sql
-- 0007_prescriptions.sql
-- Prescription Upload feature: prescriptions table + Storage bucket + RLS
--
-- Stores prescription images uploaded by users and the Claude Vision
-- extraction results. No DELETE policy — rows are audit trail.

-- =========================================================================
-- prescriptions table
-- =========================================================================
create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  uploaded_at timestamptz not null default now(),
  vision_raw_response jsonb,
  vision_parsed jsonb,
  status text not null default 'pending_review' check (
    status in ('pending_review', 'confirmed', 'rejected')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prescriptions_user_id_idx
  on public.prescriptions (user_id);

create index if not exists prescriptions_status_idx
  on public.prescriptions (user_id, status);

-- =========================================================================
-- updated_at trigger (reuses set_updated_at() from 0002)
-- =========================================================================
drop trigger if exists prescriptions_set_updated_at on public.prescriptions;
create trigger prescriptions_set_updated_at
  before update on public.prescriptions
  for each row execute function public.set_updated_at();

-- =========================================================================
-- Row Level Security — no DELETE (audit trail)
-- =========================================================================
alter table public.prescriptions enable row level security;

create policy "prescriptions_select_own"
  on public.prescriptions for select
  using (auth.uid() = user_id);

create policy "prescriptions_insert_own"
  on public.prescriptions for insert
  with check (auth.uid() = user_id);

create policy "prescriptions_update_own"
  on public.prescriptions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================================
-- Storage bucket: prescriptions
-- =========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'prescriptions',
  'prescriptions',
  false,
  10485760,  -- 10MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Storage RLS: users can upload to their own folder
create policy "prescriptions_storage_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'prescriptions'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage RLS: users can read their own files
create policy "prescriptions_storage_select"
  on storage.objects for select
  using (
    bucket_id = 'prescriptions'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage RLS: users can update their own files
create policy "prescriptions_storage_update"
  on storage.objects for update
  using (
    bucket_id = 'prescriptions'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
```

- [ ] Apply migration locally:

```bash
npx supabase db push
```

- [ ] Commit:

```bash
git add supabase/migrations/0007_prescriptions.sql
git commit -m "feat: add prescriptions table, storage bucket, and RLS policies"
```

---

## Task 2: Shared types + client API

**Files:**
- Modify `packages/shared/src/types.ts`
- Create `apps/web/src/features/prescriptions/types.ts`
- Create `apps/web/src/features/prescriptions/api.ts`

**Steps:**

- [ ] Append the following types to `packages/shared/src/types.ts` after the existing `PushSubscriptionInsert` interface:

```typescript
// ---------------------------------------------------------------------------
// Plan 5 — Prescription Upload
// ---------------------------------------------------------------------------

/** Status of a prescription upload. */
export type PrescriptionStatus = 'pending_review' | 'confirmed' | 'rejected';

/** Confidence scores for a single extracted medication field. */
export interface ConfidenceScores {
  name: number;
  dosage: number;
  frequency: number;
  times: number;
  meal: number;
}

/** A single medication extracted by Claude Vision. */
export interface ExtractedMedication {
  name: string | null;
  dosage_amount: number | null;
  dosage_unit: string | null;
  frequency: ScheduleFrequency | null;
  times_of_day: TimeWindow[] | null;
  meal_relationship: MealRelationship | null;
  duration_days: number | null;
  confidence: ConfidenceScores;
}

/** Structured output from Claude Vision parsing. */
export interface VisionParsed {
  medications: ExtractedMedication[];
  doctor_name: string | null;
  date_prescribed: string | null;
  notes: string | null;
}

/** A prescription row from the database. */
export interface Prescription {
  id: string;
  user_id: string;
  storage_path: string;
  uploaded_at: string;
  vision_raw_response: unknown | null;
  vision_parsed: VisionParsed | null;
  status: PrescriptionStatus;
  created_at: string;
  updated_at: string;
}
```

- [ ] Create `apps/web/src/features/prescriptions/types.ts` with the following complete contents:

```typescript
export type {
  Prescription,
  PrescriptionStatus,
  VisionParsed,
  ExtractedMedication,
  ConfidenceScores,
} from '@ayurplex/shared';

/** State of the upload + parse flow in the client. */
export type UploadPhase = 'idle' | 'uploading' | 'creating' | 'parsing' | 'done' | 'error';
```

- [ ] Create `apps/web/src/features/prescriptions/api.ts` with the following complete contents:

```typescript
import type { Prescription, PrescriptionStatus, VisionParsed } from '@ayurplex/shared';
import { supabase } from '@/lib/supabase';

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

/** Upload a prescription image to Supabase Storage. */
export async function uploadPrescriptionImage(
  file: File,
): Promise<{ storagePath: string }> {
  const userId = await requireUserId();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const storagePath = `${userId}/prescriptions/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from('prescriptions')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw error;
  return { storagePath };
}

/** Insert a prescription row in the database. */
export async function createPrescription(
  storagePath: string,
): Promise<Prescription> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('prescriptions')
    .insert({
      user_id: userId,
      storage_path: storagePath,
      status: 'pending_review',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Prescription;
}

/** Call the parse-prescription edge function. */
export async function parsePrescription(
  prescriptionId: string,
): Promise<VisionParsed> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Not authenticated');

  const response = await supabase.functions.invoke('parse-prescription', {
    body: { prescription_id: prescriptionId },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.error) throw response.error;
  return response.data as VisionParsed;
}

/** Fetch a single prescription by ID. */
export async function getPrescription(id: string): Promise<Prescription> {
  const { data, error } = await supabase
    .from('prescriptions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Prescription;
}

/** Update prescription status. */
export async function updatePrescriptionStatus(
  id: string,
  status: PrescriptionStatus,
): Promise<void> {
  const { error } = await supabase
    .from('prescriptions')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}
```

- [ ] Commit:

```bash
git add packages/shared/src/types.ts \
       apps/web/src/features/prescriptions/types.ts \
       apps/web/src/features/prescriptions/api.ts
git commit -m "feat: add prescription types and client API functions"
```

---

## Task 3: Edge Function -- parse-prescription

**Files:**
- Create `supabase/functions/parse-prescription/index.ts`

**Steps:**

- [ ] Create `supabase/functions/parse-prescription/index.ts` with the following complete contents:

```typescript
// supabase/functions/parse-prescription/index.ts
// Deno Edge Function: fetches a prescription image from Storage,
// sends it to Claude Vision for structured extraction, and stores
// the raw + parsed response on the prescriptions row.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const VISION_PROMPT = `You are analyzing a medical prescription image. Extract all medications and metadata from this prescription.

Return a JSON object with this exact schema:
{
  "medications": [
    {
      "name": "string - medication name",
      "dosage_amount": number or null,
      "dosage_unit": "string like mg, ml, g, etc." or null,
      "frequency": "daily" | "weekly" | "as_needed" or null,
      "times_of_day": [{"window_start": "HH:MM", "window_end": "HH:MM"}] or null,
      "meal_relationship": "before" | "with" | "after" | "any" or null,
      "duration_days": number or null,
      "confidence": {
        "name": 0.0-1.0,
        "dosage": 0.0-1.0,
        "frequency": 0.0-1.0,
        "times": 0.0-1.0,
        "meal": 0.0-1.0
      }
    }
  ],
  "doctor_name": "string" or null,
  "date_prescribed": "YYYY-MM-DD" or null,
  "notes": "string - any additional instructions" or null
}

Rules:
- For each medication field, provide a confidence score from 0.0 to 1.0 indicating how certain you are about the extraction.
- If you cannot determine a field, set it to null and give a low confidence score (below 0.3).
- frequency must be one of: "daily", "weekly", "as_needed". Map "twice daily", "BD", "BID" to "daily". Map "once a week", "weekly" to "weekly". Map "SOS", "PRN", "as needed" to "as_needed".
- meal_relationship must be one of: "before", "with", "after", "any". Map "before food", "empty stomach", "AC" to "before". Map "with food", "during meals" to "with". Map "after food", "PC" to "after". If not specified, use "any".
- times_of_day should use 24-hour format. Map "morning" to {"window_start":"08:00","window_end":"09:00"}, "afternoon" to {"window_start":"13:00","window_end":"14:00"}, "evening" to {"window_start":"18:00","window_end":"19:00"}, "night"/"bedtime" to {"window_start":"21:00","window_end":"22:00"}.
- Handle both handwritten and printed prescriptions.
- Return ONLY the JSON object, no markdown formatting or explanation.`;

function getMediaType(path: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

Deno.serve(async (req) => {
  try {
    // Parse request
    const { prescription_id } = await req.json();
    if (!prescription_id) {
      return new Response(
        JSON.stringify({ error: 'prescription_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Extract user JWT from Authorization header
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Create user-scoped client to verify ownership
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Use service role client for all DB + Storage operations
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the prescription row
    const { data: prescription, error: fetchError } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('id', prescription_id)
      .single();

    if (fetchError || !prescription) {
      return new Response(
        JSON.stringify({ error: 'Prescription not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Validate ownership
    if (prescription.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Not authorized' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Download image from Storage
    const { data: imageData, error: downloadError } = await supabase.storage
      .from('prescriptions')
      .download(prescription.storage_path);

    if (downloadError || !imageData) {
      console.error('Download error:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Failed to download image' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Convert to base64
    const arrayBuffer = await imageData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Image = btoa(binary);
    const mediaType = getMediaType(prescription.storage_path);

    // Call Anthropic Claude Vision API
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    let visionParsed = { medications: [], doctor_name: null, date_prescribed: null, notes: null };
    let visionRawResponse: unknown = null;

    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: VISION_PROMPT,
              },
            ],
          },
        ],
      });

      visionRawResponse = message;

      // Extract text content from response
      const textBlock = message.content.find(
        (block: { type: string }) => block.type === 'text',
      );
      if (textBlock && textBlock.type === 'text') {
        try {
          visionParsed = JSON.parse(textBlock.text);
        } catch {
          console.error('Failed to parse Claude response as JSON:', textBlock.text);
          // Keep default empty medications array
        }
      }
    } catch (err) {
      console.error('Anthropic API error:', err);
      visionRawResponse = { error: String(err) };
      // Keep default empty medications array — graceful degradation
    }

    // Store results on the prescription row
    const { error: updateError } = await supabase
      .from('prescriptions')
      .update({
        vision_raw_response: visionRawResponse,
        vision_parsed: visionParsed,
      })
      .eq('id', prescription_id);

    if (updateError) {
      console.error('Update error:', updateError);
    }

    return new Response(JSON.stringify(visionParsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('parse-prescription error:', err);
    return new Response(
      JSON.stringify({
        medications: [],
        doctor_name: null,
        date_prescribed: null,
        notes: null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
```

- [ ] Deploy the edge function:

```bash
npx supabase functions deploy parse-prescription --project-ref garzdixlyfryfbydtnsz
```

- [ ] Set the Anthropic API key secret:

```bash
npx supabase secrets set ANTHROPIC_API_KEY=<key> --project-ref garzdixlyfryfbydtnsz
```

- [ ] Commit:

```bash
git add supabase/functions/parse-prescription/index.ts
git commit -m "feat: add parse-prescription edge function with Claude Vision"
```

---

## Task 4: Upload screen + routing

**Files:**
- Create `apps/web/src/features/prescriptions/usePrescriptionUpload.ts`
- Create `apps/web/src/routes/upload-prescription/index.tsx`
- Create `apps/web/src/routes/upload-prescription/ConfidenceDot.tsx`
- Modify `apps/web/src/App.tsx`
- Modify `apps/web/src/routes/home/index.tsx`

**Steps:**

- [ ] Create `apps/web/src/features/prescriptions/usePrescriptionUpload.ts` with the following complete contents:

```typescript
import { useState, useCallback } from 'react';
import type { VisionParsed } from '@ayurplex/shared';
import type { UploadPhase } from './types';
import {
  uploadPrescriptionImage,
  createPrescription,
  parsePrescription,
} from './api';

export interface UsePrescriptionUploadResult {
  phase: UploadPhase;
  error: string | null;
  prescriptionId: string | null;
  visionParsed: VisionParsed | null;
  startUpload: (file: File) => Promise<void>;
  reset: () => void;
}

export function usePrescriptionUpload(): UsePrescriptionUploadResult {
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
  const [visionParsed, setVisionParsed] = useState<VisionParsed | null>(null);

  const startUpload = useCallback(async (file: File) => {
    try {
      setError(null);

      // Phase 1: Upload image to Storage
      setPhase('uploading');
      const { storagePath } = await uploadPrescriptionImage(file);

      // Phase 2: Create prescription row
      setPhase('creating');
      const prescription = await createPrescription(storagePath);
      setPrescriptionId(prescription.id);

      // Phase 3: Call edge function for parsing
      setPhase('parsing');
      const parsed = await parsePrescription(prescription.id);
      setVisionParsed(parsed);

      setPhase('done');
    } catch (err) {
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    }
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setError(null);
    setPrescriptionId(null);
    setVisionParsed(null);
  }, []);

  return { phase, error, prescriptionId, visionParsed, startUpload, reset };
}
```

- [ ] Create `apps/web/src/routes/upload-prescription/ConfidenceDot.tsx` with the following complete contents:

```typescript
import type { ReactElement } from 'react';

export interface ConfidenceDotProps {
  score: number;
  size?: number;
}

function getColor(score: number): string {
  if (score > 0.8) return '#2E7D32'; // green
  if (score >= 0.5) return '#F9A825'; // yellow
  return '#C62828'; // red
}

export function ConfidenceDot({ score, size = 10 }: ConfidenceDotProps): ReactElement {
  return (
    <span
      title={`Confidence: ${Math.round(score * 100)}%`}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: getColor(score),
        marginLeft: 6,
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    />
  );
}
```

- [ ] Create `apps/web/src/routes/upload-prescription/index.tsx` with the following complete contents:

```typescript
import { useState, useRef } from 'react';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrescriptionUpload } from '@/features/prescriptions/usePrescriptionUpload';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function UploadPrescriptionRoute(): ReactElement {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);

  const { phase, error, prescriptionId, startUpload, reset } =
    usePrescriptionUpload();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileSizeError(null);

    if (file.size > MAX_FILE_SIZE) {
      setFileSizeError('Image must be smaller than 10MB. Please choose a smaller file.');
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    await startUpload(selectedFile);
  }

  // Navigate to review screen once parsing is done
  if (phase === 'done' && prescriptionId) {
    navigate(`/upload-prescription/review/${prescriptionId}`, { replace: true });
  }

  const isLoading = phase === 'uploading' || phase === 'creating' || phase === 'parsing';

  const loadingMessage =
    phase === 'uploading'
      ? 'Uploading image...'
      : phase === 'creating'
        ? 'Saving prescription...'
        : phase === 'parsing'
          ? 'Analyzing prescription...'
          : '';

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '24px 16px',
        fontFamily: 'Roboto, sans-serif',
        minHeight: '100vh',
        background: '#F5FAF9',
      }}
    >
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none',
          border: 'none',
          color: '#007972',
          fontFamily: 'Roboto, sans-serif',
          fontSize: 16,
          cursor: 'pointer',
          padding: 0,
          marginBottom: 16,
        }}
      >
        &larr; Back
      </button>

      <h1
        style={{
          fontFamily: 'Lexend, sans-serif',
          fontSize: 24,
          fontWeight: 600,
          color: '#092C4C',
          margin: '0 0 8px',
        }}
      >
        Upload Prescription
      </h1>
      <p style={{ color: '#4D9999', margin: '0 0 24px', fontSize: 14 }}>
        Take a photo of your prescription and we'll extract the medication details for you.
      </p>

      {/* File input */}
      <div
        onClick={() => !isLoading && fileInputRef.current?.click()}
        style={{
          border: '2px dashed #4D9999',
          borderRadius: 16,
          padding: 32,
          textAlign: 'center',
          cursor: isLoading ? 'default' : 'pointer',
          background: '#FFFFFF',
          marginBottom: 16,
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Prescription preview"
            style={{
              maxWidth: '100%',
              maxHeight: 300,
              borderRadius: 8,
              objectFit: 'contain',
            }}
          />
        ) : (
          <>
            <div style={{ fontSize: 48, marginBottom: 8 }}>
              {/* Camera icon as text */}
              <span role="img" aria-label="camera" style={{ fontSize: 48 }}>
                &#128247;
              </span>
            </div>
            <p
              style={{
                color: '#092C4C',
                fontWeight: 500,
                margin: '0 0 4px',
              }}
            >
              Take a photo of your prescription
            </p>
            <p style={{ color: '#4D9999', fontSize: 13, margin: 0 }}>
              or choose from gallery
            </p>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* File size error */}
      {fileSizeError && (
        <p role="alert" style={{ color: '#C62828', fontSize: 14, margin: '0 0 16px' }}>
          {fileSizeError}
        </p>
      )}

      {/* Upload error */}
      {phase === 'error' && error && (
        <div style={{ marginBottom: 16 }}>
          <p role="alert" style={{ color: '#C62828', fontSize: 14, margin: '0 0 8px' }}>
            {error}
          </p>
          <button
            onClick={() => {
              reset();
              setSelectedFile(null);
              setPreviewUrl(null);
            }}
            style={{
              background: 'none',
              border: '1px solid #007972',
              color: '#007972',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              fontFamily: 'Roboto, sans-serif',
              fontSize: 14,
              marginRight: 8,
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => navigate('/add-med')}
            style={{
              background: 'none',
              border: '1px solid #4D9999',
              color: '#4D9999',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              fontFamily: 'Roboto, sans-serif',
              fontSize: 14,
            }}
          >
            Enter Manually
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div
          style={{
            textAlign: 'center',
            padding: '16px 0',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid #E0E0E0',
              borderTopColor: '#007972',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px',
            }}
          />
          <p style={{ color: '#092C4C', fontWeight: 500, margin: 0 }}>
            {loadingMessage}
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Upload button */}
      {selectedFile && !isLoading && phase !== 'error' && (
        <button
          onClick={handleUpload}
          style={{
            width: '100%',
            padding: '14px 0',
            background: '#007972',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 12,
            fontSize: 16,
            fontWeight: 600,
            fontFamily: 'Lexend, sans-serif',
            cursor: 'pointer',
          }}
        >
          Upload &amp; Analyze
        </button>
      )}
    </main>
  );
}

export default UploadPrescriptionRoute;
```

- [ ] Modify `apps/web/src/App.tsx` — add imports and routes. Replace the entire file with:

```typescript
import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { RequireOnboarded } from '@/features/onboarding/RequireOnboarded';
import SignInPage from '@/routes/sign-in';
import OnboardingPage from '@/routes/onboarding';
import HomePage from '@/routes/home';
import { AddMedRoute } from '@/routes/add-med';
import { UploadPrescriptionRoute } from '@/routes/upload-prescription';
import { ReviewScreen } from '@/routes/upload-prescription/ReviewScreen';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export function App(): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/sign-in" element={<SignInPage />} />
            <Route
              path="/onboarding"
              element={
                <RequireAuth>
                  <OnboardingPage />
                </RequireAuth>
              }
            />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <RequireOnboarded>
                    <HomePage />
                  </RequireOnboarded>
                </RequireAuth>
              }
            />
            <Route
              path="/add-med"
              element={
                <RequireAuth>
                  <RequireOnboarded>
                    <AddMedRoute />
                  </RequireOnboarded>
                </RequireAuth>
              }
            />
            <Route
              path="/upload-prescription"
              element={
                <RequireAuth>
                  <RequireOnboarded>
                    <UploadPrescriptionRoute />
                  </RequireOnboarded>
                </RequireAuth>
              }
            />
            <Route
              path="/upload-prescription/review/:id"
              element={
                <RequireAuth>
                  <RequireOnboarded>
                    <ReviewScreen />
                  </RequireOnboarded>
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

- [ ] Modify `apps/web/src/routes/home/index.tsx` — add an "Upload Prescription" button near the FAB. Replace the existing `Link` to `/add-med` (the FAB at the bottom) with two buttons. Find the `<Link to="/add-med"` block at the end and replace it with:

```typescript
      {/* FAB area */}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 12,
        }}
      >
        <Link
          to="/upload-prescription"
          aria-label="Upload prescription"
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            background: '#4D9999',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(77, 153, 153, 0.4)',
          }}
        >
          Rx
        </Link>
        <Link
          to="/add-med"
          aria-label="Add medication"
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            background: '#007972',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(0, 121, 114, 0.4)',
          }}
        >
          +
        </Link>
      </div>
```

- [ ] Commit:

```bash
git add apps/web/src/features/prescriptions/usePrescriptionUpload.ts \
       apps/web/src/routes/upload-prescription/index.tsx \
       apps/web/src/routes/upload-prescription/ConfidenceDot.tsx \
       apps/web/src/App.tsx \
       apps/web/src/routes/home/index.tsx
git commit -m "feat: add upload prescription screen, routing, and home page button"
```

---

## Task 5: Review screen + medication cards

**Files:**
- Create `apps/web/src/routes/upload-prescription/MedicationCard.tsx`
- Create `apps/web/src/routes/upload-prescription/ReviewScreen.tsx`

**Steps:**

- [ ] Create `apps/web/src/routes/upload-prescription/MedicationCard.tsx` with the following complete contents:

```typescript
import { useState } from 'react';
import type { ReactElement } from 'react';
import type {
  ExtractedMedication,
  ScheduleFrequency,
  MealRelationship,
  TimeWindow,
} from '@ayurplex/shared';
import { ConfidenceDot } from './ConfidenceDot';

export interface MedicationCardProps {
  medication: ExtractedMedication;
  index: number;
  onConfirm: (data: ConfirmedMedicationData) => void;
  onSkip: () => void;
  isConfirming: boolean;
  confirmError: string | null;
}

export interface ConfirmedMedicationData {
  name: string;
  dosage_amount: number;
  dosage_unit: string;
  frequency: ScheduleFrequency;
  meal_relationship: MealRelationship;
  times_of_day: TimeWindow[];
  duration_days: number | null;
}

const FREQUENCY_OPTIONS: { value: ScheduleFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'as_needed', label: 'As needed' },
];

const MEAL_OPTIONS: { value: MealRelationship; label: string }[] = [
  { value: 'before', label: 'Before meal' },
  { value: 'with', label: 'With meal' },
  { value: 'after', label: 'After meal' },
  { value: 'any', label: 'Any time' },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #D0D5DD',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'Roboto, sans-serif',
  color: '#092C4C',
  background: '#FFFFFF',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  fontSize: 12,
  fontWeight: 500,
  color: '#4D9999',
  marginBottom: 4,
};

export function MedicationCard({
  medication,
  index,
  onConfirm,
  onSkip,
  isConfirming,
  confirmError,
}: MedicationCardProps): ReactElement {
  const [name, setName] = useState(medication.name ?? '');
  const [dosageAmount, setDosageAmount] = useState(
    medication.dosage_amount?.toString() ?? '',
  );
  const [dosageUnit, setDosageUnit] = useState(medication.dosage_unit ?? 'mg');
  const [frequency, setFrequency] = useState<ScheduleFrequency>(
    medication.frequency ?? 'daily',
  );
  const [mealRelationship, setMealRelationship] = useState<MealRelationship>(
    medication.meal_relationship ?? 'any',
  );
  const [timesOfDay, setTimesOfDay] = useState<TimeWindow[]>(
    medication.times_of_day ?? [{ window_start: '08:00', window_end: '09:00' }],
  );
  const [durationDays, setDurationDays] = useState(
    medication.duration_days?.toString() ?? '',
  );

  function handleConfirm() {
    if (!name.trim()) return;
    onConfirm({
      name: name.trim(),
      dosage_amount: parseFloat(dosageAmount) || 0,
      dosage_unit: dosageUnit || 'mg',
      frequency,
      meal_relationship: mealRelationship,
      times_of_day: timesOfDay,
      duration_days: durationDays ? parseInt(durationDays, 10) : null,
    });
  }

  function updateTimeWindow(idx: number, field: 'window_start' | 'window_end', value: string) {
    setTimesOfDay((prev) =>
      prev.map((tw, i) => (i === idx ? { ...tw, [field]: value } : tw)),
    );
  }

  function addTimeWindow() {
    setTimesOfDay((prev) => [...prev, { window_start: '12:00', window_end: '13:00' }]);
  }

  function removeTimeWindow(idx: number) {
    setTimesOfDay((prev) => prev.filter((_, i) => i !== idx));
  }

  const confidence = medication.confidence;

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        boxShadow: '0 1px 4px rgba(9, 44, 76, 0.08)',
        border: '1px solid #E8EFEE',
      }}
    >
      <h3
        style={{
          fontFamily: 'Lexend, sans-serif',
          fontSize: 16,
          fontWeight: 600,
          color: '#092C4C',
          margin: '0 0 16px',
        }}
      >
        Medication {index + 1}
      </h3>

      {/* Name */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>
          Name <ConfidenceDot score={confidence.name} />
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Medication name"
          style={inputStyle}
        />
      </div>

      {/* Dosage */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 2 }}>
          <label style={labelStyle}>
            Dosage <ConfidenceDot score={confidence.dosage} />
          </label>
          <input
            type="number"
            value={dosageAmount}
            onChange={(e) => setDosageAmount(e.target.value)}
            placeholder="Amount"
            style={inputStyle}
            min={0}
            step="any"
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Unit</label>
          <input
            type="text"
            value={dosageUnit}
            onChange={(e) => setDosageUnit(e.target.value)}
            placeholder="mg"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Frequency */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>
          Frequency <ConfidenceDot score={confidence.frequency} />
        </label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
          style={inputStyle}
        >
          {FREQUENCY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Meal relationship */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>
          Meal <ConfidenceDot score={confidence.meal} />
        </label>
        <select
          value={mealRelationship}
          onChange={(e) => setMealRelationship(e.target.value as MealRelationship)}
          style={inputStyle}
        >
          {MEAL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Times of day */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>
          Times <ConfidenceDot score={confidence.times} />
        </label>
        {timesOfDay.map((tw, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <input
              type="time"
              value={tw.window_start}
              onChange={(e) => updateTimeWindow(idx, 'window_start', e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <span style={{ color: '#4D9999', fontSize: 13 }}>to</span>
            <input
              type="time"
              value={tw.window_end}
              onChange={(e) => updateTimeWindow(idx, 'window_end', e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            {timesOfDay.length > 1 && (
              <button
                onClick={() => removeTimeWindow(idx)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#C62828',
                  fontSize: 18,
                  cursor: 'pointer',
                  padding: '0 4px',
                }}
              >
                x
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addTimeWindow}
          style={{
            background: 'none',
            border: 'none',
            color: '#007972',
            fontSize: 13,
            cursor: 'pointer',
            padding: 0,
            fontFamily: 'Roboto, sans-serif',
          }}
        >
          + Add time
        </button>
      </div>

      {/* Duration */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Duration (days)</label>
        <input
          type="number"
          value={durationDays}
          onChange={(e) => setDurationDays(e.target.value)}
          placeholder="e.g., 30 (optional)"
          style={inputStyle}
          min={1}
        />
      </div>

      {/* Error */}
      {confirmError && (
        <p role="alert" style={{ color: '#C62828', fontSize: 13, margin: '0 0 12px' }}>
          {confirmError}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={handleConfirm}
          disabled={isConfirming || !name.trim()}
          style={{
            flex: 1,
            padding: '10px 0',
            background: isConfirming ? '#A0D2CF' : '#007972',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'Lexend, sans-serif',
            cursor: isConfirming ? 'default' : 'pointer',
            opacity: !name.trim() ? 0.5 : 1,
          }}
        >
          {isConfirming ? 'Saving...' : 'Confirm'}
        </button>
        <button
          onClick={onSkip}
          disabled={isConfirming}
          style={{
            flex: 1,
            padding: '10px 0',
            background: '#E8EFEE',
            color: '#4D9999',
            border: 'none',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'Lexend, sans-serif',
            cursor: 'pointer',
          }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
```

- [ ] Create `apps/web/src/routes/upload-prescription/ReviewScreen.tsx` with the following complete contents:

```typescript
import { useState, useEffect } from 'react';
import type { ReactElement } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { VisionParsed } from '@ayurplex/shared';
import { getPrescription, updatePrescriptionStatus } from '@/features/prescriptions/api';
import { createMedication } from '@/features/medications/api';
import { createSchedule } from '@/features/schedules/api';
import { useProfile } from '@/features/profiles/useProfile';
import { MEDICATIONS_QUERY_KEY } from '@/features/medications/useMedications';
import { DOSES_TODAY_QUERY_KEY } from '@/features/doses/useDueToday';
import { MedicationCard } from './MedicationCard';
import type { ConfirmedMedicationData } from './MedicationCard';
import { ConfidenceDot } from './ConfidenceDot';
import { DoneScreen } from './DoneScreen';

type CardStatus = 'pending' | 'confirmed' | 'skipped' | 'confirming' | 'error';

interface CardState {
  status: CardStatus;
  error: string | null;
}

export function ReviewScreen(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const timezone = profile?.timezone ?? 'UTC';

  const { data: prescription, isLoading, error } = useQuery({
    queryKey: ['prescription', id],
    queryFn: () => getPrescription(id!),
    enabled: !!id,
  });

  const visionParsed = prescription?.vision_parsed as VisionParsed | null;
  const medications = visionParsed?.medications ?? [];

  const [cardStates, setCardStates] = useState<CardState[]>([]);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [allDone, setAllDone] = useState(false);

  // Initialize card states when medications load
  useEffect(() => {
    if (medications.length > 0 && cardStates.length === 0) {
      setCardStates(medications.map(() => ({ status: 'pending', error: null })));
    }
  }, [medications.length, cardStates.length]);

  function checkAllProcessed(states: CardState[]) {
    const allProcessed = states.every(
      (s) => s.status === 'confirmed' || s.status === 'skipped',
    );
    if (allProcessed && states.length > 0) {
      const confirmed = states.filter((s) => s.status === 'confirmed').length;
      setConfirmedCount(confirmed);
      void updatePrescriptionStatus(id!, 'confirmed');
      void qc.invalidateQueries({ queryKey: MEDICATIONS_QUERY_KEY });
      void qc.invalidateQueries({ queryKey: DOSES_TODAY_QUERY_KEY });
      setAllDone(true);
    }
  }

  async function handleConfirm(index: number, data: ConfirmedMedicationData) {
    setCardStates((prev) => {
      const next = [...prev];
      next[index] = { status: 'confirming', error: null };
      return next;
    });

    try {
      const today = new Date().toISOString().split('T')[0];
      const endDate = data.duration_days
        ? new Date(Date.now() + data.duration_days * 86400000).toISOString().split('T')[0]
        : null;

      const medication = await createMedication({
        name: data.name,
        dosage_amount: data.dosage_amount,
        dosage_unit: data.dosage_unit,
        form: 'tablet', // default form for prescription uploads
        instructions: null,
        meal_relationship: data.meal_relationship,
        start_date: today,
        end_date: endDate,
      });

      await createSchedule(
        medication,
        {
          frequency: data.frequency,
          times_of_day: data.times_of_day,
          days_of_week: [1, 2, 3, 4, 5, 6, 7],
          preferred_room_id: null,
        },
        { timezone, startDate: today, days: 7 },
      );

      setCardStates((prev) => {
        const next = [...prev];
        next[index] = { status: 'confirmed', error: null };
        checkAllProcessed(next);
        return next;
      });
    } catch (err) {
      setCardStates((prev) => {
        const next = [...prev];
        next[index] = {
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to save medication.',
        };
        return next;
      });
    }
  }

  function handleSkip(index: number) {
    setCardStates((prev) => {
      const next = [...prev];
      next[index] = { status: 'skipped', error: null };
      checkAllProcessed(next);
      return next;
    });
  }

  async function handleRejectAll() {
    await updatePrescriptionStatus(id!, 'rejected');
    navigate('/add-med', { replace: true });
  }

  if (allDone) {
    return <DoneScreen confirmedCount={confirmedCount} />;
  }

  if (isLoading) {
    return (
      <main
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: '24px 16px',
          fontFamily: 'Roboto, sans-serif',
          textAlign: 'center',
          minHeight: '100vh',
          background: '#F5FAF9',
        }}
      >
        <p style={{ color: '#4D9999', marginTop: 64 }}>Loading prescription...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: '24px 16px',
          fontFamily: 'Roboto, sans-serif',
          minHeight: '100vh',
          background: '#F5FAF9',
        }}
      >
        <p style={{ color: '#C62828' }}>Failed to load prescription.</p>
        <button
          onClick={() => navigate('/')}
          style={{
            background: '#007972',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 10,
            padding: '10px 24px',
            fontSize: 14,
            fontFamily: 'Lexend, sans-serif',
            cursor: 'pointer',
            marginTop: 12,
          }}
        >
          Back to Home
        </button>
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '24px 16px 96px',
        fontFamily: 'Roboto, sans-serif',
        minHeight: '100vh',
        background: '#F5FAF9',
      }}
    >
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none',
          border: 'none',
          color: '#007972',
          fontFamily: 'Roboto, sans-serif',
          fontSize: 16,
          cursor: 'pointer',
          padding: 0,
          marginBottom: 16,
        }}
      >
        &larr; Back
      </button>

      <h1
        style={{
          fontFamily: 'Lexend, sans-serif',
          fontSize: 24,
          fontWeight: 600,
          color: '#092C4C',
          margin: '0 0 8px',
        }}
      >
        Review Medications
      </h1>

      {/* Confidence legend */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 20,
          fontSize: 12,
          color: '#4D9999',
          alignItems: 'center',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ConfidenceDot score={0.9} /> High
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ConfidenceDot score={0.6} /> Medium
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ConfidenceDot score={0.3} /> Low
        </span>
      </div>

      {medications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <p
            style={{
              color: '#092C4C',
              fontSize: 16,
              fontWeight: 500,
              marginBottom: 12,
            }}
          >
            No medications found
          </p>
          <p style={{ color: '#4D9999', fontSize: 14, marginBottom: 20 }}>
            We couldn't extract medications from this image. You can enter them manually.
          </p>
          <Link
            to="/add-med"
            style={{
              display: 'inline-block',
              background: '#007972',
              color: '#FFFFFF',
              borderRadius: 10,
              padding: '10px 24px',
              fontSize: 14,
              fontFamily: 'Lexend, sans-serif',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Enter Manually
          </Link>
        </div>
      ) : (
        <>
          <p style={{ color: '#092C4C', fontSize: 15, marginBottom: 20 }}>
            We found <strong>{medications.length}</strong> medication
            {medications.length !== 1 ? 's' : ''}. Review and confirm each one.
          </p>

          {/* Doctor info if available */}
          {(visionParsed?.doctor_name || visionParsed?.date_prescribed) && (
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 12,
                padding: '12px 16px',
                marginBottom: 16,
                fontSize: 13,
                color: '#4D9999',
                border: '1px solid #E8EFEE',
              }}
            >
              {visionParsed?.doctor_name && (
                <p style={{ margin: '0 0 4px' }}>
                  <strong>Doctor:</strong> {visionParsed.doctor_name}
                </p>
              )}
              {visionParsed?.date_prescribed && (
                <p style={{ margin: '0 0 4px' }}>
                  <strong>Date:</strong> {visionParsed.date_prescribed}
                </p>
              )}
              {visionParsed?.notes && (
                <p style={{ margin: 0 }}>
                  <strong>Notes:</strong> {visionParsed.notes}
                </p>
              )}
            </div>
          )}

          {medications.map((med, index) => {
            const state = cardStates[index];
            if (!state || state.status === 'confirmed' || state.status === 'skipped') {
              const label =
                state?.status === 'confirmed'
                  ? 'Confirmed'
                  : state?.status === 'skipped'
                    ? 'Skipped'
                    : null;
              if (label) {
                return (
                  <div
                    key={index}
                    style={{
                      background: state.status === 'confirmed' ? '#E8F5E9' : '#F5F5F5',
                      borderRadius: 12,
                      padding: '12px 16px',
                      marginBottom: 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: '1px solid #E8EFEE',
                    }}
                  >
                    <span style={{ color: '#092C4C', fontWeight: 500 }}>
                      {med.name ?? `Medication ${index + 1}`}
                    </span>
                    <span
                      style={{
                        color: state.status === 'confirmed' ? '#2E7D32' : '#9E9E9E',
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {label}
                    </span>
                  </div>
                );
              }
              return null;
            }
            return (
              <MedicationCard
                key={index}
                medication={med}
                index={index}
                onConfirm={(data) => void handleConfirm(index, data)}
                onSkip={() => handleSkip(index)}
                isConfirming={state.status === 'confirming'}
                confirmError={state.error}
              />
            );
          })}

          {/* Reject all footer */}
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button
              onClick={() => void handleRejectAll()}
              style={{
                background: 'none',
                border: 'none',
                color: '#C62828',
                fontSize: 14,
                fontFamily: 'Roboto, sans-serif',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Reject all &amp; enter manually
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default ReviewScreen;
```

- [ ] Commit:

```bash
git add apps/web/src/routes/upload-prescription/MedicationCard.tsx \
       apps/web/src/routes/upload-prescription/ReviewScreen.tsx
git commit -m "feat: add review screen with editable medication cards and confidence indicators"
```

---

## Task 6: Done screen + integration polish

**Files:**
- Create `apps/web/src/routes/upload-prescription/DoneScreen.tsx`

**Steps:**

- [ ] Create `apps/web/src/routes/upload-prescription/DoneScreen.tsx` with the following complete contents:

```typescript
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';

export interface DoneScreenProps {
  confirmedCount: number;
}

export function DoneScreen({ confirmedCount }: DoneScreenProps): ReactElement {
  const navigate = useNavigate();

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '24px 16px',
        fontFamily: 'Roboto, sans-serif',
        minHeight: '100vh',
        background: '#F5FAF9',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          background: '#E8F5E9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
        }}
      >
        <span style={{ fontSize: 36, color: '#2E7D32' }}>&#10003;</span>
      </div>

      <h1
        style={{
          fontFamily: 'Lexend, sans-serif',
          fontSize: 24,
          fontWeight: 600,
          color: '#092C4C',
          margin: '0 0 12px',
        }}
      >
        {confirmedCount} medication{confirmedCount !== 1 ? 's' : ''} added!
      </h1>

      <p
        style={{
          color: '#4D9999',
          fontSize: 15,
          margin: '0 0 32px',
          lineHeight: 1.5,
        }}
      >
        Reminders will start based on your schedule.
      </p>

      <button
        onClick={() => navigate('/', { replace: true })}
        style={{
          width: '100%',
          maxWidth: 280,
          padding: '14px 0',
          background: '#007972',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 12,
          fontSize: 16,
          fontWeight: 600,
          fontFamily: 'Lexend, sans-serif',
          cursor: 'pointer',
        }}
      >
        Back to Home
      </button>
    </main>
  );
}

export default DoneScreen;
```

- [ ] Verify the following integration points are correct:
  - `ReviewScreen.tsx` imports `DoneScreen` and renders it when all cards are processed
  - `ReviewScreen.tsx` calls `updatePrescriptionStatus(id, 'confirmed')` when all done
  - `ReviewScreen.tsx` invalidates `MEDICATIONS_QUERY_KEY` and `DOSES_TODAY_QUERY_KEY` on completion
  - `App.tsx` has both `/upload-prescription` and `/upload-prescription/review/:id` routes

- [ ] Commit:

```bash
git add apps/web/src/routes/upload-prescription/DoneScreen.tsx
git commit -m "feat: add done screen and wire up prescription upload flow end-to-end"
```

- [ ] Push to remote:

```bash
git push origin ayurplex/foundation
```

---

## File Summary

### New files (10):
| File | Task |
|------|------|
| `supabase/migrations/0007_prescriptions.sql` | 1 |
| `apps/web/src/features/prescriptions/types.ts` | 2 |
| `apps/web/src/features/prescriptions/api.ts` | 2 |
| `supabase/functions/parse-prescription/index.ts` | 3 |
| `apps/web/src/features/prescriptions/usePrescriptionUpload.ts` | 4 |
| `apps/web/src/routes/upload-prescription/index.tsx` | 4 |
| `apps/web/src/routes/upload-prescription/ConfidenceDot.tsx` | 4 |
| `apps/web/src/routes/upload-prescription/MedicationCard.tsx` | 5 |
| `apps/web/src/routes/upload-prescription/ReviewScreen.tsx` | 5 |
| `apps/web/src/routes/upload-prescription/DoneScreen.tsx` | 6 |

### Modified files (3):
| File | Task |
|------|------|
| `packages/shared/src/types.ts` | 2 |
| `apps/web/src/App.tsx` | 4 |
| `apps/web/src/routes/home/index.tsx` | 4 |

### Task dependency graph:
```
Task 1 (DB migration) ─┐
                        ├─ Task 3 (Edge Function) ─┐
Task 2 (Types + API) ──┤                           ├─ Task 5 (Review screen)
                        ├─ Task 4 (Upload screen) ──┘         │
                        │                                      │
                        └──────────────────────────── Task 6 (Done screen)
```

Tasks 1 and 2 can run in parallel. Task 3 depends on Task 1. Task 4 depends on Task 2. Task 5 depends on Tasks 3 and 4. Task 6 depends on Task 5.
