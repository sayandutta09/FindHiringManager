import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

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
    const { jobDescription } = await req.json();

    if (!jobDescription || jobDescription.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: "Please provide a longer job description." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured in Supabase. Please add GEMINI_API_KEY to Edge Function Secrets." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `You are a networking research assistant. Given this job description, find relevant contacts.

Return ONLY raw JSON (no markdown, no code fences) with this EXACT structure:
{
  "company": "string",
  "jobTitle": "string",
  "department": "string or null",
  "location": "string or null",
  "contacts": [
    {
      "name": "string",
      "title": "string",
      "category": "hiring_manager",
      "linkedinUrl": "string or null",
      "reason": "string",
      "confidence": "high"
    }
  ]
}

Find exactly:
- 2 hiring managers (category: "hiring_manager")
- 2 stakeholders (category: "stakeholder")
- 2 recruiters (category: "recruiter")

Job Description:
---
${jobDescription.substring(0, 3000)}
---`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
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
    
    let text = "";
    try {
      text = geminiData.candidates[0].content.parts[0].text;
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Unexpected response format from Gemini API." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanText = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanText);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Could not parse AI response into valid JSON." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const dbUrl = Deno.env.get("SUPABASE_URL");
      const dbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (dbUrl && dbKey) {
         const db = createClient(dbUrl, dbKey);
         await db.from("searches").insert({
           job_description: jobDescription.substring(0, 5000),
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
