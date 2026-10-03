/* =========================================================
   M & C WEDDING
   ADMIN CONTROL CENTER
   COMPLETE ADMIN.JS
   MATCHED TO CURRENT ADMIN.HTML
   ========================================================= */

"use strict";


/* =========================================================
   GLOBAL STATE
   ========================================================= */

let currentSession = null;
let currentAdminProfile = null;

let authBusy = false;
let authListenerStarted = false;

let dashboardOpening = false;
let dashboardInitialized = false;

let countdownTimer = null;

let guestsCache = [];
let giftsCache = [];

let qrScanner = null;
let qrScannerRunning = false;
let lastQRValue = "";
let qrProcessing = false;


/* =========================================================
   DOM HELPER
   ========================================================= */

function $(id) {
    return document.getElementById(id);
}


/* =========================================================
   SUPABASE
   ========================================================= */

function getSupabaseClient() {

    if (
        typeof window !== "undefined" &&
        window.supabaseClient
    ) {
        return window.supabaseClient;
    }

    if (
        typeof window !== "undefined" &&
        window.__mcSupabaseClient
    ) {
        return window.__mcSupabaseClient;
    }

    if (
        typeof window !== "undefined" &&
        window.supabase &&
        typeof window.supabase.createClient === "function"
    ) {

        try {

            if (
                typeof SUPABASE_URL !== "undefined" &&
                typeof SUPABASE_PUBLISHABLE_KEY !== "undefined"
            ) {

                window.__mcSupabaseClient =
                    window.supabase.createClient(
                        SUPABASE_URL,
                        SUPABASE_PUBLISHABLE_KEY
                    );

                return window.__mcSupabaseClient;
            }

        } catch (error) {

            console.error(
                "Supabase client creation failed:",
                error
            );
        }
    }

    if (
        typeof supabaseClient !== "undefined" &&
        supabaseClient
    ) {
        return supabaseClient;
    }

    return null;
}


/* =========================================================
   BASIC HELPERS
   ========================================================= */

function setText(id, value) {

    const element = $(id);

    if (element) {
        element.textContent = String(
            value ?? ""
        );
    }
}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function showMessage(
    id,
    message,
    type = "info"
) {

    const element = $(id);

    if (!element) {
        return;
    }

    element.textContent =
        String(message || "");

    element.classList.remove(
        "success",
        "error",
        "warning",
        "info"
    );

    element.classList.add(type);

    if (message) {

        element.hidden = false;
        element.style.display = "";

    } else {

        element.hidden = true;
        element.style.display = "none";
    }
}


function clearMessage(id) {

    const element = $(id);

    if (!element) {
        return;
    }

    element.textContent = "";
    element.hidden = true;
    element.style.display = "none";
}


/* =========================================================
   SESSION
   ========================================================= */

async function getCurrentSession() {

    const client =
        getSupabaseClient();

    if (!client) {

        throw new Error(
            "Supabase client is not available."
        );
    }

    const {
        data,
        error
    } = await client.auth.getSession();

    if (error) {
        throw error;
    }

    return data?.session || null;
}


/* =========================================================
   VERIFY ADMIN PROFILE
   ========================================================= */

async function verifyAdminProfile(userId) {

    const client =
        getSupabaseClient();

    if (!client || !userId) {
        return null;
    }

    try {

        const {
            data,
            error
        } = await client
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

        if (error) {

            console.error(
                "Administrator profile error:",
                error
            );

            showMessage(
                "authMessage",
                "Unable to verify administrator account.",
                "error"
            );

            return null;
        }

        if (!data) {

            showMessage(
                "authMessage",
                "Administrator profile was not found.",
                "error"
            );

            return null;
        }

        const role =
            String(
                data.role || ""
            ).trim().toLowerCase();

        if (
            role !== "admin" &&
            role !== "administrator"
        ) {

            showMessage(
                "authMessage",
                "This account does not have administrator access.",
                "error"
            );

            return null;
        }

        currentAdminProfile = data;

        console.log(
            "Administrator account verified."
        );

        return data;

    } catch (error) {

        console.error(
            "Admin verification failed:",
            error
        );

        showMessage(
            "authMessage",
            "Administrator verification failed.",
            "error"
        );

        return null;
    }
}


/* =========================================================
   EMAIL DISPLAY
   ========================================================= */

function updateAdminEmailDisplays(email) {

    const value =
        email || "";

    if ($("adminEmail")) {
        $("adminEmail").textContent = value;
    }

    if ($("accountEmail")) {
        $("accountEmail").textContent = value;
    }
}


/* =========================================================
   SHOW DASHBOARD
   ========================================================= */

function openDashboard() {

    if (dashboardOpening) {

        console.log(
            "Dashboard is already opening."
        );

        return;
    }

    dashboardOpening = true;

    const authSection =
        $("authSection");

    const dashboard =
        $("adminDashboard");

    const adminContent =
        document.querySelector(
            ".admin-content"
        );

    if (!dashboard) {

        console.error(
            "ERROR: #adminDashboard was not found."
        );

        dashboardOpening = false;

        return;
    }


    /* -----------------------------------------------------
       HIDE LOGIN
    ----------------------------------------------------- */

    if (authSection) {

        authSection.hidden = true;

        authSection.style.setProperty(
            "display",
            "none",
            "important"
        );

        authSection.style.setProperty(
            "visibility",
            "hidden",
            "important"
        );

        authSection.classList.add(
            "hidden"
        );
    }


    /* -----------------------------------------------------
       SHOW DASHBOARD
    ----------------------------------------------------- */

    dashboard.hidden = false;

    dashboard.classList.remove(
        "hidden"
    );

    dashboard.style.setProperty(
        "display",
        "block",
        "important"
    );

    dashboard.style.setProperty(
        "visibility",
        "visible",
        "important"
    );

    dashboard.style.setProperty(
        "opacity",
        "1",
        "important"
    );


    if (adminContent) {

        adminContent.style.setProperty(
            "display",
            "block",
            "important"
        );

        adminContent.style.setProperty(
            "visibility",
            "visible",
            "important"
        );

        adminContent.style.setProperty(
            "opacity",
            "1",
            "important"
        );
    }


    updateAdminEmailDisplays(
        currentSession?.user?.email || ""
    );


    /* -----------------------------------------------------
       INITIALIZE DASHBOARD ONCE
    ----------------------------------------------------- */

    if (!dashboardInitialized) {

        dashboardInitialized = true;

        try {
            setupDashboardNavigation();
        } catch (error) {
            console.error(
                "Navigation initialization error:",
                error
            );
        }

        try {
            setupGuestSystem();
        } catch (error) {
            console.error(
                "Guest initialization error:",
                error
            );
        }

        try {
            setupInvitationSystem();
        } catch (error) {
            console.error(
                "Invitation initialization error:",
                error
            );
        }

        try {
            setupGiftSystem();
        } catch (error) {
            console.error(
                "Gift initialization error:",
                error
            );
        }

        try {
            setupAccountSystem();
        } catch (error) {
            console.error(
                "Account initialization error:",
                error
            );
        }

        try {
            setupQuickActions();
        } catch (error) {
            console.error(
                "Quick action initialization error:",
                error
            );
        }

        try {
            setupQRSystem();
        } catch (error) {
            console.error(
                "QR initialization error:",
                error
            );
        }

        try {
            setupKeyboardControls();
        } catch (error) {
            console.error(
                "Keyboard initialization error:",
                error
            );
        }

        startCountdown();


        /* -------------------------------------------------
           LOAD DATA WITHOUT BLOCKING DASHBOARD
        ------------------------------------------------- */

        Promise.resolve(
            loadGuests()
        ).catch(
            error =>
                console.error(
                    "Guest loading:",
                    error
                )
        );

        Promise.resolve(
            loadGifts()
        ).catch(
            error =>
                console.error(
                    "Gift loading:",
                    error
                )
        );
    }


    /* -----------------------------------------------------
       ALWAYS SHOW DASHBOARD HOME FIRST
    ----------------------------------------------------- */

    showDashboardSection(
        "dashboardSection"
    );


    dashboardOpening = false;

    console.log(
        "M & C Wedding Control Center is now visible."
    );
}


/* =========================================================
   HIDE DASHBOARD
   ========================================================= */

