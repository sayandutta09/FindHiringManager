// ============================================================
// FindHiringManager — Frontend Logic
// ============================================================

// ----- CONFIGURATION -----
const SUPABASE_URL = "https://orgskwzpfjyuhiadrxhl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZ3Nrd3pwZmp5dWhpYWRyeGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODAxMTIsImV4cCI6MjA5MzE1NjExMn0.xJc17kMFrQk5IK2l6z2i5COe1Ab_8bD3ZHRku3PAPMA";

// Initialize Supabase client (loaded from CDN in index.html)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----- DOM ELEMENTS -----
const jobInput = document.getElementById("job-description");
const charCount = document.getElementById("char-count");
const analyzeBtn = document.getElementById("analyze-btn");
const errorSection = document.getElementById("error-section");
const errorMessage = document.getElementById("error-message");
const resultsSection = document.getElementById("results-section");
const jobSummary = document.getElementById("job-summary");
const historyList = document.getElementById("history-list");
const dismissErrorBtn = document.getElementById("dismiss-error-btn");

// Category grid containers
const grids = {
    hiring_manager: document.getElementById("hiring-managers-grid"),
    stakeholder: document.getElementById("stakeholders-grid"),
    recruiter: document.getElementById("recruiters-grid"),
};

// ----- EVENT LISTENERS -----
jobInput.addEventListener("input", () => {
    charCount.textContent = `${jobInput.value.length} characters`;
});

analyzeBtn.addEventListener("click", analyzeJob);

dismissErrorBtn.addEventListener("click", () => {
    errorSection.style.display = "none";
});

// Load recent searches on page load
document.addEventListener("DOMContentLoaded", loadHistory);

// ----- MAIN FUNCTION: Analyze Job -----
async function analyzeJob() {
    const description = jobInput.value.trim();

    // Validation
    if (description.length < 20) {
        showError("Please paste a longer job description (at least 20 characters).");
        return;
    }

    // Show loading state
    setLoading(true);
    hideError();
    resultsSection.style.display = "none";

    try {
        // Call the Supabase Edge Function
        const { data, error } = await supabase.functions.invoke("analyze-job", {
            body: { jobDescription: description },
        });

        if (error) {
            throw new Error(error.message || "Failed to analyze job description.");
        }

        if (data.error) {
            throw new Error(data.error);
        }

        // Display results
        displayResults(data);

        // Refresh history
        await loadHistory();
    } catch (err) {
        console.error("Analysis error:", err);
        showError(err.message || "Something went wrong. Please try again.");
    } finally {
        setLoading(false);
    }
}

// ----- DISPLAY RESULTS -----
function displayResults(data) {
    // Show the section
    resultsSection.style.display = "block";

    // Job summary tags
    const tags = [];
    if (data.company) tags.push(`🏢 ${data.company}`);
    if (data.jobTitle) tags.push(`💼 ${data.jobTitle}`);
    if (data.department) tags.push(`📂 ${data.department}`);
    if (data.location) tags.push(`📍 ${data.location}`);

    jobSummary.innerHTML = tags
        .map((t) => `<span class="summary-tag">${t}</span>`)
        .join("");

    // Clear previous contacts
    Object.values(grids).forEach((g) => (g.innerHTML = ""));

    // Group contacts by category
    const contacts = data.contacts || [];
    contacts.forEach((contact) => {
        const grid = grids[contact.category];
        if (grid) {
            grid.innerHTML += createContactCard(contact);
        }
    });

    // Smooth scroll to results
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ----- CREATE CONTACT CARD HTML -----
function createContactCard(contact) {
    const confidenceClass = `confidence-${contact.confidence || "medium"}`;
    const confidenceLabel = contact.confidence || "medium";

    const linkedinButton = contact.linkedinUrl
        ? `<a href="${escapeHtml(contact.linkedinUrl)}" target="_blank" rel="noopener noreferrer" class="contact-linkedin">
             🔗 View LinkedIn Profile
           </a>`
        : `<span class="contact-linkedin" style="opacity:0.4; cursor:default;">LinkedIn not found</span>`;

    return `
        <div class="contact-card">
            <div class="contact-name">
                ${escapeHtml(contact.name)}
                <span class="confidence-tag ${confidenceClass}">${confidenceLabel}</span>
            </div>
            <div class="contact-title">${escapeHtml(contact.title)}</div>
            <div class="contact-reason">${escapeHtml(contact.reason)}</div>
            ${linkedinButton}
        </div>
    `;
}

// ----- LOAD SEARCH HISTORY -----
async function loadHistory() {
    try {
        const { data, error } = await supabase
            .from("searches")
            .select("id, company_name, job_title, created_at")
            .order("created_at", { ascending: false })
            .limit(10);

        if (error) {
            console.error("History load error:", error);
            return;
        }

        if (!data || data.length === 0) {
            historyList.innerHTML = `<p class="history-empty">No searches yet. Paste a job description above to get started!</p>`;
            return;
        }

        historyList.innerHTML = data
            .map((item) => {
                const company = item.company_name || "Unknown Company";
                const role = item.job_title || "Unknown Role";
                const date = new Date(item.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                });
                return `
                    <div class="history-item" onclick="loadSearch('${item.id}')">
                        <div>
                            <div class="history-company">${escapeHtml(company)}</div>
                            <div class="history-role">${escapeHtml(role)}</div>
                        </div>
                        <div class="history-date">${date}</div>
                    </div>
                `;
            })
            .join("");
    } catch (err) {
        console.error("Failed to load history:", err);
    }
}

// ----- LOAD A PAST SEARCH -----
async function loadSearch(id) {
    try {
        const { data, error } = await supabase
            .from("searches")
            .select("*")
            .eq("id", id)
            .single();

        if (error || !data) return;

        // Populate the textarea
        jobInput.value = data.job_description || "";
        charCount.textContent = `${jobInput.value.length} characters`;

        // Display the saved results
        if (data.results) {
            displayResults(data.results);
        }
    } catch (err) {
        console.error("Failed to load search:", err);
    }
}

// ----- UI HELPERS -----
function setLoading(isLoading) {
    const btnText = analyzeBtn.querySelector(".btn-text");
    const btnLoading = analyzeBtn.querySelector(".btn-loading");

    if (isLoading) {
        btnText.style.display = "none";
        btnLoading.style.display = "inline-flex";
        analyzeBtn.disabled = true;
        jobInput.disabled = true;
    } else {
        btnText.style.display = "inline-flex";
        btnLoading.style.display = "none";
        analyzeBtn.disabled = false;
        jobInput.disabled = false;
    }
}

function showError(message) {
    errorMessage.textContent = message;
    errorSection.style.display = "block";
    errorSection.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideError() {
    errorSection.style.display = "none";
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}
