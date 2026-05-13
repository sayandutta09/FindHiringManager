import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-unlock-token",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

type AnalyzeJobRequest = {
  jobDescription?: string;
  unlockToken?: string;
};

function getCreditGateError(req: Request, body: AnalyzeJobRequest): string | null {
  if (Deno.env.get("REQUIRE_CREDITS") !== "true") {
    return null;
  }

  const paidSearchToken = Deno.env.get("PAID_SEARCH_TOKEN");
  if (!paidSearchToken) {
    return "Paid search is not configured yet. Please purchase credits once checkout is available.";
  }

  const suppliedToken = req.headers.get("x-unlock-token") || body.unlockToken || "";
  if (suppliedToken !== paidSearchToken) {
    return "Credits are required before generating unlocked contacts.";
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "Edge Function is online!" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json() as AnalyzeJobRequest;
    const { jobDescription } = body;

    if (!jobDescription || jobDescription.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: "Please provide a longer job description." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creditGateError = getCreditGateError(req, body);
    if (creditGateError) {
      return new Response(
        JSON.stringify({ error: creditGateError, code: "CREDIT_REQUIRED" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured in Supabase. Please add GEMINI_API_KEY to Edge Function Secrets." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemInstruction = `You are an expert networking research assistant. Your task is to find SPECIFIC, REAL PEOPLE currently working at the company mentioned in the job description. Do NOT return generic job titles (like "Head of Customer Success"). You MUST use Google Search to find actual, named individuals who hold these or similar roles at the company. If you cannot find an exact match, find the closest real person in leadership or HR at that company. NEVER output generic placeholders for names. Note: The provided text is often directly copied from LinkedIn and may contain irrelevant noise (e.g. "Apply", "Save", candidate stats, connections). Ignore this noise and focus only on the actual job details and company context.

You MUST return ONLY raw JSON (no markdown formatting, no code blocks) with the following EXACT structure:
{
  "searchStrategy": "string (Explain your step-by-step strategy for identifying the company and finding these specific real people)",
  "company": "string",
  "jobTitle": "string",
  "department": "string or null",
  "location": "string or null",
  "contacts": [
    {
      "name": "string (MUST be a real person's name)",
      "title": "string (Their actual current job title)",
      "category": "hiring_manager | stakeholder | recruiter",
      "linkedinUrl": "string or null",
      "reason": "string (Why this specific person is relevant to the role)",
      "confidence": "high | medium | low"
    }
  ]
}`;

    const prompt = `Find exactly 6 REAL people based on this job description:
- 2 probable hiring managers or leadership figures (category: "hiring_manager")
- 2 cross-functional stakeholders (category: "stakeholder")
- 2 recruiters or talent acquisition staff (category: "recruiter")

Job Description:
---
${jobDescription.substring(0, 25000)}
---`;

    const geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }]
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      return new Response(
        JSON.stringify({ error: `Gemini API Error (${geminiResponse.status}): ${errorText.substring(0, 500)}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await geminiResponse.json();
    
    let parsed;
    try {
      const text = geminiData.candidates[0].content.parts[0].text;
      const cleanText = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
      parsed = JSON.parse(cleanText);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Could not parse AI response into valid JSON. Model might have failed to generate expected structure." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const dbUrl = Deno.env.get("SUPABASE_URL");
      const dbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (dbUrl && dbKey) {
         const db = createClient(dbUrl, dbKey);
         await db.from("searches").insert({
           job_description: jobDescription.substring(0, 25000),
           company_name: parsed.company || null,
           job_title: parsed.jobTitle || null,
           results: parsed,
         });
      }
    } catch (dbErr) {
      console.error("DB save failed:", dbErr.message);
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Edge Function Error: " + err.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