function hideDashboard() {

    const dashboard =
        $("adminDashboard");

    const authSection =
        $("authSection");

    if (dashboard) {

        dashboard.hidden = true;

        dashboard.style.setProperty(
            "display",
            "none",
            "important"
        );

        dashboard.style.setProperty(
            "visibility",
            "hidden",
            "important"
        );
    }

    if (authSection) {

        authSection.hidden = false;

        authSection.style.removeProperty(
            "display"
        );

        authSection.style.removeProperty(
            "visibility"
        );

        authSection.classList.remove(
            "hidden"
        );
    }

    dashboardOpening = false;
    dashboardInitialized = false;
}


/* =========================================================
   VERIFY ADMIN AND OPEN DASHBOARD
   ========================================================= */

async function verifyAdminAndOpenDashboard(
    session
) {

    if (!session?.user?.id) {

        console.error(
            "No authenticated administrator session."
        );

        return false;
    }

    if (
        dashboardInitialized ||
        dashboardOpening
    ) {

        return true;
    }

    currentSession =
        session;

    const profile =
        await verifyAdminProfile(
            session.user.id
        );

    if (!profile) {

        currentSession = null;
        currentAdminProfile = null;

        hideDashboard();

        return false;
    }

    openDashboard();

    return true;
}


/* =========================================================
   LOGIN
   ========================================================= */

async function login() {

    if (authBusy) {
        return;
    }

    const client =
        getSupabaseClient();

    if (!client) {

        showMessage(
            "authMessage",
            "Supabase is not configured correctly.",
            "error"
        );

        return;
    }

    const email =
        String(
            $("loginEmail")?.value || ""
        ).trim();

    const password =
        String(
            $("loginPassword")?.value || ""
        );

    if (!email) {

        showMessage(
            "authMessage",
            "Please enter your email address.",
            "error"
        );

        return;
    }

    if (!password) {

        showMessage(
            "authMessage",
            "Please enter your password.",
            "error"
        );

        return;
    }

    authBusy = true;

    const button =
        $("loginBtn");

    if (button) {

        button.disabled = true;

        button.dataset.oldText =
            button.textContent;

        button.textContent =
            "Signing in...";
    }

    clearMessage(
        "authMessage"
    );

    try {

        const {
            data,
            error
        } = await client.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw error;
        }

        if (!data?.session) {

            throw new Error(
                "No authenticated session was returned."
            );
        }

        currentSession =
            data.session;

        console.log(
            "Login successful."
        );

    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        showMessage(
            "authMessage",
            error?.message ||
            "Login failed.",
            "error"
        );

    } finally {

        authBusy = false;

        if (button) {

            button.disabled = false;

            button.textContent =
                button.dataset.oldText ||
                "Login";
        }
    }
}


/* =========================================================
   AUTH BUTTONS
   ========================================================= */

function setupAuthButtons() {

    const loginButton =
        $("loginBtn");

    if (
        loginButton &&
        loginButton.dataset.ready !== "true"
    ) {

        loginButton.dataset.ready =
            "true";

        loginButton.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                await login();
            }
        );
    }


    const showPasswordButton =
        $("showSetPasswordBtn");

    if (
        showPasswordButton &&
        showPasswordButton.dataset.ready !== "true"
    ) {

        showPasswordButton.dataset.ready =
            "true";

        showPasswordButton.addEventListener(
            "click",
            event => {

                event.preventDefault();

                showSetPasswordPanel();
            }
        );
    }


    const cancelPasswordButton =
        $("cancelSetPasswordBtn");

    if (
        cancelPasswordButton &&
        cancelPasswordButton.dataset.ready !== "true"
    ) {

        cancelPasswordButton.dataset.ready =
            "true";

        cancelPasswordButton.addEventListener(
            "click",
            event => {

                event.preventDefault();

                hideSetPasswordPanel();
            }
        );
    }


    const setPasswordForm =
        $("setPasswordForm");

    if (
        setPasswordForm &&
        setPasswordForm.dataset.ready !== "true"
    ) {

        setPasswordForm.dataset.ready =
            "true";

        setPasswordForm.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                await updatePassword();
            }
        );
    }


    const logoutButton =
        $("logoutBtn");

    if (
        logoutButton &&
        logoutButton.dataset.ready !== "true"
    ) {

        logoutButton.dataset.ready =
            "true";

        logoutButton.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                await logout();
            }
        );
    }
}


/* =========================================================
   PASSWORD PANEL
   ========================================================= */

function showSetPasswordPanel() {

    const loginForm =
        $("loginForm");

    const form =
        $("setPasswordForm");

    if (loginForm) {

        loginForm.hidden = true;

        loginForm.style.display =
            "none";
    }

    if (form) {

        form.hidden = false;

        form.style.display =
            "";
    }
}


function hideSetPasswordPanel() {

    const loginForm =
        $("loginForm");

    const form =
        $("setPasswordForm");

    if (form) {

        form.hidden = true;

        form.style.display =
            "none";
    }

    if (loginForm) {

        loginForm.hidden = false;

        loginForm.style.display =
            "";
    }

    clearMessage(
        "authMessage"
    );
}


/* =========================================================
   UPDATE PASSWORD
   ========================================================= */

