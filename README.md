# FindHiringManager

Paste a job description → Get 6 relevant contacts (hiring managers, stakeholders, recruiters) found via AI-powered public web search.

## How It Works

1. Paste any job description into the text box
2. Click **"Find Contacts"**
3. Get 6 real people to network with:
   - 2 probable **Hiring Managers**
   - 2 **Stakeholders** to reach out to
   - 2 probable **Recruiters**
4. Each contact includes their name, title, LinkedIn profile (when available), and why they're relevant

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (hosted on GitHub Pages)
- **Backend**: Supabase Edge Functions (serverless)
- **Database**: Supabase PostgreSQL (search history)
- **AI**: Google Gemini API with Google Search grounding
- **Deployment**: GitHub Actions (auto-deploy on push)

## ⚠️ Disclaimer

This tool only uses **publicly available** information indexed by Google. It does not scrape LinkedIn or access any private data. Always verify contacts on LinkedIn before reaching out.
