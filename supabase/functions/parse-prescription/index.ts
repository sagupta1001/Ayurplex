// supabase/functions/parse-prescription/index.ts
// Deno Edge Function: fetches a prescription image from Storage,
// sends it to Claude Vision for structured extraction, and stores
// the raw + parsed response on the prescriptions row.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk@0.39.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request
    const { prescription_id } = await req.json();
    if (!prescription_id) {
      return new Response(
        JSON.stringify({ error: 'prescription_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Extract user JWT from Authorization header
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Validate ownership
    if (prescription.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Not authorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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
        }
      }
    } catch (err) {
      console.error('Anthropic API error:', err);
      visionRawResponse = { error: String(err) };
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