async function updatePassword() {

    const client =
        getSupabaseClient();

    if (!client) {
        return;
    }

    const password =
        String(
            $("newPassword")?.value || ""
        );

    const confirmPassword =
        String(
            $("confirmNewPassword")?.value || ""
        );

    if (password.length < 6) {

        showMessage(
            "authMessage",
            "Password must contain at least 6 characters.",
            "error"
        );

        return;
    }

    if (
        password !==
        confirmPassword
    ) {

        showMessage(
            "authMessage",
            "Passwords do not match.",
            "error"
        );

        return;
    }

    const button =
        $("updatePasswordBtn");

    if (button) {
        button.disabled = true;
    }

    try {

        const {
            error
        } = await client.auth.updateUser({
            password
        });

        if (error) {
            throw error;
        }

        showMessage(
            "authMessage",
            "Password updated successfully.",
            "success"
        );

        if ($("newPassword")) {
            $("newPassword").value = "";
        }

        if ($("confirmNewPassword")) {
            $("confirmNewPassword").value = "";
        }

        hideSetPasswordPanel();

    } catch (error) {

        console.error(
            "Password update error:",
            error
        );

        showMessage(
            "authMessage",
            error?.message ||
            "Unable to update password.",
            "error"
        );

    } finally {

        if (button) {
            button.disabled = false;
        }
    }
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout() {

    const client =
        getSupabaseClient();

    if (!client) {
        return;
    }

    try {

        await stopQRScanner();

        const {
            error
        } = await client.auth.signOut();

        if (error) {
            throw error;
        }

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

    } finally {

        currentSession = null;
        currentAdminProfile = null;

        dashboardInitialized = false;
        dashboardOpening = false;

        guestsCache = [];
        giftsCache = [];

        if (countdownTimer) {

            clearInterval(
                countdownTimer
            );

            countdownTimer = null;
        }

        hideDashboard();
    }
}


/* =========================================================
   AUTH STATE LISTENER
   ========================================================= */

function setupAuthStateListener() {

    if (authListenerStarted) {
        return;
    }

    const client =
        getSupabaseClient();

    if (!client) {

        console.error(
            "Cannot start authentication listener."
        );

        return;
    }

    authListenerStarted = true;

    client.auth.onAuthStateChange(
        async (
            event,
            session
        ) => {

            console.log(
                "Auth event:",
                event
            );


            if (
                event ===
                "INITIAL_SESSION"
            ) {

                if (!session) {

                    hideDashboard();

                    return;
                }

                currentSession =
                    session;

                if (
                    !dashboardInitialized &&
                    !dashboardOpening
                ) {

                    await verifyAdminAndOpenDashboard(
                        session
                    );
                }

                return;
            }


            if (
                event ===
                "SIGNED_IN"
            ) {

                if (!session) {
                    return;
                }

                currentSession =
                    session;

                if (
                    !dashboardInitialized &&
                    !dashboardOpening
                ) {

                    await verifyAdminAndOpenDashboard(
                        session
                    );
                }

                return;
            }


            if (
                event ===
                "TOKEN_REFRESHED"
            ) {

                if (session) {
                    currentSession =
                        session;
                }

                return;
            }


            if (
                event ===
                "USER_UPDATED"
            ) {

                if (session) {
                    currentSession =
                        session;
                }

                return;
            }


            if (
                event ===
                "SIGNED_OUT"
            ) {

                currentSession = null;
                currentAdminProfile = null;

                dashboardInitialized = false;
                dashboardOpening = false;

                guestsCache = [];
                giftsCache = [];

                hideDashboard();
            }
        }
    );
}


/* =========================================================
   DASHBOARD NAVIGATION
   ========================================================= */

function setupDashboardNavigation() {

    const buttons =
        document.querySelectorAll(
            "[data-section]"
        );

    buttons.forEach(
        button => {

            if (
                button.dataset.navReady ===
                "true"
            ) {
                return;
            }

            const sectionId =
                String(
                    button.dataset.section || ""
                ).trim();

            if (!sectionId) {
                return;
            }

            const section =
                $(sectionId);

            if (!section) {

                console.warn(
                    "Navigation target not found:",
                    sectionId
                );

                return;
            }

            button.dataset.navReady =
                "true";

            button.type =
                "button";

            button.addEventListener(
                "click",
                event => {

                    event.preventDefault();
                    event.stopPropagation();

                    showDashboardSection(
                        sectionId
                    );
                }
            );
        }
    );

    console.log(
        "Dashboard navigation ready:",
        buttons.length,
        "buttons"
    );
}


/* =========================================================
   SHOW DASHBOARD SECTION
   ========================================================= */

function showDashboardSection(
    sectionName
) {

    const target =
        $(sectionName);

    if (!target) {

        console.error(
            "Dashboard section not found:",
            sectionName
        );

        return;
    }

    const sections =
        document.querySelectorAll(
            ".admin-page-section"
        );


    /* -----------------------------------------------------
       HIDE EVERY SECTION
    ----------------------------------------------------- */

    sections.forEach(
        section => {

            section.classList.remove(
                "active"
            );

            section.classList.add(
                "hidden"
            );

            section.hidden =
                true;

            section.setAttribute(
                "aria-hidden",
                "true"
            );

            section.style.setProperty(
                "display",
                "none",
                "important"
            );

            section.style.setProperty(
                "visibility",
                "hidden",
                "important"
            );

            section.style.setProperty(
                "opacity",
                "0",
                "important"
            );
        }
    );


    /* -----------------------------------------------------
       SHOW TARGET
    ----------------------------------------------------- */

    target.classList.remove(
        "hidden"
    );

    target.classList.add(
        "active"
    );

    target.hidden =
        false;

    target.setAttribute(
        "aria-hidden",
        "false"
    );

    target.style.setProperty(
        "display",
        "block",
        "important"
    );

    target.style.setProperty(
        "visibility",
        "visible",
        "important"
    );

    target.style.setProperty(
        "opacity",
        "1",
        "important"
    );


    /* -----------------------------------------------------
       SIDEBAR ACTIVE STATE
    ----------------------------------------------------- */

    document
        .querySelectorAll(
            ".sidebar-item[data-section]"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.section ===
                    sectionName
                );
            }
        );


    /* -----------------------------------------------------
       LOAD MODULE DATA
    ----------------------------------------------------- */

    if (
        sectionName ===
        "guestsSection"
    ) {

        renderGuests();
    }


    if (
        sectionName ===
        "invitationsSection"
    ) {

        renderInvitationGuestList();
    }


    if (
        sectionName ===
        "giftsSection"
    ) {

        updateGiftStatistics();
    }


    if (
        sectionName ===
        "accountSection"
    ) {

        updateAccountInformation();
    }


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });


    console.log(
        "Opened dashboard section:",
        sectionName
    );
}


/* =========================================================
   ACCOUNT INFORMATION
   ========================================================= */

function updateAccountInformation() {

    const email =
        currentSession?.user?.email ||
        "";

    updateAdminEmailDisplays(
        email
    );
}


/* =========================================================
   COUNTDOWN
   ========================================================= */

function startCountdown() {

    if (countdownTimer) {

        clearInterval(
            countdownTimer
        );
    }

    function update() {

        const weddingDate =
            new Date(
                "2026-12-19T10:00:00+02:00"
            );

        const now =
            new Date();

        let difference =
            weddingDate.getTime() -
            now.getTime();

        if (difference < 0) {
            difference = 0;
        }

        const seconds =
            Math.floor(
                difference / 1000
            );

        const days =
            Math.floor(
                seconds / 86400
            );

        const hours =
            Math.floor(
                (seconds % 86400) / 3600
            );

        const minutes =
            Math.floor(
                (seconds % 3600) / 60
            );

        const secs =
            seconds % 60;

        setText(
            "countdownDays",
            String(days).padStart(2, "0")
        );

        setText(
            "countdownHours",
            String(hours).padStart(2, "0")
        );

        setText(
            "countdownMinutes",
            String(minutes).padStart(2, "0")
        );

        setText(
            "countdownSeconds",
            String(secs).padStart(2, "0")
        );
    }

    update();

    countdownTimer =
        setInterval(
            update,
            1000
        );
}


/* =========================================================
   GUEST SYSTEM
   ========================================================= */

function setupGuestSystem() {

    const addButton =
        $("addGuestBtn");

    if (
        addButton &&
        addButton.dataset.ready !== "true"
    ) {

        addButton.dataset.ready =
            "true";

        addButton.type =
            "button";

        addButton.addEventListener(
            "click",
            event => {

                event.preventDefault();

                openGuestModal();
            }
        );
    }


    const closeButton =
        $("closeGuestModal");

    if (
        closeButton &&
        closeButton.dataset.ready !== "true"
    ) {

        closeButton.dataset.ready =
            "true";

        closeButton.addEventListener(
            "click",
            event => {

                event.preventDefault();

                closeGuestModal();
            }
        );
    }


    const cancelButton =
        $("cancelGuestBtn");

    if (
        cancelButton &&
        cancelButton.dataset.ready !== "true"
    ) {

        cancelButton.dataset.ready =
            "true";

        cancelButton.addEventListener(
            "click",
            event => {

                event.preventDefault();

                closeGuestModal();
            }
        );
    }


    const form =
        $("addGuestForm");

    if (
        form &&
        form.dataset.ready !== "true"
    ) {

        form.dataset.ready =
            "true";

        form.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                await addGuest();
            }
        );
    }


    const search =
        $("guestSearch");

    if (
        search &&
        search.dataset.ready !== "true"
    ) {

        search.dataset.ready =
            "true";

        search.addEventListener(
            "input",
            renderGuests
        );
    }


    document
        .querySelectorAll(
            "[data-guest-filter]"
        )
        .forEach(
            button => {

                if (
                    button.dataset.filterReady ===
                    "true"
                ) {
                    return;
                }

                button.dataset.filterReady =
                    "true";

                button.type =
                    "button";

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        document
                            .querySelectorAll(
                                "[data-guest-filter]"
                            )
                            .forEach(
                                item => {

                                    item.classList.remove(
                                        "active"
                                    );
                                }
                            );

                        button.classList.add(
                            "active"
                        );

                        renderGuests();
                    }
                );
            }
        );
}


function openGuestModal() {

    const modal =
        $("addGuestModal");

    if (!modal) {
        return;
    }

    modal.hidden =
        false;

    modal.style.display =
        "flex";

    clearMessage(
        "addGuestMessage"
    );

    $("newGuestName")?.focus();
}


function closeGuestModal() {

    const modal =
        $("addGuestModal");

    if (!modal) {
        return;
    }

    modal.hidden =
        true;

    modal.style.display =
        "none";

    $("addGuestForm")?.reset();

    clearMessage(
        "addGuestMessage"
    );
}


/* =========================================================
   LOAD GUESTS
   ========================================================= */

async function loadGuests() {

    const client =
        getSupabaseClient();

    if (!client) {
        return;
    }

    try {

        let result =
            await client
                .from("guests")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );

        if (
            result.error &&
            String(
                result.error.message || ""
            )
                .toLowerCase()
                .includes("created_at")
        ) {

            result =
                await client
                    .from("guests")
                    .select("*");
        }

        if (result.error) {
            throw result.error;
        }

        guestsCache =
            Array.isArray(result.data)
                ? result.data
                : [];

        renderGuests();

        updateGuestStatistics();

        renderInvitationGuestList();

        populateGiftGuestList();

        console.log(
            "Guests loaded:",
            guestsCache.length
        );

    } catch (error) {

        console.error(
            "Guests loading error:",
            error
        );

        guestsCache = [];

        renderGuests();

        updateGuestStatistics();

        renderInvitationGuestList();

        populateGiftGuestList();
    }
}


