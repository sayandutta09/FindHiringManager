// ============================================================
// FindHiringManager - Frontend Logic
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
    const dismissErrorBtn = document.getElementById("dismiss-error-btn");
    const searchStatus = document.getElementById("search-status");
    const searchStatusText = document.getElementById("search-status-text");
    const statusSteps = document.getElementById("status-steps");
    const statusProgressFill = document.getElementById("status-progress-fill");

    const loadingMessages = [
        "Reading job description",
        "Identifying role",
        "Mapping decision makers",
        "Finding contacts",
        "Reviewing stakeholders",
        "Researching org chart",
        "Preparing results"
    ];

    const categoryLabels = {
        hiring_manager: "Hiring manager",
        stakeholder: "Stakeholder",
        recruiter: "Recruiter"
    };

    const expectedSearchMs = 7000;
    let loadingFrame = null;
    let loadingIndex = 0;
    let loadingStartedAt = 0;

    jobInput.addEventListener("input", function () {
        charCount.textContent = jobInput.value.length + " characters";
    });

    analyzeBtn.addEventListener("click", analyzeJob);

    dismissErrorBtn.addEventListener("click", function () {
        errorSection.style.display = "none";
    });

    editSearchBtn.addEventListener("click", function () {
        expandSearchInput();
        jobInput.focus();
    });

    async function analyzeJob() {
        const description = jobInput.value.trim();

        if (description.length < 20) {
            showError("Please paste a longer job description.");
            return;
        }

        setLoading(true);
        hideError();
        resultsSection.style.display = "none";
        faqSection.style.display = "none";
        showInProgressSearch(description);

        try {
            await wait(expectedSearchMs);

            const previewData = createLockedPreview();
            displayResults(previewData);
            collapseSearchInput(previewData, description);
        } catch (err) {
            console.error("Analysis error:", err);
            expandSearchInput();
            showError(err.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    function displayResults(data) {
        const contacts = Array.isArray(data.contacts) ? data.contacts : [];

        resultsSection.style.display = "block";
        faqSection.style.display = "block";
        contactsTableBody.innerHTML = contacts.map(function (contact) {
            return createContactRow(contact);
        }).join("");

        resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function createLockedPreview() {
        return {
            previewOnly: true,
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

    function createContactRow(contact) {
        const type = categoryLabels[contact.category] || "Contact";

        return "<tr>"
            + '<td><span class="type-pill">' + escapeHtml(type) + "</span></td>"
            + '<td><span class="locked-value locked-name">Locked</span></td>'
            + '<td><span class="locked-value locked-role">Locked</span></td>'
            + '<td><span class="locked-lines" aria-label="Rationale locked">'
            + '<span class="locked-line"></span>'
            + '<span class="locked-line locked-line-medium"></span>'
            + '<span class="locked-line locked-line-short"></span>'
            + "</span></td>"
            + '<td><span class="locked-link">Locked</span></td>'
            + "</tr>";
    }

    function collapseSearchInput(data, description) {
        const label = data.previewOnly
            ? "Preview prepared"
            : [data.company, data.jobTitle].filter(Boolean).join(" - ") || "Search complete";
        const preview = description.length > 170 ? description.slice(0, 170) + "..." : description;

        inputSection.classList.add("is-collapsed");
        collapsedSearch.innerHTML = '<div class="collapsed-title">' + escapeHtml(label) + "</div>"
            + '<div class="collapsed-preview">' + escapeHtml(preview) + "</div>";
        collapsedSearch.style.display = "block";
        editSearchBtn.style.display = "inline-flex";
    }

    function showInProgressSearch(description) {
        const preview = description.length > 170 ? description.slice(0, 170) + "..." : description;

        inputSection.classList.add("is-collapsed");
        collapsedSearch.innerHTML = '<div class="collapsed-title">Research in progress</div>'
            + '<div class="collapsed-preview">' + escapeHtml(preview) + "</div>";
        collapsedSearch.style.display = "block";
        editSearchBtn.style.display = "inline-flex";
    }

    function expandSearchInput() {
        inputSection.classList.remove("is-collapsed");
        collapsedSearch.style.display = "none";
        editSearchBtn.style.display = "none";
    }

    function setLoading(isLoading) {
        const btnText = analyzeBtn.querySelector(".btn-text");
        const btnLoading = analyzeBtn.querySelector(".btn-loading");

        if (isLoading) {
            btnText.style.display = "none";
            btnLoading.style.display = "inline-flex";
            analyzeBtn.disabled = true;
            editSearchBtn.disabled = true;
            jobInput.disabled = true;
            startLoadingMessages();
        } else {
            btnText.style.display = "inline-flex";
            btnLoading.style.display = "none";
            analyzeBtn.disabled = false;
            editSearchBtn.disabled = false;
            jobInput.disabled = false;
            stopLoadingMessages();
        }
    }

    function startLoadingMessages() {
        loadingIndex = 0;
        loadingStartedAt = window.performance.now();
        searchStatus.style.display = "block";
        statusSteps.innerHTML = loadingMessages.map(function (message, index) {
            return '<span class="status-step" data-index="' + index + '">' + escapeHtml(message) + "</span>";
        }).join("");
        updateLoadingMessage(0);
        loadingFrame = window.requestAnimationFrame(animateLoadingMessages);
    }

    function stopLoadingMessages() {
        if (loadingFrame) {
            window.cancelAnimationFrame(loadingFrame);
            loadingFrame = null;
        }
        updateLoadingMessage(1);
        searchStatus.style.display = "none";
    }

    function animateLoadingMessages(timestamp) {
        const elapsed = timestamp - loadingStartedAt;
        const progress = Math.min(elapsed / expectedSearchMs, 0.94);
        updateLoadingMessage(progress);
        loadingFrame = window.requestAnimationFrame(animateLoadingMessages);
    }

    function updateLoadingMessage(progress) {
        const stageProgress = progress * loadingMessages.length;
        loadingIndex = Math.min(Math.floor(stageProgress), loadingMessages.length - 1);

        searchStatusText.textContent = loadingMessages[loadingIndex];
        statusProgressFill.style.width = Math.round(progress * 100) + "%";
        document.querySelectorAll(".status-step").forEach(function (step) {
            const index = Number(step.getAttribute("data-index"));
            step.classList.toggle("is-active", index === loadingIndex);
            step.classList.toggle("is-done", index < loadingIndex);
        });
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorSection.style.display = "block";
        errorSection.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function hideError() {
        errorSection.style.display = "none";
    }

    function wait(ms) {
        return new Promise(function (resolve) {
            window.setTimeout(resolve, ms);
        });
    }

    function escapeHtml(text) {
        if (!text) return "";
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }
});
