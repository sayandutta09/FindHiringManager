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
    const authOpenBtn = document.getElementById("auth-open-btn");
    const accountSummary = document.getElementById("account-summary");
    const accountEmail = document.getElementById("account-email");
    const signOutBtn = document.getElementById("sign-out-btn");
    const unlockSignInBtn = document.getElementById("unlock-sign-in-btn");
    const authContextMessage = document.getElementById("auth-context-message");
    const authDialog = document.getElementById("auth-dialog");
    const authDialogClose = document.getElementById("auth-dialog-close");
    const authForm = document.getElementById("auth-form");
    const authEmail = document.getElementById("auth-email");
    const sendMagicLinkBtn = document.getElementById("send-magic-link-btn");
    const authStatus = document.getElementById("auth-status");
    const authSetup = getAuthSetup();
    const authClient = createAuthClient(authSetup);
    let magicLinkCooldownTimer = null;

    const categoryLabels = {
        hiring_manager: "Hiring manager candidate",
        stakeholder: "Stakeholder candidate",
        recruiter: "Recruiter / talent contact"
    };

    jobInput.addEventListener("input", function () {
        charCount.textContent = jobInput.value.length + " characters";
    });

    analyzeBtn.addEventListener("click", previewJob);
    authOpenBtn.addEventListener("click", openAuthDialog);
    unlockSignInBtn.addEventListener("click", openAuthDialog);
    authDialogClose.addEventListener("click", closeAuthDialog);
    authForm.addEventListener("submit", sendMagicLink);
    signOutBtn.addEventListener("click", signOut);

    authDialog.addEventListener("click", function (event) {
        if (event.target === authDialog) closeAuthDialog();
    });

    dismissErrorBtn.addEventListener("click", function () {
        errorSection.style.display = "none";
    });

    editSearchBtn.addEventListener("click", function () {
        expandSearchInput();
        jobInput.focus();
    });

    initializeAuth();

    function getAuthSetup() {
        const config = window.FIND_HIRING_MANAGER_CONFIG || {};
        const supabaseUrl = String(config.supabaseUrl || "").trim();
        const publishableKey = String(config.supabasePublishableKey || "").trim();

        if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) {
            return { error: "Sign-in is not configured with a valid Supabase project URL." };
        }

        if (!/^sb_publishable_[A-Za-z0-9._-]+$/.test(publishableKey)) {
            return { error: "Sign-in needs a Supabase publishable key before it can be used." };
        }

        if (!window.supabase || typeof window.supabase.createClient !== "function") {
            return { error: "The sign-in service could not load. Please refresh and try again." };
        }

        return { supabaseUrl: supabaseUrl, publishableKey: publishableKey, error: null };
    }

    function createAuthClient(setup) {
        if (setup.error) return null;

        return window.supabase.createClient(setup.supabaseUrl, setup.publishableKey, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
                flowType: "pkce"
            }
        });
    }

    async function initializeAuth() {
        const redirectError = getAuthRedirectError();

        if (!authClient) {
            authOpenBtn.textContent = "Sign-in setup";
            unlockSignInBtn.textContent = "Sign-in setup";
            authEmail.disabled = true;
            sendMagicLinkBtn.disabled = true;
            authContextMessage.textContent = "Account sign-in is being connected. The free preview remains available.";
            setAuthStatus(authSetup.error, "error");
            return;
        }

        authClient.auth.onAuthStateChange(function (event, session) {
            renderAuthState(session);

            if (event === "SIGNED_IN") {
                cleanAuthRedirectUrl();
                closeAuthDialog();
            }
        });

        try {
            const result = await authClient.auth.getSession();
            if (result.error) throw result.error;

            renderAuthState(result.data.session);

            if (redirectError) {
                openAuthDialog();
                setAuthStatus(redirectError, "error");
            }

            cleanAuthRedirectUrl();
        } catch (error) {
            renderAuthState(null);
            openAuthDialog();
            setAuthStatus(readableAuthError(error), "error");
            cleanAuthRedirectUrl();
        }
    }

    function renderAuthState(session) {
        const email = session && session.user && session.user.email
            ? session.user.email
            : "";

        if (email) {
            authOpenBtn.hidden = true;
            accountSummary.hidden = false;
            accountEmail.textContent = email;
            accountEmail.title = email;
            unlockSignInBtn.hidden = true;
            authContextMessage.textContent = "Signed in as " + email + ". Credits and protected search are coming in the next MVP steps.";
            return;
        }

        authOpenBtn.hidden = false;
        accountSummary.hidden = true;
        accountEmail.textContent = "";
        accountEmail.removeAttribute("title");
        unlockSignInBtn.hidden = false;
        authContextMessage.textContent = "Sign in with your email so future credits and searches can belong to your account.";
    }

    function openAuthDialog() {
        if (!authDialog.open) authDialog.showModal();

        if (authSetup.error) {
            setAuthStatus(authSetup.error, "error");
            return;
        }

        window.setTimeout(function () {
            authEmail.focus();
        }, 0);
    }

    function closeAuthDialog() {
        if (authDialog.open) authDialog.close();
    }

    async function sendMagicLink(event) {
        event.preventDefault();

        if (!authClient) {
            setAuthStatus(authSetup.error, "error");
            return;
        }

        const email = authEmail.value.trim().toLowerCase();
        if (!email || !authEmail.checkValidity()) {
            authEmail.reportValidity();
            return;
        }

        sendMagicLinkBtn.disabled = true;
        sendMagicLinkBtn.textContent = "Sending...";
        setAuthStatus("", "");

        try {
            const result = await authClient.auth.signInWithOtp({
                email: email,
                options: {
                    emailRedirectTo: getAuthRedirectUrl(),
                    shouldCreateUser: true
                }
            });

            if (result.error) throw result.error;

            setAuthStatus("Check your inbox for the secure sign-in link. You can close this window while you wait.", "success");
            startMagicLinkCooldown(60);
        } catch (error) {
            sendMagicLinkBtn.disabled = false;
            sendMagicLinkBtn.textContent = "Send magic link";
            setAuthStatus(readableAuthError(error), "error");
        }
    }

    function startMagicLinkCooldown(seconds) {
        window.clearInterval(magicLinkCooldownTimer);
        let remaining = seconds;

        sendMagicLinkBtn.disabled = true;
        sendMagicLinkBtn.textContent = "Resend in " + remaining + "s";

        magicLinkCooldownTimer = window.setInterval(function () {
            remaining -= 1;

            if (remaining <= 0) {
                window.clearInterval(magicLinkCooldownTimer);
                magicLinkCooldownTimer = null;
                sendMagicLinkBtn.disabled = false;
                sendMagicLinkBtn.textContent = "Send magic link";
                return;
            }

            sendMagicLinkBtn.textContent = "Resend in " + remaining + "s";
        }, 1000);
    }

    async function signOut() {
        if (!authClient) return;

        signOutBtn.disabled = true;
        signOutBtn.textContent = "Signing out...";

        try {
            const result = await authClient.auth.signOut({ scope: "local" });
            if (result.error) throw result.error;
            renderAuthState(null);
        } catch (error) {
            openAuthDialog();
            setAuthStatus(readableAuthError(error), "error");
        } finally {
            signOutBtn.disabled = false;
            signOutBtn.textContent = "Sign out";
        }
    }

    function getAuthRedirectUrl() {
        return window.location.origin + window.location.pathname;
    }

    function getAuthRedirectError() {
        const query = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

        return query.get("error_description")
            || hash.get("error_description")
            || query.get("error")
            || hash.get("error")
            || "";
    }

    function cleanAuthRedirectUrl() {
        const url = new URL(window.location.href);
        const authQueryKeys = ["code", "error", "error_code", "error_description"];
        let changed = false;

        authQueryKeys.forEach(function (key) {
            if (url.searchParams.has(key)) {
                url.searchParams.delete(key);
                changed = true;
            }
        });

        if (/access_token|refresh_token|error_description|error_code/.test(url.hash)) {
            url.hash = "";
            changed = true;
        }

        if (changed) {
            window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
        }
    }

    function setAuthStatus(message, type) {
        authStatus.textContent = message || "";
        authStatus.classList.toggle("is-error", type === "error");
        authStatus.classList.toggle("is-success", type === "success");
    }

    function readableAuthError(error) {
        if (!error) return "Sign-in could not be completed. Please try again.";
        if (typeof error === "string") return error;
        return error.message || "Sign-in could not be completed. Please try again.";
    }

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
        const company = detectCompany(lines, description);
        const jobTitle = detectJobTitle(lines, description);

        return {
            company: company,
            jobTitle: jobTitle,
            department: detectDepartment(normalized, jobTitle),
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
            /company\s*[:\-]\s*([^\r\n]{2,60})/i,
            /join\s+([A-Z][A-Za-z0-9&.,' -]{2,60}?)\s+(?:as|to|and|,|\.)/,
            /([A-Z][A-Za-z0-9&.,' -]{2,60}?)\s+(?:is|are)\s+(?:hiring|seeking|looking for)/
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
        const labeled = text.match(/(?:job title|role|position)\s*[:\-]\s*([^\r\n]{4,80})/i);
        if (labeled && labeled[1]) return cleanDetectedValue(labeled[1]);

        const candidate = lines.find(function (line) {
            return line.length >= 4 && line.length <= 90 && looksLikeJobTitle(line);
        });

        return candidate ? cleanDetectedValue(candidate) : "Not clearly detected";
    }

    function detectDepartment(text, jobTitle) {
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

        const titleLower = String(jobTitle || "").toLowerCase();
        const titleMatch = departments.find(function (department) {
            return department.terms.some(function (term) {
                return titleLower.includes(term);
            });
        });

        if (titleMatch) return titleMatch.label;

        const lower = text.toLowerCase();
        const descriptionMatch = departments.find(function (department) {
            return department.terms.some(function (term) {
                return lower.includes(term);
            });
        });

        return descriptionMatch ? descriptionMatch.label : "Not clearly detected";
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
            .replace(/\s+(?:company|job title|role|position|location|about us|responsibilities|requirements|qualifications)\s*[:\-].*$/i, "")
            .replace(/\s+(?:we are|you will|you'll|this role|the role)\b.*$/i, "")
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
