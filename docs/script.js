// ============================================================
// FindHiringManager — Frontend Logic
// ============================================================

// ----- CONFIGURATION -----
const SUPABASE_URL = "https://orgskwzpfjyuhiadrxhl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9yZ3Nrd3pwZmp5dWhpYWRyeGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODAxMTIsImV4cCI6MjA5MzE1NjExMn0.xJc17kMFrQk5IK2l6z2i5COe1Ab_8bD3ZHRku3PAPMA";

// ----- INIT -----
// Wrap everything in DOMContentLoaded so we know the DOM + CDN scripts are ready
document.addEventListener("DOMContentLoaded", function () {

    // Safety check — make sure Supabase CDN loaded
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
        console.error("Supabase CDN failed to load.");
        alert("App failed to load. Please refresh the page.");
        return;
    }

    // Create Supabase client
    const { createClient } = window.supabase;
    const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

    const grids = {
        hiring_manager: document.getElementById("hiring-managers-grid"),
        stakeholder: document.getElementById("stakeholders-grid"),
        recruiter: document.getElementById("recruiters-grid"),
    };

    // ----- EVENT LISTENERS -----
    jobInput.addEventListener("input", function () {
        charCount.textContent = jobInput.value.length + " characters";
    });

    analyzeBtn.addEventListener("click", analyzeJob);

    dismissErrorBtn.addEventListener("click", function () {
        errorSection.style.display = "none";
    });

    // Load history on startup
    loadHistory();

    // ----- MAIN FUNCTION -----
    async function analyzeJob() {
        const description = jobInput.value.trim();

        if (description.length < 20) {
            showError("Please paste a longer job description (at least 20 characters).");
            return;
        }

        setLoading(true);
        hideError();
        resultsSection.style.display = "none";

        try {
            const { data, error } = await db.functions.invoke("analyze-job", {
                body: { jobDescription: description },
            });

            if (error) throw new Error(error.message || "Failed to call Edge Function.");
            if (data && data.error) throw new Error(data.error);
            if (!data) throw new Error("No data returned from the server.");

            displayResults(data);
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
        resultsSection.style.display = "block";

        const tags = [];
        if (data.company) tags.push("🏢 " + data.company);
        if (data.jobTitle) tags.push("💼 " + data.jobTitle);
        if (data.department) tags.push("📂 " + data.department);
        if (data.location) tags.push("📍 " + data.location);

        jobSummary.innerHTML = tags.map(function (t) {
            return '<span class="summary-tag">' + escapeHtml(t) + "</span>";
        }).join("");

        Object.values(grids).forEach(function (g) { g.innerHTML = ""; });

        var contacts = data.contacts || [];
        contacts.forEach(function (contact) {
            var grid = grids[contact.category];
            if (grid) grid.innerHTML += createContactCard(contact);
        });

        resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // ----- CONTACT CARD -----
    function createContactCard(contact) {
        var confidenceClass = "confidence-" + (contact.confidence || "medium");
        var confidenceLabel = contact.confidence || "medium";

        var linkedinHtml = contact.linkedinUrl
            ? '<a href="' + escapeHtml(contact.linkedinUrl) + '" target="_blank" rel="noopener noreferrer" class="contact-linkedin">🔗 View LinkedIn Profile</a>'
            : '<span class="contact-linkedin" style="opacity:0.4;cursor:default;">LinkedIn not found</span>';

        return '<div class="contact-card">'
            + '<div class="contact-name">' + escapeHtml(contact.name)
            + '<span class="confidence-tag ' + confidenceClass + '">' + confidenceLabel + '</span></div>'
            + '<div class="contact-title">' + escapeHtml(contact.title) + '</div>'
            + '<div class="contact-reason">' + escapeHtml(contact.reason) + '</div>'
            + linkedinHtml
            + '</div>';
    }

    // ----- LOAD HISTORY -----
    async function loadHistory() {
        try {
            var result = await db.from("searches")
                .select("id, company_name, job_title, created_at")
                .order("created_at", { ascending: false })
                .limit(10);

            var data = result.data;
            if (!data || data.length === 0) {
                historyList.innerHTML = '<p class="history-empty">No searches yet. Paste a job description above to get started!</p>';
                return;
            }

            historyList.innerHTML = data.map(function (item) {
                var company = item.company_name || "Unknown Company";
                var role = item.job_title || "Unknown Role";
                var date = new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                return '<div class="history-item" data-id="' + item.id + '">'
                    + '<div><div class="history-company">' + escapeHtml(company) + '</div>'
                    + '<div class="history-role">' + escapeHtml(role) + '</div></div>'
                    + '<div class="history-date">' + date + '</div>'
                    + '</div>';
            }).join("");

            // Attach click events to history items
            document.querySelectorAll(".history-item").forEach(function (el) {
                el.addEventListener("click", function () {
                    loadSearch(el.getAttribute("data-id"));
                });
            });

        } catch (err) {
            console.error("Failed to load history:", err);
        }
    }

    // ----- LOAD PAST SEARCH -----
    async function loadSearch(id) {
        try {
            var result = await db.from("searches").select("*").eq("id", id).single();
            var data = result.data;
            if (!data) return;
            jobInput.value = data.job_description || "";
            charCount.textContent = jobInput.value.length + " characters";
            if (data.results) displayResults(data.results);
        } catch (err) {
            console.error("Failed to load search:", err);
        }
    }

    // ----- UI HELPERS -----
    function setLoading(isLoading) {
        var btnText = analyzeBtn.querySelector(".btn-text");
        var btnLoading = analyzeBtn.querySelector(".btn-loading");
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
        var div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

}); // end DOMContentLoaded