/* =========================================================
   ADD GUEST
   ========================================================= */

async function addGuest() {

    const client =
        getSupabaseClient();

    if (!client) {
        return;
    }

    const name =
        String(
            $("newGuestName")?.value || ""
        ).trim();

    const phone =
        String(
            $("newGuestPhone")?.value || ""
        ).trim();

    const email =
        String(
            $("newGuestEmail")?.value || ""
        ).trim();

    const type =
        String(
            $("newGuestType")?.value ||
            "single"
        ).trim();

    if (!name) {

        showMessage(
            "addGuestMessage",
            "Please enter the guest name.",
            "error"
        );

        return;
    }

    const button =
        $("saveGuestBtn");

    if (button) {
        button.disabled = true;
    }

    try {

        let result =
            await client
                .from("guests")
                .insert({
                    name,
                    phone:
                        phone || null,
                    email:
                        email || null,
                    guest_type:
                        type,
                    rsvp_status:
                        "pending"
                })
                .select()
                .single();

        if (
            result.error &&
            (
                String(
                    result.error.message || ""
                )
                    .toLowerCase()
                    .includes("guest_type") ||
                String(
                    result.error.message || ""
                )
                    .toLowerCase()
                    .includes("rsvp_status")
            )
        ) {

            result =
                await client
                    .from("guests")
                    .insert({
                        name,
                        phone:
                            phone || null,
                        email:
                            email || null
                    })
                    .select()
                    .single();
        }

        if (result.error) {
            throw result.error;
        }

        showMessage(
            "addGuestMessage",
            "Guest added successfully.",
            "success"
        );

        await loadGuests();

        setTimeout(
            closeGuestModal,
            600
        );

    } catch (error) {

        console.error(
            "Add guest error:",
            error
        );

        showMessage(
            "addGuestMessage",
            error?.message ||
            "Unable to add guest.",
            "error"
        );

    } finally {

        if (button) {
            button.disabled = false;
        }
    }
}


/* =========================================================
   GUEST HELPERS
   ========================================================= */

function getGuestStatus(guest) {

    return String(
        guest?.rsvp_status ||
        guest?.status ||
        guest?.response ||
        "pending"
    )
        .trim()
        .toLowerCase();
}


function getGuestType(guest) {

    return String(
        guest?.guest_type ||
        guest?.type ||
        "single"
    )
        .trim()
        .toLowerCase();
}


/* =========================================================
   GET REAL GUEST DATABASE ID
   ========================================================= */

function getGuestDatabaseId(guest) {

    if (!guest) {
        return null;
    }

    const possibleId =
        guest.id ||
        guest.guest_id ||
        guest.uuid ||
        null;

    if (
        possibleId !== null &&
        possibleId !== undefined &&
        String(possibleId).trim() !== ""
    ) {

        return String(
            possibleId
        ).trim();
    }

    return null;
}


/* =========================================================
   FIND GUEST IN CACHE
   ========================================================= */

function findMatchingGuest(
    guest
) {

    if (!guest || !Array.isArray(guestsCache)) {
        return null;
    }

    const guestId =
        getGuestDatabaseId(
            guest
        );

    if (guestId) {

        const byId =
            guestsCache.find(
                item =>
                    getGuestDatabaseId(
                        item
                    ) === guestId
            );

        if (byId) {
            return byId;
        }
    }


    const email =
        String(
            guest.email || ""
        )
            .trim()
            .toLowerCase();

    const phone =
        String(
            guest.phone || ""
        )
            .trim();

    const name =
        String(
            guest.name ||
            guest.full_name ||
            ""
        )
            .trim()
            .toLowerCase();


    return (
        guestsCache.find(
            item => {

                const itemEmail =
                    String(
                        item.email || ""
                    )
                        .trim()
                        .toLowerCase();

                const itemPhone =
                    String(
                        item.phone || ""
                    )
                        .trim();

                const itemName =
                    String(
                        item.name ||
                        item.full_name ||
                        ""
                    )
                        .trim()
                        .toLowerCase();


                if (
                    email &&
                    itemEmail &&
                    email === itemEmail
                ) {
                    return true;
                }


                if (
                    phone &&
                    itemPhone &&
                    phone === itemPhone
                ) {
                    return true;
                }


                if (
                    name &&
                    itemName &&
                    name === itemName
                ) {
                    return true;
                }


                return false;
            }
        ) ||
        null
    );
}


/* =========================================================
   GUEST STATISTICS
   ========================================================= */

function updateGuestStatistics() {

    let accepted = 0;
    let regretted = 0;
    let pending = 0;

    guestsCache.forEach(
        guest => {

            const status =
                getGuestStatus(
                    guest
                );

            if (
                status === "accepted" ||
                status === "accept"
            ) {

                accepted++;

            } else if (
                status === "regretted" ||
                status === "regret" ||
                status === "declined"
            ) {

                regretted++;

            } else {

                pending++;
            }
        }
    );

    const total =
        guestsCache.length;

    setText(
        "guestTotalInvited",
        total
    );

    setText(
        "guestTotalAccepted",
        accepted
    );

    setText(
        "guestTotalRegretted",
        regretted
    );

    setText(
        "guestTotalPending",
        pending
    );

    setText(
        "totalInvited",
        total
    );

    setText(
        "totalAccepted",
        accepted
    );

    setText(
        "totalRegretted",
        regretted
    );

    setText(
        "totalPending",
        pending
    );
}


/* =========================================================
   RENDER GUESTS
   ========================================================= */

function renderGuests() {

    const body =
        $("guestTableBody");

    if (!body) {
        return;
    }

    const search =
        String(
            $("guestSearch")?.value || ""
        )
            .trim()
            .toLowerCase();

    const activeFilter =
        document.querySelector(
            "[data-guest-filter].active"
        );

    const filter =
        activeFilter?.dataset.guestFilter ||
        "all";

    const filtered =
        guestsCache.filter(
            guest => {

                const name =
                    String(
                        guest.name ||
                        guest.full_name ||
                        ""
                    ).toLowerCase();

                const phone =
                    String(
                        guest.phone ||
                        ""
                    ).toLowerCase();

                const email =
                    String(
                        guest.email ||
                        ""
                    ).toLowerCase();

                const status =
                    getGuestStatus(
                        guest
                    );

                const matchesSearch =
                    !search ||
                    name.includes(search) ||
                    phone.includes(search) ||
                    email.includes(search);

                let matchesFilter =
                    true;

                if (
                    filter ===
                    "accepted"
                ) {

                    matchesFilter =
                        status === "accepted" ||
                        status === "accept";
                }

                if (
                    filter ===
                    "regretted"
                ) {

                    matchesFilter =
                        status === "regretted" ||
                        status === "regret" ||
                        status === "declined";
                }

                if (
                    filter ===
                    "pending"
                ) {

                    matchesFilter =
                        status === "pending";
                }

                return (
                    matchesSearch &&
                    matchesFilter
                );
            }
        );

    body.innerHTML = "";

    filtered.forEach(
        guest => {

            const row =
                document.createElement(
                    "tr"
                );

            const name =
                guest.name ||
                guest.full_name ||
                "Unnamed guest";

            row.innerHTML = `
                <td>${escapeHTML(name)}</td>
                <td>${escapeHTML(guest.phone || "-")}</td>
                <td>${escapeHTML(guest.email || "-")}</td>
                <td>${escapeHTML(getGuestType(guest))}</td>
                <td>${escapeHTML(getGuestStatus(guest))}</td>
            `;

            body.appendChild(
                row
            );
        }
    );

    setText(
        "guestResultCount",
        filtered.length
    );

    const empty =
        $("guestEmptyState");

    if (empty) {

        empty.hidden =
            filtered.length !== 0;

        empty.style.display =
            filtered.length === 0
                ? ""
                : "none";
    }
}


/* =========================================================
   INVITATION SYSTEM
   ========================================================= */

