// FindHiringManager — Edge Function: analyze-job
// This function receives a job description, calls Gemini API with Google Search
// grounding, and returns structured contact suggestions.
// Deployment trigger: config fix

import { GoogleGenAI } from "https://esm.sh/@google/genai@1.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers — allows the frontend to call this function from any origin
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Parse the request body
    const { jobDescription } = await req.json();

    if (!jobDescription || jobDescription.trim().length < 20) {
      return new Response(
        JSON.stringify({
          error:
            "Please provide a job description (at least 20 characters long).",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Initialize the Gemini client
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    // 3. Build the prompt
    const prompt = `You are a networking research assistant. Given the following job description, your task is to:

1. Extract: company name, job title, department, location
2. Search for REAL people on LinkedIn who currently work at this company
3. Find exactly:
   - 2 probable hiring managers (people who would manage this role — typically 1-2 levels above)
   - 2 stakeholders (team leads, directors in related departments who would work with this role)
   - 2 recruiters (talent acquisition / HR professionals at this company)

For each person, provide:
- Full name (real, verified via search)
- Current job title
- LinkedIn profile URL (if findable via Google search)
- A 1-2 sentence reason why reaching out to them makes sense for this specific role

CRITICAL RULES:
- Only include REAL people you found via Google search. Do NOT invent or hallucinate names.
- If you cannot find enough real people, return fewer contacts and set "confidence" to "low".
- LinkedIn URLs should be real linkedin.com/in/ URLs found in search results.
- If you can't find a LinkedIn URL, set linkedinUrl to null.

Return your response as valid JSON matching this EXACT schema (no markdown, no code fences, just raw JSON):
{
  "company": "string",
  "jobTitle": "string",
  "department": "string or null",
  "location": "string or null",
  "contacts": [
    {
      "name": "string",
      "title": "string",
      "category": "hiring_manager" | "stakeholder" | "recruiter",
      "linkedinUrl": "string or null",
      "reason": "string",
      "confidence": "high" | "medium" | "low"
    }
  ]
}

Here is the job description:
---
${jobDescription}
---`;

    // 4. Call Gemini with Google Search grounding
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    // 5. Parse the response
    let resultText = response.text ?? "";

    // Clean up: remove markdown code fences if Gemini wraps the JSON
    resultText = resultText
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/gi, "")
      .trim();

    let parsedResult;
    try {
      parsedResult = JSON.parse(resultText);
    } catch {
      // If JSON parsing fails, return the raw text with an error
      return new Response(
        JSON.stringify({
          error: "Failed to parse AI response. Please try again.",
          rawResponse: resultText,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 6. Save to database (best-effort — don't fail if this errors)
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase.from("searches").insert({
        job_description: jobDescription.substring(0, 5000), // Limit size
        company_name: parsedResult.company || null,
        job_title: parsedResult.jobTitle || null,
        results: parsedResult,
      });
    } catch (dbError) {
      // Log but don't fail — search results are more important
      console.error("Failed to save to database:", dbError);
    }

    // 7. Return the results
    return new Response(JSON.stringify(parsedResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge Function error:", error);

    return new Response(
      JSON.stringify({
        error:
          "Something went wrong while analyzing the job description. Please try again.",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
