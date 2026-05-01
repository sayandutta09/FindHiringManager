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

    const systemInstruction = `You are an expert networking research assistant. Your task is to find SPECIFIC, REAL PEOPLE currently working at the company mentioned in the job description. Do NOT return generic job titles (like "Head of Customer Success"). You MUST use Google Search to find actual, named individuals who hold these or similar roles at the company. If you cannot find an exact match, find the closest real person in leadership or HR at that company. NEVER output generic placeholders for names. Note: The provided text is often directly copied from LinkedIn and may contain irrelevant noise (e.g. "Apply", "Save", candidate stats, connections). Ignore this noise and focus only on the actual job details and company context.`;

    const prompt = `Find exactly 6 REAL people based on this job description:
- 2 probable hiring managers or leadership figures (category: "hiring_manager")
- 2 cross-functional stakeholders (category: "stakeholder")
- 2 recruiters or talent acquisition staff (category: "recruiter")

Job Description:
---
${jobDescription.substring(0, 25000)}
---`;

    const schema = {
      type: "OBJECT",
      properties: {
        searchStrategy: { type: "STRING", description: "Explain your step-by-step strategy for identifying the company, determining the relevant departments, and finding these specific real people." },
        company: { type: "STRING" },
        jobTitle: { type: "STRING" },
        department: { type: "STRING", nullable: true },
        location: { type: "STRING", nullable: true },
        contacts: {
          type: "ARRAY",
          description: "List of exactly 6 real people found.",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING", description: "MUST be a real person's name (e.g. 'Jane Doe')" },
              title: { type: "STRING", description: "Their actual current job title" },
              category: { type: "STRING", enum: ["hiring_manager", "stakeholder", "recruiter"] },
              linkedinUrl: { type: "STRING", nullable: true },
              reason: { type: "STRING", description: "Why this specific person is relevant to the role" },
              confidence: { type: "STRING", enum: ["high", "medium", "low"] }
            },
            required: ["name", "title", "category", "reason", "confidence"]
          }
        }
      },
      required: ["searchStrategy", "company", "jobTitle", "contacts"]
    };

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema
        }
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
      parsed = JSON.parse(text);
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