function setupInvitationSystem() {

    const search =
        $("invitationGuestSearch");

    if (
        search &&
        search.dataset.ready !== "true"
    ) {

        search.dataset.ready =
            "true";

        search.addEventListener(
            "input",
            renderInvitationGuestList
        );
    }


    const inviteTop =
        $("inviteSomeoneTopBtn");

    if (
        inviteTop &&
        inviteTop.dataset.adminReady !== "true"
    ) {

        inviteTop.dataset.adminReady =
            "true";

        inviteTop.type =
            "button";

        /*
           IMPORTANT:
           admin.html contains the actual invitation
           modal controller. We intentionally do not
           replace that controller here.
        */

        inviteTop.addEventListener(
            "click",
            () => {

                setTimeout(
                    () => {

                        const name =
                            $("inviteName");

                        if (name) {
                            name.focus();
                        }

                    },
                    100
                );
            }
        );
    }


    const whatsapp =
        $("inviteViaWhatsAppBtn");

    if (
        whatsapp &&
        whatsapp.dataset.adminReady !== "true"
    ) {

        whatsapp.dataset.adminReady =
            "true";

        whatsapp.type =
            "button";

        whatsapp.addEventListener(
            "click",
            () => {

                if (inviteTop) {
                    inviteTop.click();
                }

                setTimeout(
                    () => {

                        const phone =
                            $("invitePhone");

                        if (phone) {
                            phone.focus();
                        }

                    },
                    120
                );
            }
        );
    }


    const email =
        $("inviteViaEmailBtn");

    if (
        email &&
        email.dataset.adminReady !== "true"
    ) {

        email.dataset.adminReady =
            "true";

        email.type =
            "button";

        email.addEventListener(
            "click",
            () => {

                if (inviteTop) {
                    inviteTop.click();
                }

                setTimeout(
                    () => {

                        const emailInput =
                            $("inviteEmail");

                        if (emailInput) {
                            emailInput.focus();
                        }

                    },
                    120
                );
            }
        );
    }


    const addGuest =
        $("inviteAddGuestBtn");

    if (
        addGuest &&
        addGuest.dataset.adminReady !== "true"
    ) {

        addGuest.dataset.adminReady =
            "true";

        addGuest.type =
            "button";

        addGuest.addEventListener(
            "click",
            event => {

                event.preventDefault();

                openGuestModal();
            }
        );
    }


    renderInvitationGuestList();
}


/* =========================================================
   INVITATION BASE URL
   ========================================================= */

function getInvitationBaseURL() {

    try {

        /*
           Resolve index.html relative to the actual
           document location.

           This works both with Live Server and after
           the project is deployed.
        */

        const url =
            new URL(
                "index.html",
                document.baseURI
            );

        url.search = "";
        url.hash = "";

        return url.href;

    } catch (error) {

        console.error(
            "INVITATION BASE URL ERROR:",
            error
        );

        /*
           Fallback for unusual environments.
        */

        const origin =
            window.location.origin;

        const pathname =
            window.location.pathname;

        const folder =
            pathname.substring(
                0,
                pathname.lastIndexOf("/") + 1
            );

        return (
            origin +
            folder +
            "index.html"
        );
    }
}


/* =========================================================
   BUILD GUEST INVITATION LINK
   ========================================================= */

function buildGuestInvitationLink(
    guestId
) {

    if (
        guestId === undefined ||
        guestId === null ||
        String(guestId).trim() === ""
    ) {

        console.warn(
            "Cannot build invitation link: guest ID is missing."
        );

        return "";
    }

    const baseURL =
        getInvitationBaseURL();

    const id =
        String(
            guestId
        ).trim();

    const invitationURL =
        new URL(
            baseURL
        );

    invitationURL.searchParams.set(
        "guest",
        id
    );

    invitationURL.hash = "";

    return invitationURL.href;
}


/* =========================================================
   RENDER INVITATION GUEST LIST
   ========================================================= */

function renderInvitationGuestList() {

    const container =
        $("invitationGuestList");

    if (!container) {
        return;
    }

    const search =
        String(
            $("invitationGuestSearch")?.value ||
            ""
        )
            .trim()
            .toLowerCase();

    const filtered =
        guestsCache.filter(
            guest => {

                const name =
                    String(
                        guest.name ||
                        guest.full_name ||
                        ""
                    ).toLowerCase();

                const phone =
                    String(
                        guest.phone ||
                        ""
                    ).toLowerCase();

                const email =
                    String(
                        guest.email ||
                        ""
                    ).toLowerCase();

                return (
                    !search ||
                    name.includes(search) ||
                    phone.includes(search) ||
                    email.includes(search)
                );
            }
        );


    if (!filtered.length) {

        container.innerHTML = `
            <div class="invite-empty">
                <i class="fa-solid fa-users"></i>
                <p>
                    ${
                        guestsCache.length
                            ? "No guests match your search."
                            : "No guests have been added yet."
                    }
                </p>
            </div>
        `;

        return;
    }


    container.innerHTML = "";


    filtered.forEach(
        guest => {

            const name =
                guest.name ||
                guest.full_name ||
                "Unnamed guest";

            const phone =
                guest.phone ||
                "No phone";

            const email =
                guest.email ||
                "No email";

            const type =
                getGuestType(
                    guest
                );

            const status =
                getGuestStatus(
                    guest
                );

            const card =
                document.createElement(
                    "div"
                );

            card.className =
                "invite-guest-item";


            card.innerHTML = `
                <div class="invite-guest-info">

                    <div class="invite-guest-avatar">
                        <i class="fa-solid fa-user"></i>
                    </div>

                    <div>
                        <strong>
                            ${escapeHTML(name)}
                        </strong>

                        <span>
                            ${escapeHTML(phone)}
                        </span>

                        <small>
                            ${escapeHTML(email)}
                        </small>

                        <small>
                            ${escapeHTML(type)}
                            •
                            ${escapeHTML(status)}
                        </small>
                    </div>

                </div>

                <button
                    type="button"
                    class="primary-btn invitation-select-guest"
                >
                    <i class="fa-solid fa-paper-plane"></i>
                    Invite
                </button>
            `;


            const button =
                card.querySelector(
                    ".invitation-select-guest"
                );

            if (button) {

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();
                        event.stopPropagation();

                        openInvitationForGuest(
                            guest
                        );
                    }
                );
            }


            card.addEventListener(
                "click",
                event => {

                    if (
                        event.target.closest(
                            "button"
                        )
                    ) {
                        return;
                    }

                    openInvitationForGuest(
                        guest
                    );
                }
            );


            container.appendChild(
                card
            );
        }
    );
}


/* =========================================================
   OPEN INVITATION FOR SELECTED GUEST
   ========================================================= */

