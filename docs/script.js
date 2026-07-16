// ============================================================
// FindHiringManager - Frontend Logic
// The free preview runs locally. No backend or Gemini call occurs.
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
    const jobInput = document.getElementById("job-description");
    const inputSection = document.getElementById("input-section");
    const collapsedSearch = document.getElementById("collapsed-search");
    const editSearchBtn = document.getElementById("edit-search-btn");
    const charCount = document.getElementById("char-count");
    const analyzeBtn = document.getElementById("analyze-btn");
    const errorSection = document.getElementById("error-section");
    const errorMessage = document.getElementById("error-message");
    const resultsSection = document.getElementById("results-section");
    const faqSection = document.getElementById("faq-section");
    const contactsTableBody = document.getElementById("contacts-table-body");
    const previewSummary = document.getElementById("preview-summary");
    const dismissErrorBtn = document.getElementById("dismiss-error-btn");

    const categoryLabels = {
        hiring_manager: "Hiring manager candidate",
        stakeholder: "Stakeholder candidate",
        recruiter: "Recruiter / talent contact"
    };

    jobInput.addEventListener("input", function () {
        charCount.textContent = jobInput.value.length + " characters";
    });

    analyzeBtn.addEventListener("click", previewJob);

    dismissErrorBtn.addEventListener("click", function () {
        errorSection.style.display = "none";
    });

    editSearchBtn.addEventListener("click", function () {
        expandSearchInput();
        jobInput.focus();
    });

    function previewJob() {
        const description = jobInput.value.trim();

        if (description.length < 40) {
            showError("Please paste more of the job description so the preview has enough context.");
            return;
        }

        hideError();

        const preview = createLocalPreview(description);
        displayPreview(preview);
        collapseSearchInput(preview, description);
    }

    function createLocalPreview(description) {
        const normalized = normalizeText(description);
        const lines = description
            .split(/\r?\n/)
            .map(function (line) { return line.trim(); })
            .filter(Boolean);

        return {
            company: detectCompany(lines, normalized),
            jobTitle: detectJobTitle(lines, normalized),
            department: detectDepartment(normalized),
            seniority: detectSeniority(normalized),
            contacts: [
                { category: "hiring_manager" },
                { category: "hiring_manager" },
                { category: "stakeholder" },
                { category: "stakeholder" },
                { category: "recruiter" },
                { category: "recruiter" }
            ]
        };
    }

    function displayPreview(preview) {
        contactsTableBody.innerHTML = preview.contacts.map(function (contact) {
            return createContactRow(contact);
        }).join("");

        const facts = [
            usableValue(preview.company) ? "Company: " + preview.company : "",
            usableValue(preview.jobTitle) ? "Role: " + preview.jobTitle : "",
            "Function: " + preview.department,
            "Seniority: " + preview.seniority
        ].filter(Boolean);

        previewSummary.textContent = facts.join(" | ")
            + ". No web search or Gemini request has run yet.";

        resultsSection.style.display = "block";
        faqSection.style.display = "block";
        resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function createContactRow(contact) {
        const type = categoryLabels[contact.category] || "Contact candidate";

        return "<tr>"
            + '<td><span class="type-pill">' + escapeHtml(type) + "</span></td>"
            + '<td><span class="locked-value locked-name">Locked</span></td>'
            + '<td><span class="locked-value locked-role">Locked</span></td>'
            + '<td><span class="locked-lines" aria-label="Relevance locked">'
            + '<span class="locked-line"></span>'
            + '<span class="locked-line locked-line-medium"></span>'
            + '<span class="locked-line locked-line-short"></span>'
            + "</span></td>"
            + '<td><span class="locked-link">Locked</span></td>'
            + "</tr>";
    }

    function collapseSearchInput(preview, description) {
        const labelParts = [preview.company, preview.jobTitle].filter(usableValue);
        const label = labelParts.length ? labelParts.join(" - ") : "Local preview prepared";
        const shortDescription = description.length > 170
            ? description.slice(0, 170) + "..."
            : description;

        inputSection.classList.add("is-collapsed");
        collapsedSearch.innerHTML = '<div class="collapsed-title">' + escapeHtml(label) + "</div>"
            + '<div class="collapsed-preview">' + escapeHtml(shortDescription) + "</div>";
        collapsedSearch.style.display = "block";
        editSearchBtn.style.display = "inline-flex";
    }

    function expandSearchInput() {
        inputSection.classList.remove("is-collapsed");
        collapsedSearch.style.display = "none";
        editSearchBtn.style.display = "none";
        resultsSection.style.display = "none";
        faqSection.style.display = "none";
        hideError();
    }

    function detectCompany(lines, text) {
        const patterns = [
            /company\s*[:\-]\s*([A-Z][A-Za-z0-9&.,' -]{2,60})/i,
            /join\s+([A-Z][A-Za-z0-9&.,' -]{2,60})\s+(?:as|to|and|,|\.)/,
            /([A-Z][A-Za-z0-9&.,' -]{2,60})\s+(?:is|are)\s+(?:hiring|seeking|looking for)/
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) return cleanDetectedValue(match[1]);
        }

        const candidate = lines.find(function (line) {
            return line.length >= 2
                && line.length <= 55
                && /^[A-Z0-9][A-Za-z0-9&.,' -]+$/.test(line)
                && !looksLikeJobTitle(line)
                && !/apply|job|role|remote|hybrid|full.?time|posted|applicant|salary/i.test(line);
        });

        return candidate ? cleanDetectedValue(candidate) : "Not clearly detected";
    }

    function detectJobTitle(lines, text) {
        const labeled = text.match(/(?:job title|role|position)\s*[:\-]\s*([A-Za-z0-9,&'()\/+ -]{4,80})/i);
        if (labeled && labeled[1]) return cleanDetectedValue(labeled[1]);

        const candidate = lines.find(function (line) {
            return line.length >= 4 && line.length <= 90 && looksLikeJobTitle(line);
        });

        return candidate ? cleanDetectedValue(candidate) : "Not clearly detected";
    }

    function detectDepartment(text) {
        const departments = [
            { label: "Engineering", terms: ["software", "engineer", "developer", "frontend", "backend", "devops", "infrastructure"] },
            { label: "Product", terms: ["product manager", "product management", "roadmap", "user research"] },
            { label: "Sales", terms: ["sales", "account executive", "business development", "revenue", "quota", "pipeline"] },
            { label: "Marketing", terms: ["marketing", "growth", "campaign", "brand", "demand generation", "content"] },
            { label: "Customer Success", terms: ["customer success", "account manager", "renewal", "implementation", "support"] },
            { label: "Data / Analytics", terms: ["data", "analytics", "business intelligence", "machine learning", "scientist"] },
            { label: "Design", terms: ["design", "ux", "ui", "researcher", "visual"] },
            { label: "People / Recruiting", terms: ["recruiter", "talent", "people partner", "human resources"] },
            { label: "Operations", terms: ["operations", "program manager", "process", "logistics", "strategy"] },
            { label: "Finance", terms: ["finance", "accounting", "fp&a", "controller", "financial"] }
        ];

        const lower = text.toLowerCase();
        const match = departments.find(function (department) {
            return department.terms.some(function (term) {
                return lower.includes(term);
            });
        });

        return match ? match.label : "Not clearly detected";
    }

    function detectSeniority(text) {
        const lower = text.toLowerCase();
        if (/\b(chief|cxo|vp|vice president|head of|director)\b/.test(lower)) return "Leadership / director";
        if (/\b(staff|principal|senior|sr\.?|lead)\b/.test(lower)) return "Senior / lead";
        if (/\b(manager|management)\b/.test(lower)) return "Manager";
        if (/\b(junior|entry|associate|intern)\b/.test(lower)) return "Early career";
        return "Not clearly detected";
    }

    function usableValue(value) {
        return value && value !== "Not clearly detected";
    }

    function normalizeText(value) {
        return value.replace(/\s+/g, " ").trim();
    }

    function looksLikeJobTitle(value) {
        return /\b(manager|engineer|designer|analyst|recruiter|specialist|consultant|director|lead|partner|executive|developer|scientist|marketer|operator|architect|product|sales|marketing|success|operations|finance|data)\b/i.test(value)
            && !/responsibilities|requirements|qualifications|benefits|about|apply|salary|location/i.test(value);
    }

    function cleanDetectedValue(value) {
        return value
            .replace(/\s+/g, " ")
            .replace(/[|].*$/g, "")
            .replace(/\s+(is|are|as|to|and|we|our)\s*$/i, "")
            .replace(/[.,;: -]+$/g, "")
            .trim();
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
});
