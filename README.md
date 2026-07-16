# FindHiringManager

FindHiringManager helps job seekers map the likely hiring managers, stakeholders, and recruiters around a role before they apply.

## Current MVP state

- The free preview runs locally in the browser and does not call Gemini or search the web.
- Supabase email magic-link authentication is implemented in the frontend.
- Checkout, credits, and paid contact research remain disabled until their protected backend flows are complete.

## Tech stack

- Frontend: HTML, CSS, and JavaScript on GitHub Pages
- Authentication and backend: Supabase Auth and Edge Functions
- Database: Supabase PostgreSQL
- AI: Google Gemini API with Google Search grounding
- Deployment: GitHub Actions for Supabase Edge Functions

## Configure email sign-in

1. In Supabase, open **Project Settings > API Keys** and create or copy a key from the **Publishable key** section.
2. Put that `sb_publishable_...` value in `docs/config.js` as `supabasePublishableKey`.
3. Never put a Supabase secret key or service-role key in `docs/config.js`; every GitHub Pages visitor can read that file.
4. In **Authentication > URL Configuration**, set the Site URL and an exact Redirect URL to `https://sayandutta09.github.io/FindHiringManager/`.
5. Keep the Email provider enabled and confirm the magic-link email template uses Supabase's confirmation URL.
6. Configure a production SMTP provider before a broad launch so account emails use your product domain and reliable delivery.

## Local preview

Serve the `docs` directory from a local HTTP server. Add the local URL to Supabase's allowed Redirect URLs only while testing, and remove unnecessary development URLs before launch.

## Disclaimer

Paid research will use publicly available web information. It will not scrape LinkedIn or access private LinkedIn data. Users must verify every suggested person, role, company, and source before outreach.