function openInvitationForGuest(
    guest
) {

    if (!guest) {

        console.error(
            "Cannot open invitation: guest object is missing."
        );

        return;
    }


    /* -----------------------------------------------------
       GET REAL DATABASE ID
    ----------------------------------------------------- */

    let guestId =
        getGuestDatabaseId(
            guest
        );


    /* -----------------------------------------------------
       IF ID IS MISSING, FIND GUEST IN CACHE
    ----------------------------------------------------- */

    if (!guestId) {

        const matchedGuest =
            findMatchingGuest(
                guest
            );

        if (matchedGuest) {

            guestId =
                getGuestDatabaseId(
                    matchedGuest
                );

            if (guestId) {

                guest = {
                    ...matchedGuest,
                    ...guest,
                    id: guestId
                };
            }
        }
    }


    /* -----------------------------------------------------
       STOP IF DATABASE ID STILL DOES NOT EXIST
    ----------------------------------------------------- */

    if (!guestId) {

        console.error(
            "Guest has no database ID:",
            guest
        );

        alert(
            "This guest does not have a valid database ID. Please reload the guest list and try again."
        );

        return;
    }


    /* -----------------------------------------------------
       NORMALIZE GUEST OBJECT
    ----------------------------------------------------- */

    guest = {
        ...guest,
        id: guestId
    };


    /* -----------------------------------------------------
       BUILD PERSONALIZED INVITATION LINK
    ----------------------------------------------------- */

    const invitationLink =
        buildGuestInvitationLink(
            guestId
        );


    if (!invitationLink) {

        console.error(
            "Unable to build invitation link.",
            guest
        );

        alert(
            "Unable to create the personalized invitation link."
        );

        return;
    }


    console.log(
        "Opening personalized invitation:",
        {
            guestId,
            guestName:
                guest.name ||
                guest.full_name ||
                "Guest",
            invitationLink
        }
    );


    /* -----------------------------------------------------
       SAVE CURRENT INVITATION
    ----------------------------------------------------- */

    window.currentInvitationGuest = {
        ...guest,
        id: guestId
    };

    window.currentInvitationLink =
        invitationLink;


    /* -----------------------------------------------------
       USE THE INLINE CONTROLLER FROM ADMIN.HTML
    ----------------------------------------------------- */

    if (
        typeof window.openInviteSomeone ===
        "function"
    ) {

        /*
           THIS IS THE MAIN FIX.

           Instead of clicking the generic
           "Invite Someone" button first, pass the
           selected guest directly to the controller.
        */

        try {

            window.openInviteSomeone(
                guest
            );

        } catch (error) {

            console.error(
                "Inline invitation controller error:",
                error
            );
        }

    } else {

        /*
           Fallback if the inline controller has not
           become available yet.
        */

        const openButton =
            $("inviteSomeoneTopBtn");

        if (openButton) {
            openButton.click();
        }
    }


    /* -----------------------------------------------------
       SYNCHRONIZE MODAL FIELDS
    ----------------------------------------------------- */

    setTimeout(
        () => {

            const nameInput =
                $("inviteName");

            const phoneInput =
                $("invitePhone");

            const emailInput =
                $("inviteEmail");

            const linkInput =
                $("inviteLink");

            const single =
                $("inviteSingle");

            const couple =
                $("inviteCouple");


            /* ---------------------------------------------
               NAME
            --------------------------------------------- */

            if (nameInput) {

                nameInput.value =
                    guest.name ||
                    guest.full_name ||
                    "";
            }


            /* ---------------------------------------------
               PHONE
            --------------------------------------------- */

            if (phoneInput) {

                phoneInput.value =
                    guest.phone ||
                    "";
            }


            /* ---------------------------------------------
               EMAIL
            --------------------------------------------- */

            if (emailInput) {

                emailInput.value =
                    guest.email ||
                    "";
            }


            /* ---------------------------------------------
               PERSONALIZED LINK
            --------------------------------------------- */

            if (linkInput) {

                linkInput.value =
                    invitationLink;

                linkInput.setAttribute(
                    "readonly",
                    "readonly"
                );

                linkInput.title =
                    invitationLink;
            }


            /* ---------------------------------------------
               INVITATION TYPE
            --------------------------------------------- */

            const type =
                getGuestType(
                    guest
                );

            if (
                type === "couple"
            ) {

                if (couple) {
                    couple.checked = true;
                }

                if (single) {
                    single.checked = false;
                }

            } else {

                if (single) {
                    single.checked = true;
                }

                if (couple) {
                    couple.checked = false;
                }
            }


            /* ---------------------------------------------
               TRIGGER INPUT/CHANGE EVENTS
            --------------------------------------------- */

            [
                nameInput,
                phoneInput,
                emailInput,
                linkInput,
                single,
                couple
            ].forEach(
                element => {

                    if (!element) {
                        return;
                    }

                    element.dispatchEvent(
                        new Event(
                            "input",
                            {
                                bubbles: true
                            }
                        )
                    );

                    element.dispatchEvent(
                        new Event(
                            "change",
                            {
                                bubbles: true
                            }
                        )
                    );
                }
            );


            /* ---------------------------------------------
               ASK INLINE CONTROLLER TO REFRESH PREVIEW
            --------------------------------------------- */

            if (
                typeof window.updateInvitationPreview ===
                "function"
            ) {

                try {

                    window.updateInvitationPreview();

                } catch (error) {

                    console.warn(
                        "Invitation preview update warning:",
                        error
                    );
                }
            }


            /* ---------------------------------------------
               SAVE AGAIN AFTER MODAL OPENS
            --------------------------------------------- */

            window.currentInvitationGuest = {
                ...guest,
                id: guestId
            };

            window.currentInvitationLink =
                invitationLink;


            console.log(
                "Invitation prepared successfully:",
                guest.name ||
                guest.full_name ||
                "Guest",
                invitationLink
            );

        },
        150
    );
}


/* =========================================================
   MARK INVITATION SENT
   ========================================================= */

async function markInvitationSent(
    guestId
) {

    const client =
        getSupabaseClient();

    if (!client || !guestId) {
        return;
    }

    try {

        const {
            error
        } = await client
            .from("guests")
            .update({
                invitation_sent_at:
                    new Date().toISOString()
            })
            .eq(
                "id",
                guestId
            );

        if (error) {

            console.warn(
                "Invitation timestamp not saved:",
                error.message
            );
        }

    } catch (error) {

        console.warn(
            "Invitation status update failed:",
            error
        );
    }
}


/* =========================================================
   NORMALIZE ZAMBIAN PHONE
   ========================================================= */

function normalizeZambianPhone(
    phone
) {

    let value =
        String(
            phone || ""
        )
            .replace(
                /\D/g,
                ""
            );

    if (
        value.startsWith("260")
    ) {

        return value;
    }

    if (
        value.startsWith("0")
    ) {

        return (
            "260" +
            value.substring(1)
        );
    }

    return value;
}


/* =========================================================
   DIRECT WHATSAPP INVITATION
   ========================================================= */

function sendWhatsAppInvitationDirect(
    guest
) {

    if (!guest) {
        return;
    }


    /* -----------------------------------------------------
       GET REAL DATABASE ID
    ----------------------------------------------------- */

    let guestId =
        getGuestDatabaseId(
            guest
        );

    if (!guestId) {

        const matchedGuest =
            findMatchingGuest(
                guest
            );

        if (matchedGuest) {

            guestId =
                getGuestDatabaseId(
                    matchedGuest
                );

            if (guestId) {

                guest = {
                    ...matchedGuest,
                    ...guest,
                    id: guestId
                };
            }
        }
    }


    if (!guestId) {

        alert(
            "This guest does not have a valid database ID. Please reload the guest list."
        );

        return;
    }


    const phone =
        normalizeZambianPhone(
            guest.phone
        );

    if (!phone) {

        alert(
            "This guest does not have a phone number."
        );

        return;
    }


    const name =
        guest.name ||
        guest.full_name ||
        "Guest";

    const type =
        getGuestType(
            guest
        );

    const contribution =
        type === "couple"
            ? "K500"
            : "K300";


    const link =
        buildGuestInvitationLink(
            guestId
        );


    if (!link) {

        alert(
            "Unable to create the personalized invitation link."
        );

        return;
    }


    const message =
        `Dear ${name},

With joy in our hearts, we invite you to celebrate the wedding of Musole & Carol.

Saturday, 19 December 2026
Mongu, Zambia

CHURCH SERVICE
United Pentecostal Church
Kambule Street, opposite Kanyonyo Secondary School
10:00 AM

RECEPTION
Our Lady of Lourdes Hall
15:00 HRS

Invitation Type: ${
    type === "couple"
        ? "Couple"
        : "Single"
}

Suggested Gift Contribution: ${contribution}

“Therefore what God has joined together, let no one separate.”
Matthew 19:6

View your personal invitation:
${link}

With love,
Musole & Carol`;


    const url =
        "https://wa.me/" +
        phone +
        "?text=" +
        encodeURIComponent(
            message
        );


    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );


    markInvitationSent(
        guestId
    );
}


/* =========================================================
   DIRECT EMAIL INVITATION
   ========================================================= */

function sendEmailInvitationDirect(
    guest
) {

    if (!guest) {
        return;
    }


    /* -----------------------------------------------------
       GET REAL DATABASE ID
    ----------------------------------------------------- */

    let guestId =
        getGuestDatabaseId(
            guest
        );

    if (!guestId) {

        const matchedGuest =
            findMatchingGuest(
                guest
            );

        if (matchedGuest) {

            guestId =
                getGuestDatabaseId(
                    matchedGuest
                );

            if (guestId) {

                guest = {
                    ...matchedGuest,
                    ...guest,
                    id: guestId
                };
            }
        }
    }


    if (!guestId) {

        alert(
            "This guest does not have a valid database ID. Please reload the guest list."
        );

        return;
    }


    const email =
        String(
            guest.email || ""
        ).trim();

    if (!email) {

        alert(
            "This guest does not have an email address."
        );

        return;
    }


    const name =
        guest.name ||
        guest.full_name ||
        "Guest";

    const type =
        getGuestType(
            guest
        );

    const contribution =
        type === "couple"
            ? "K500"
            : "K300";


    const link =
        buildGuestInvitationLink(
            guestId
        );


    if (!link) {

        alert(
            "Unable to create the personalized invitation link."
        );

        return;
    }


    const subject =
        "Invitation to the Wedding of Musole & Carol";


    const body =
        `Dear ${name},

With joy in our hearts, we invite you to celebrate the wedding of Musole & Carol.

Saturday, 19 December 2026
Mongu, Zambia

CHURCH SERVICE
United Pentecostal Church
Kambule Street, opposite Kanyonyo Secondary School
10:00 AM

RECEPTION
Our Lady of Lourdes Hall
15:00 HRS

Invitation Type: ${
    type === "couple"
        ? "Couple"
        : "Single"
}

Suggested Gift Contribution: ${contribution}

“Therefore what God has joined together, let no one separate.”
Matthew 19:6

View your personal invitation:
${link}

With love,
Musole & Carol`;


    const mailto =
        "mailto:" +
        encodeURIComponent(
            email
        ) +
        "?subject=" +
        encodeURIComponent(
            subject
        ) +
        "&body=" +
        encodeURIComponent(
            body
        );


    window.location.href =
        mailto;


    markInvitationSent(
        guestId
    );
}


/* =========================================================
   COPY INVITATION LINK
   ========================================================= */

async function copyInvitationLink(
    guestId
) {

    const id =
        String(
            guestId ||
            ""
        ).trim();

    if (!id) {

        alert(
            "A valid guest ID is required."
        );

        return;
    }


    const link =
        buildGuestInvitationLink(
            id
        );


    if (!link) {

        alert(
            "Unable to create the invitation link."
        );

        return;
    }


    /* -----------------------------------------------------
       MODERN CLIPBOARD API
    ----------------------------------------------------- */

    try {

        if (
            navigator.clipboard &&
            typeof navigator.clipboard.writeText ===
            "function"
        ) {

            await navigator.clipboard.writeText(
                link
            );

            console.log(
                "Invitation link copied:",
                link
            );

            alert(
                "Personalized invitation link copied."
            );

            return;
        }

    } catch (error) {

        console.warn(
            "Clipboard API failed. Using fallback.",
            error
        );
    }


    /* -----------------------------------------------------
       FALLBACK COPY METHOD
    ----------------------------------------------------- */

    try {

        const textarea =
            document.createElement(
                "textarea"
            );

        textarea.value =
            link;

        textarea.setAttribute(
            "readonly",
            ""
        );

        textarea.style.position =
            "fixed";

        textarea.style.left =
            "-9999px";

        textarea.style.top =
            "0";

        document.body.appendChild(
            textarea
        );

        textarea.focus();
        textarea.select();

        const successful =
            document.execCommand(
                "copy"
            );

        document.body.removeChild(
            textarea
        );


        if (successful) {

            console.log(
                "Invitation link copied using fallback:",
                link
            );

            alert(
                "Personalized invitation link copied."
            );

        } else {

            alert(
                "Copy failed. Please select and copy the link manually."
            );
        }

    } catch (error) {

        console.error(
            "Copy invitation link failed:",
            error
        );

        alert(
            "Copy failed. Please select and copy the link manually."
        );
    }
}


/* =========================================================
   GIFTS
   ========================================================= */

function setupGiftSystem() {

    const button =
        $("recordGiftBtn");

    if (
        button &&
        button.dataset.ready !== "true"
    ) {

        button.dataset.ready =
            "true";

        button.type =
            "button";

        button.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                await recordGift();
            }
        );
    }

    populateGiftGuestList();
}


async function loadGifts() {

    const client =
        getSupabaseClient();

    if (!client) {
        return;
    }

    try {

        let result =
            await client
                .from("gifts")
                .select("*")
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );

        if (
            result.error &&
            String(
                result.error.message || ""
            )
                .toLowerCase()
                .includes("created_at")
        ) {

            result =
                await client
                    .from("gifts")
                    .select("*");
        }

        if (result.error) {
            throw result.error;
        }

        giftsCache =
            Array.isArray(result.data)
                ? result.data
                : [];

        updateGiftStatistics();

    } catch (error) {

        console.error(
            "Gifts loading error:",
            error
        );

        giftsCache = [];

        updateGiftStatistics();
    }
}


function updateGiftStatistics() {

    const total =
        giftsCache.reduce(
            (
                sum,
                gift
            ) => {

                return (
                    sum +
                    Number(
                        gift.amount || 0
                    )
                );

            },
            0
        );

    setText(
        "totalGifts",
        `K${total.toFixed(2)}`
    );
}


function populateGiftGuestList() {

    const select =
        $("giftGuest");

    if (!select) {
        return;
    }

    const previous =
        select.value;

    select.innerHTML =
        `<option value="">Select guest</option>`;

    guestsCache.forEach(
        guest => {

            const guestId =
                getGuestDatabaseId(
                    guest
                );

            if (!guestId) {
                return;
            }

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                guestId;

            option.textContent =
                guest.name ||
                guest.full_name ||
                "Unnamed guest";

            select.appendChild(
                option
            );
        }
    );

    if (previous) {
        select.value =
            previous;
    }
}


async function recordGift() {

    const client =
        getSupabaseClient();

    if (!client) {
        return;
    }

    const guestId =
        $("giftGuest")?.value ||
        null;

    const amount =
        Number(
            $("giftAmount")?.value ||
            0
        );

    const provider =
        String(
            $("giftProvider")?.value ||
            ""
        ).trim();

    const reference =
        String(
            $("giftReference")?.value ||
            ""
        ).trim();

    if (
        !amount ||
        amount <= 0
    ) {

        showMessage(
            "giftMessage",
            "Please enter a valid gift amount.",
            "error"
        );

        return;
    }

    const button =
        $("recordGiftBtn");

    if (button) {
        button.disabled = true;
    }

    try {

        const {
            error
        } = await client
            .from("gifts")
            .insert({
                guest_id:
                    guestId,
                amount,
                provider:
                    provider ||
                    null,
                reference:
                    reference ||
                    null
            });

        if (error) {
            throw error;
        }

        showMessage(
            "giftMessage",
            "Gift recorded successfully.",
            "success"
        );

        if ($("giftAmount")) {
            $("giftAmount").value = "";
        }

        if ($("giftReference")) {
            $("giftReference").value = "";
        }

        await loadGifts();

    } catch (error) {

        console.error(
            "Record gift error:",
            error
        );

        showMessage(
            "giftMessage",
            error?.message ||
            "Unable to record gift.",
            "error"
        );

    } finally {

        if (button) {
            button.disabled = false;
        }
    }
}


/* =========================================================
   ACCOUNT SYSTEM
   ========================================================= */

function setupAccountSystem() {

    const button =
        $("changePasswordBtn");

    if (
        button &&
        button.dataset.ready !== "true"
    ) {

        button.dataset.ready =
            "true";

        button.type =
            "button";

        button.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                await changeAccountPassword();
            }
        );
    }


    const logoutButton =
        $("accountLogoutBtn");

    if (
        logoutButton &&
        logoutButton.dataset.ready !== "true"
    ) {

        logoutButton.dataset.ready =
            "true";

        logoutButton.type =
            "button";

        logoutButton.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                await logout();
            }
        );
    }
}


/* =========================================================
   CHANGE ACCOUNT PASSWORD
   ========================================================= */

async function changeAccountPassword() {

    const client =
        getSupabaseClient();

    if (!client) {
        return;
    }

    const currentPassword =
        String(
            $("currentPassword")?.value ||
            ""
        );

    const newPassword =
        String(
            $("accountNewPassword")?.value ||
            ""
        );

    const confirmPassword =
        String(
            $("accountConfirmPassword")?.value ||
            ""
        );

    if (!currentPassword) {

        showMessage(
            "changePasswordMessage",
            "Enter your current password.",
            "error"
        );

        return;
    }

    if (
        newPassword.length <
        6
    ) {

        showMessage(
            "changePasswordMessage",
            "New password must contain at least 6 characters.",
            "error"
        );

        return;
    }

    if (
        newPassword !==
        confirmPassword
    ) {

        showMessage(
            "changePasswordMessage",
            "New passwords do not match.",
            "error"
        );

        return;
    }

    const email =
        currentSession?.user?.email;

    if (!email) {
        return;
    }

    const button =
        $("changePasswordBtn");

    if (button) {
        button.disabled = true;
    }

    try {

        const loginResult =
            await client.auth.signInWithPassword({
                email,
                password:
                    currentPassword
            });

        if (loginResult.error) {

            throw new Error(
                "Current password is incorrect."
            );
        }

        const updateResult =
            await client.auth.updateUser({
                password:
                    newPassword
            });

        if (updateResult.error) {
            throw updateResult.error;
        }

        showMessage(
            "changePasswordMessage",
            "Password changed successfully.",
            "success"
        );

        if ($("currentPassword")) {
            $("currentPassword").value = "";
        }

        if ($("accountNewPassword")) {
            $("accountNewPassword").value = "";
        }

        if ($("accountConfirmPassword")) {
            $("accountConfirmPassword").value = "";
        }

        currentSession =
            await getCurrentSession();

    } catch (error) {

        console.error(
            "Password change error:",
            error
        );

        showMessage(
            "changePasswordMessage",
            error?.message ||
            "Unable to change password.",
            "error"
        );

    } finally {

        if (button) {
            button.disabled = false;
        }
    }
}


/* =========================================================
   QUICK ACTIONS
   ========================================================= */

function setupQuickActions() {

    document
        .querySelectorAll(
            "[data-action]"
        )
        .forEach(
            button => {

                if (
                    button.dataset.actionReady ===
                    "true"
                ) {
                    return;
                }

                button.dataset.actionReady =
                    "true";

                button.type =
                    "button";

                button.addEventListener(
                    "click",
                    event => {

                        event.preventDefault();

                        const action =
                            button.dataset.action;

                        if (
                            action ===
                            "add-guest"
                        ) {

                            openGuestModal();

                        } else if (
                            action ===
                            "guests"
                        ) {

                            showDashboardSection(
                                "guestsSection"
                            );

                        } else if (
                            action ===
                            "invitations"
                        ) {

                            showDashboardSection(
                                "invitationsSection"
                            );

                        } else if (
                            action ===
                            "gifts"
                        ) {

                            showDashboardSection(
                                "giftsSection"
                            );

                        } else if (
                            action ===
                            "qr"
                        ) {

                            showDashboardSection(
                                "qrSection"
                            );

                        } else if (
                            action ===
                            "account"
                        ) {

                            showDashboardSection(
                                "accountSection"
                            );
                        }
                    }
                );
            }
        );
}


/* =========================================================
   QR SYSTEM
   ========================================================= */

function setupQRSystem() {

    const button =
        $("startScannerBtn");

    if (
        button &&
        button.dataset.ready !== "true"
    ) {

        button.dataset.ready =
            "true";

        button.type =
            "button";

        button.addEventListener(
            "click",
            async event => {

                event.preventDefault();

                await startQRScanner();
            }
        );
    }
}


async function startQRScanner() {

    if (qrScannerRunning) {

        showMessage(
            "scannerStatus",
            "QR scanner is already running.",
            "info"
        );

        return;
    }

    if (
        typeof Html5Qrcode ===
        "undefined"
    ) {

        showMessage(
            "scannerStatus",
            "QR scanner library is not loaded in admin.html.",
            "error"
        );

        return;
    }

    const reader =
        $("qr-reader");

    if (!reader) {

        showMessage(
            "scannerStatus",
            "QR scanner area was not found.",
            "error"
        );

        return;
    }

    try {

        qrScanner =
            new Html5Qrcode(
                "qr-reader"
            );

        lastQRValue = "";
        qrProcessing = false;

        await qrScanner.start(
            {
                facingMode:
                    "environment"
            },
            {
                fps: 10,
                qrbox: {
                    width: 250,
                    height: 250
                }
            },
            decodedText => {

                handleQRResult(
                    decodedText
                );
            },
            () => {}
        );

        qrScannerRunning =
            true;

        showMessage(
            "scannerStatus",
            "QR scanner is running.",
            "success"
        );

    } catch (error) {

        console.error(
            "QR scanner error:",
            error
        );

        qrScanner = null;
        qrScannerRunning = false;

        showMessage(
            "scannerStatus",
            error?.message ||
            "Unable to start QR scanner.",
            "error"
        );
    }
}


function handleQRResult(
    value
) {

    if (!value) {
        return;
    }

    if (qrProcessing) {
        return;
    }

    if (
        value ===
        lastQRValue
    ) {
        return;
    }

    qrProcessing = true;
    lastQRValue = value;

    showMessage(
        "scannerStatus",
        `QR code detected: ${value}`,
        "success"
    );

    /*
       Future check-in verification can use
       this value to look up the guest in Supabase.
    */

    setTimeout(
        () => {

            qrProcessing =
                false;

        },
        2500
    );
}


async function stopQRScanner() {

    if (!qrScanner) {
        return;
    }

    try {

        if (qrScannerRunning) {
            await qrScanner.stop();
        }

        try {
            await qrScanner.clear();
        } catch (error) {
            console.warn(
                "QR clear warning:",
                error
            );
        }

    } catch (error) {

        console.warn(
            "QR scanner stop warning:",
            error
        );

    } finally {

        qrScanner = null;
        qrScannerRunning = false;
        qrProcessing = false;
        lastQRValue = "";
    }
}


/* =========================================================
   KEYBOARD CONTROLS
   ========================================================= */

function setupKeyboardControls() {

    if (
        document.body.dataset.keyboardReady ===
        "true"
    ) {
        return;
    }

    document.body.dataset.keyboardReady =
        "true";

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Escape"
            ) {

                closeGuestModal();
            }
        }
    );
}


/* =========================================================
   INITIALIZE ADMIN
   ========================================================= */

async function initializeAdmin() {

    console.log(
        "Initializing M & C Wedding Admin Control Center..."
    );

    const client =
        getSupabaseClient();

    if (!client) {

        console.error(
            "Supabase client not found."
        );

        showMessage(
            "authMessage",
            "Supabase client is not available. Check config.js.",
            "error"
        );

        return;
    }

    console.log(
        "Supabase client detected successfully."
    );


    setupAuthButtons();

    setupAuthStateListener();


    try {

        const session =
            await getCurrentSession();

        if (session) {

            console.log(
                "Existing session detected."
            );

            currentSession =
                session;

            if (
                !dashboardInitialized &&
                !dashboardOpening
            ) {

                await verifyAdminAndOpenDashboard(
                    session
                );
            }

        } else {

            hideDashboard();
        }

    } catch (error) {

        console.error(
            "Initial session check failed:",
            error
        );

        hideDashboard();
    }


    console.log(
        "M & C WEDDING ADMIN CONTROL CENTER READY"
    );
}


/* =========================================================
   GLOBAL FUNCTIONS
   ========================================================= */

window.login =
    login;

window.logout =
    logout;

window.openDashboard =
    openDashboard;

window.showDashboardSection =
    showDashboardSection;

window.openGuestModal =
    openGuestModal;

window.closeGuestModal =
    closeGuestModal;

window.loadGuests =
    loadGuests;

window.loadGifts =
    loadGifts;

window.startQRScanner =
    startQRScanner;

window.stopQRScanner =
    stopQRScanner;

window.renderInvitationGuestList =
    renderInvitationGuestList;

window.openInvitationForGuest =
    openInvitationForGuest;

window.sendWhatsAppInvitationDirect =
    sendWhatsAppInvitationDirect;

window.sendEmailInvitationDirect =
    sendEmailInvitationDirect;

window.copyInvitationLink =
    copyInvitationLink;

window.buildGuestInvitationLink =
    buildGuestInvitationLink;

window.getInvitationBaseURL =
    getInvitationBaseURL;

window.getGuestDatabaseId =
    getGuestDatabaseId;

window.updatePassword =
    updatePassword;


/* =========================================================
   START APPLICATION
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeAdmin,
        {
            once: true
        }
    );

} else {

    initializeAdmin();
}