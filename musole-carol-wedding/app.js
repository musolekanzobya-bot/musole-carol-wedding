/* =========================================================
   M & C WEDDING
   GUEST INVITATION APPLICATION
   ---------------------------------------------------------
   COMPLETE CORRECTED APP.JS
   ========================================================= */

"use strict";


/* =========================================================
   STATE
========================================================= */

let invitationOpening = false;
let invitationOpened = false;

let weddingMusicStarted = false;

let countdownTimer = null;

let currentGuest = null;
let currentGuestId = null;

let currentRsvpStatus = "pending";


/* =========================================================
   DOM
========================================================= */

function $(id) {
    return document.getElementById(id);
}


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function setText(element, value) {

    if (!element) return;

    element.textContent =
        value === null ||
        value === undefined
            ? ""
            : String(value);
}


/* =========================================================
   SUPABASE
========================================================= */

function getSupabaseClient() {

    if (
        window.supabaseClient &&
        typeof window.supabaseClient.from === "function"
    ) {

        return window.supabaseClient;
    }

    console.warn(
        "M & C Wedding: Supabase client unavailable."
    );

    return null;
}


/* =========================================================
   URL
========================================================= */

function getGuestIdFromUrl() {

    try {

        const params =
            new URLSearchParams(
                window.location.search
            );

        return (
            params.get("guest") ||
            params.get("guest_id") ||
            params.get("id") ||
            ""
        ).trim();

    } catch (error) {

        console.warn(
            "M & C Wedding: Could not read guest URL.",
            error
        );

        return "";
    }
}


/* =========================================================
   GUEST HELPERS
========================================================= */

function getGuestName(guest) {

    if (!guest) {
        return "Beloved Guest";
    }

    return (
        guest.name ||
        guest.full_name ||
        guest.guest_name ||
        guest.display_name ||
        "Beloved Guest"
    );
}


function getGuestPhone(guest) {

    if (!guest) return "";

    return (
        guest.phone ||
        guest.phone_number ||
        guest.mobile ||
        ""
    );
}


function getGuestType(guest) {

    if (!guest) return "single";

    const type =
        String(
            guest.guest_type ||
            guest.type ||
            "single"
        ).toLowerCase();

    return type === "couple"
        ? "couple"
        : "single";
}


/* =========================================================
   PERSONALIZATION
========================================================= */

function personalizeGuestInterface(guest) {

    const name =
        getGuestName(guest);

    const phone =
        getGuestPhone(guest);

    const type =
        getGuestType(guest);


    setText(
        $("paperGuestName"),
        name
    );


    const nameInput =
        $("guestName");

    if (
        nameInput &&
        name !== "Beloved Guest"
    ) {

        nameInput.value =
            name;
    }


    const phoneInput =
        $("guestPhone");

    if (
        phoneInput &&
        phone
    ) {

        phoneInput.value =
            phone;
    }


    const radio =
        document.querySelector(
            `input[name="guestType"][value="${type}"]`
        );

    if (radio) {
        radio.checked = true;
    }


    setText(
        $("qrGuestInfo"),
        `Personalized invitation for ${name}`
    );


    document
        .querySelectorAll(
            "[data-guest-name]"
        )
        .forEach(element => {

            setText(
                element,
                name
            );

        });


    currentGuest =
        guest || null;
}


/* =========================================================
   LOAD GUEST
========================================================= */

async function loadGuest() {

    currentGuestId =
        getGuestIdFromUrl();


    if (!currentGuestId) {

        console.log(
            "M & C Wedding: No personalized guest ID supplied. Generic invitation mode."
        );

        personalizeGuestInterface(
            null
        );

        generateGuestQr();

        return;
    }


    const supabase =
        getSupabaseClient();


    if (!supabase) {

        personalizeGuestInterface(
            null
        );

        return;
    }


    try {

        const {
            data,
            error
        } =
            await supabase
                .from("guests")
                .select("*")
                .eq(
                    "id",
                    currentGuestId
                )
                .maybeSingle();


        if (error) {

            console.error(
                "M & C Wedding: Guest lookup failed.",
                error
            );

            personalizeGuestInterface(
                null
            );

            return;
        }


        if (!data) {

            console.warn(
                "M & C Wedding: Guest not found."
            );

            personalizeGuestInterface(
                null
            );

            return;
        }


        currentGuest =
            data;


        currentRsvpStatus =
            data.rsvp_status ||
            "pending";


        personalizeGuestInterface(
            data
        );


        generateGuestQr();


        console.log(
            "M & C Wedding: Guest loaded successfully."
        );


    } catch (error) {

        console.error(
            "M & C Wedding: Unexpected guest loading error.",
            error
        );

        personalizeGuestInterface(
            null
        );
    }
}


/* =========================================================
   MUSIC
========================================================= */

function updateMusicButton(isPlaying) {

    const button =
        $("musicToggle");

    if (!button) return;


    const icon =
        button.querySelector("i");

    if (!icon) return;


    icon.classList.remove(
        "fa-music",
        "fa-volume-high",
        "fa-volume-xmark"
    );


    if (isPlaying) {

        icon.classList.add(
            "fa-volume-high"
        );

        button.setAttribute(
            "aria-label",
            "Pause wedding music"
        );

    } else {

        icon.classList.add(
            "fa-music"
        );

        button.setAttribute(
            "aria-label",
            "Play wedding music"
        );
    }
}


/* =========================================================
   MUSIC START
   ---------------------------------------------------------
   IMPORTANT:
   We do NOT await play().
   This prevents the 404/abort chain from breaking
   the envelope animation.
========================================================= */

function startWeddingMusic() {

    const music =
        $("weddingMusic");

    if (!music) return;


    /*
       If the source is missing, stop here quietly.
       The invitation itself must continue working.
    */

    if (
        music.readyState === 0 &&
        music.networkState === HTMLMediaElement.NETWORK_NO_SOURCE
    ) {

        console.warn(
            "M & C Wedding: Wedding music file is unavailable. Envelope will continue normally."
        );

        updateMusicButton(false);

        return;
    }


    try {

        music.volume =
            0.35;


        const playRequest =
            music.play();


        if (
            playRequest &&
            typeof playRequest.catch ===
                "function"
        ) {

            playRequest
                .then(() => {

                    weddingMusicStarted =
                        true;

                    updateMusicButton(
                        true
                    );

                })
                .catch(error => {

                    /*
                       Music failure must NEVER
                       stop the invitation.
                    */

                    console.warn(
                        "M & C Wedding: Music unavailable:",
                        error?.name || error
                    );

                    weddingMusicStarted =
                        false;

                    updateMusicButton(
                        false
                    );

                });
        }


    } catch (error) {

        console.warn(
            "M & C Wedding: Music could not start.",
            error
        );

        weddingMusicStarted =
            false;

        updateMusicButton(
            false
        );
    }
}


/* =========================================================
   TOGGLE MUSIC
========================================================= */

function toggleWeddingMusic() {

    const music =
        $("weddingMusic");

    if (!music) return;


    if (music.paused) {

        try {

            const promise =
                music.play();


            if (
                promise &&
                typeof promise.catch ===
                    "function"
            ) {

                promise.catch(
                    error => {

                        console.warn(
                            "M & C Wedding: Music unavailable.",
                            error
                        );

                        weddingMusicStarted =
                            false;

                        updateMusicButton(
                            false
                        );
                    }
                );
            }


            weddingMusicStarted =
                true;

            updateMusicButton(
                true
            );


        } catch (error) {

            console.warn(
                "M & C Wedding: Music could not start.",
                error
            );
        }


    } else {

        music.pause();

        weddingMusicStarted =
            false;

        updateMusicButton(
            false
        );
    }
}


/* =========================================================
   MUSIC SETUP
========================================================= */

function setupMusic() {

    const music =
        $("weddingMusic");


    if (music) {

        music.loop =
            true;

        music.preload =
            "auto";


        music.addEventListener(
            "play",
            () => {

                weddingMusicStarted =
                    true;

                updateMusicButton(
                    true
                );
            }
        );


        music.addEventListener(
            "pause",
            () => {

                weddingMusicStarted =
                    false;

                updateMusicButton(
                    false
                );
            }
        );


        music.addEventListener(
            "error",
            () => {

                console.warn(
                    "M & C Wedding: Music file not found. Expected: wedding-music/Goodness-of-God.m4a"
                );

                weddingMusicStarted =
                    false;

                updateMusicButton(
                    false
                );
            }
        );
    }


    const button =
        $("musicToggle");


    if (button) {

        button.addEventListener(
            "click",
            toggleWeddingMusic
        );
    }
}


/* =========================================================
   INITIAL ENVELOPE STATE
========================================================= */

function prepareInitialScreen() {

    const screen =
        $("envelopeScreen");

    const envelope =
        $("weddingEnvelope");

    const paper =
        $("invitationPaper");

    const paperInner =
        paper?.querySelector(
            ".paper-inner"
        );

    const blankFace =
        paper?.querySelector(
            ".paper-blank-face"
        );

    const contentFace =
        paper?.querySelector(
            ".paper-content-face"
        );

    const content =
        $("paperInvitationContent");

    const continueButton =
        $("continueInvitationBtn");

    const seal =
        $("waxSealButton");

    const instruction =
        $("openingInstruction");

    const invitation =
        $("invitation");


    invitationOpening =
        false;

    invitationOpened =
        false;


    screen?.classList.remove(
        "fade-out"
    );


    envelope?.classList.remove(
        "opening",
        "paper-flipping",
        "paper-revealed"
    );


    /*
       Paper begins completely inside envelope.
    */

    if (paper) {

        paper.style.opacity =
            "1";

        paper.style.visibility =
            "visible";

        paper.style.transform =
            "translateX(-50%) translateY(38%) scale(.96)";
    }


    if (paperInner) {

        paperInner.style.transform =
            "rotateY(0deg)";
    }


    if (blankFace) {

        blankFace.style.transform =
            "rotateY(0deg)";
    }


    if (contentFace) {

        contentFace.style.transform =
            "rotateY(180deg)";
    }


    content?.classList.remove(
        "visible"
    );


    if (continueButton) {

        continueButton.classList.add(
            "hidden"
        );

        continueButton.disabled =
            true;

        continueButton.style.opacity =
            "0";

        continueButton.style.pointerEvents =
            "none";
    }


    if (seal) {

        seal.disabled =
            false;

        seal.classList.remove(
            "opening"
        );
    }


    if (instruction) {

        instruction.style.opacity =
            "1";

        instruction.textContent =
            "Press the golden seal to open your invitation";
    }


    if (invitation) {

        invitation.classList.add(
            "hidden"
        );

        invitation.classList.remove(
            "visible"
        );

        invitation.style.display =
            "none";

        invitation.style.opacity =
            "0";

        invitation.style.visibility =
            "hidden";
    }
}


/* =========================================================
   OPEN ENVELOPE
   ---------------------------------------------------------
   EXACT SEQUENCE:

   1. Seal pressed
   2. Music attempted
   3. Flap opens
   4. Blank paper rises
   5. Paper completely exits envelope
   6. Paper settles in center
   7. Paper flips in 3D
   8. Invitation text appears
   9. Continue appears
========================================================= */

async function openInvitation() {

    if (
        invitationOpening ||
        invitationOpened
    ) {

        return;
    }


    const envelope =
        $("weddingEnvelope");

    const seal =
        $("waxSealButton");

    const instruction =
        $("openingInstruction");

    const paper =
        $("invitationPaper");

    const paperInner =
        paper?.querySelector(
            ".paper-inner"
        );

    const blankFace =
        paper?.querySelector(
            ".paper-blank-face"
        );

    const contentFace =
        paper?.querySelector(
            ".paper-content-face"
        );

    const content =
        $("paperInvitationContent");

    const continueButton =
        $("continueInvitationBtn");


    if (
        !envelope ||
        !paper ||
        !paperInner
    ) {

        console.error(
            "M & C Wedding: Envelope markup is incomplete."
        );

        return;
    }


    invitationOpening =
        true;


    console.log(
        "M & C Wedding: Opening sealed envelope..."
    );


    /*
       User gesture:
       attempt music.
       Failure does NOT interrupt animation.
    */

    startWeddingMusic();


    if (seal) {

        seal.disabled =
            true;

        seal.classList.add(
            "opening"
        );
    }


    if (instruction) {

        instruction.style.opacity =
            "0";
    }


    if (continueButton) {

        continueButton.classList.add(
            "hidden"
        );

        continueButton.disabled =
            true;

        continueButton.style.opacity =
            "0";

        continueButton.style.pointerEvents =
            "none";
    }


    /*
       RESET PAPER
    */

    paper.classList.remove(
        "paper-revealed"
    );


    content?.classList.remove(
        "visible"
    );


    paperInner.style.transition =
        "transform 1.2s cubic-bezier(.22,.61,.36,1)";


    paperInner.style.transform =
        "rotateY(0deg)";


    if (blankFace) {

        blankFace.style.transform =
            "rotateY(0deg)";
    }


    if (contentFace) {

        contentFace.style.transform =
            "rotateY(180deg)";
    }


    /*
       =====================================================
       STAGE 1
       OPEN ENVELOPE
       =====================================================
    */

    envelope.classList.add(
        "opening"
    );


    console.log(
        "M & C Wedding: Envelope flap opening..."
    );


    await sleep(
        1100
    );


    /*
       =====================================================
       STAGE 2
       PAPER STARTS RISING
       =====================================================
    */

    paper.style.transition =
        "transform 1.8s cubic-bezier(.22,.61,.36,1)";


    paper.style.transform =
        "translateX(-50%) translateY(-78%) scale(1.02)";


    console.log(
        "M & C Wedding: Blank paper rising..."
    );


    await sleep(
        1800
    );


    /*
       =====================================================
       STAGE 3
       PAPER IS COMPLETELY OUT
       =====================================================
    */

    paper.style.transition =
        "transform .65s cubic-bezier(.22,.61,.36,1)";


    paper.style.transform =
        "translateX(-50%) translateY(-88%) scale(1.035)";


    await sleep(
        650
    );


    console.log(
        "M & C Wedding: Paper has completely emerged."
    );


    /*
       =====================================================
       STAGE 4
       PHYSICAL 3D FLIP
       =====================================================
    */

    envelope.classList.add(
        "paper-flipping"
    );


    paperInner.style.transition =
        "transform 1.35s cubic-bezier(.22,.61,.36,1)";


    paperInner.style.transform =
        "rotateY(180deg)";


    console.log(
        "M & C Wedding: Paper is physically flipping..."
    );


    await sleep(
        1350
    );


    /*
       =====================================================
       STAGE 5
       WRITTEN CONTENT
       =====================================================
    */

    paper.classList.add(
        "paper-revealed"
    );


    if (content) {

        content.classList.add(
            "visible"
        );
    }


    console.log(
        "M & C Wedding: Invitation contents revealed."
    );


    /*
       =====================================================
       STAGE 6
       CONTINUE
       =====================================================
    */

    await sleep(
        850
    );


    if (continueButton) {

        continueButton.classList.remove(
            "hidden"
        );

        continueButton.disabled =
            false;

        continueButton.style.opacity =
            "1";

        continueButton.style.pointerEvents =
            "auto";
    }


    invitationOpening =
        false;


    console.log(
        "M & C Wedding: Envelope opening completed successfully."
    );
}


/* =========================================================
   CONTINUE
========================================================= */

function continueInvitation(event) {

    if (event) {

        event.preventDefault();

        event.stopPropagation();
    }


    if (
        invitationOpening ||
        invitationOpened
    ) {

        return;
    }


    const button =
        $("continueInvitationBtn");


    if (
        button &&
        button.disabled
    ) {

        return;
    }


    revealInvitation();
}


/* =========================================================
   REVEAL MAIN INVITATION
========================================================= */

async function revealInvitation() {

    if (invitationOpened) {
        return;
    }


    const invitation =
        $("invitation");

    const screen =
        $("envelopeScreen");


    if (!invitation) {

        console.error(
            "M & C Wedding: Main invitation missing."
        );

        return;
    }


    invitationOpened =
        true;


    invitation.classList.remove(
        "hidden"
    );


    invitation.classList.add(
        "visible"
    );


    invitation.style.display =
        "block";

    invitation.style.visibility =
        "visible";

    invitation.style.opacity =
        "1";


    screen?.classList.add(
        "fade-out"
    );


    await sleep(
        900
    );


    if (screen) {

        screen.style.display =
            "none";
    }


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });


    console.log(
        "M & C Wedding: Main invitation displayed."
    );
}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

    document
        .querySelectorAll(
            'a[href^="#"]'
        )
        .forEach(link => {

            link.addEventListener(
                "click",
                event => {

                    const href =
                        link.getAttribute(
                            "href"
                        );


                    if (
                        !href ||
                        href === "#"
                    ) {

                        return;
                    }


                    const target =
                        document.querySelector(
                            href
                        );


                    if (!target) {
                        return;
                    }


                    event.preventDefault();


                    target.scrollIntoView({
                        behavior:
                            "smooth",
                        block:
                            "start"
                    });
                }
            );
        });
}


/* =========================================================
   COUNTDOWN
========================================================= */

function setupCountdown() {

    const days =
        $("days");

    const hours =
        $("hours");

    const minutes =
        $("minutes");

    const seconds =
        $("seconds");


    if (
        !days ||
        !hours ||
        !minutes ||
        !seconds
    ) {

        return;
    }


    const weddingDate =
        new Date(
            "2026-12-19T10:00:00+02:00"
        ).getTime();


    function update() {

        let difference =
            weddingDate -
            Date.now();


        if (difference < 0) {

            difference =
                0;
        }


        const totalSeconds =
            Math.floor(
                difference /
                1000
            );


        const d =
            Math.floor(
                totalSeconds /
                86400
            );


        const h =
            Math.floor(
                (totalSeconds %
                    86400) /
                3600
            );


        const m =
            Math.floor(
                (totalSeconds %
                    3600) /
                60
            );


        const s =
            totalSeconds %
            60;


        setText(
            days,
            String(d).padStart(
                2,
                "0"
            )
        );

        setText(
            hours,
            String(h).padStart(
                2,
                "0"
            )
        );

        setText(
            minutes,
            String(m).padStart(
                2,
                "0"
            )
        );

        setText(
            seconds,
            String(s).padStart(
                2,
                "0"
            )
        );
    }


    update();


    if (countdownTimer) {

        clearInterval(
            countdownTimer
        );
    }


    countdownTimer =
        setInterval(
            update,
            1000
        );
}


/* =========================================================
   RSVP
========================================================= */

function getSelectedGuestType() {

    const selected =
        document.querySelector(
            'input[name="guestType"]:checked'
        );

    return selected
        ? selected.value
        : "single";
}


function showRsvpMessage(
    message,
    type
) {

    const element =
        $("rsvpMessage");

    if (!element) return;


    element.textContent =
        message;


    element.className =
        "rsvp-message";


    if (type) {

        element.classList.add(
            type
        );
    }
}


async function saveRsvp(
    status
) {

    if (!currentGuestId) {

        showRsvpMessage(
            "Your personalized guest link is required to save your RSVP.",
            "error"
        );

        return;
    }


    const supabase =
        getSupabaseClient();


    if (!supabase) {

        showRsvpMessage(
            "RSVP service is temporarily unavailable.",
            "error"
        );

        return;
    }


    const nameInput =
        $("guestName");

    const phoneInput =
        $("guestPhone");


    const name =
        nameInput?.value.trim() ||
        "";


    const phone =
        phoneInput?.value.trim() ||
        "";


    const guestType =
        getSelectedGuestType();


    if (!name) {

        showRsvpMessage(
            "Please enter your name.",
            "error"
        );

        nameInput?.focus();

        return;
    }


    showRsvpMessage(
        "Saving your RSVP...",
        "loading"
    );


    let result =
        await supabase
            .from("guests")
            .update({

                name,

                phone,

                guest_type:
                    guestType,

                rsvp_status:
                    status,

                rsvp_at:
                    new Date()
                        .toISOString(),

                updated_at:
                    new Date()
                        .toISOString()

            })
            .eq(
                "id",
                currentGuestId
            );


    /*
       Fallback for databases without
       optional timestamp fields.
    */

    if (result.error) {

        console.warn(
            "M & C Wedding: Retrying basic RSVP update."
        );


        result =
            await supabase
                .from("guests")
                .update({

                    name,

                    phone,

                    guest_type:
                        guestType,

                    rsvp_status:
                        status

                })
                .eq(
                    "id",
                    currentGuestId
                );
    }


    if (result.error) {

        console.error(
            "M & C Wedding: RSVP failed.",
            result.error
        );


        showRsvpMessage(
            "We could not save your RSVP right now. Please try again.",
            "error"
        );

        return;
    }


    currentGuest = {

        ...(currentGuest || {}),

        name,

        phone,

        guest_type:
            guestType,

        rsvp_status:
            status
    };


    currentRsvpStatus =
        status;


    personalizeGuestInterface(
        currentGuest
    );


    if (
        status ===
        "accepted"
    ) {

        showRsvpMessage(
            "Thank you! Your attendance has been confirmed. We look forward to celebrating with you.",
            "success"
        );

    } else {

        showRsvpMessage(
            "Thank you for letting us know. We truly appreciate your response.",
            "success"
        );
    }
}


function setupRsvp() {

    const form =
        $("rsvpForm");


    if (!form) return;


    form.addEventListener(
        "submit",
        event => {

            event.preventDefault();
        }
    );


    $("acceptBtn")
        ?.addEventListener(
            "click",
            () => {

                saveRsvp(
                    "accepted"
                );
            }
        );


    $("regretBtn")
        ?.addEventListener(
            "click",
            () => {

                saveRsvp(
                    "declined"
                );
            }
        );
}


/* =========================================================
   QR PASS
========================================================= */

function getGuestInvitationUrl() {

    const url =
        new URL(
            window.location.href
        );

    url.hash =
        "";

    return url.toString();
}


function generateGuestQr() {

    const container =
        $("qrContainer");


    if (!container) {
        return;
    }


    container.innerHTML =
        "";


    if (
        typeof window.QRCode ===
        "undefined"
    ) {

        container.textContent =
            "QR code library could not be loaded.";

        return;
    }


    try {

        new QRCode(
            container,
            {

                text:
                    getGuestInvitationUrl(),

                width:
                    220,

                height:
                    220,

                colorDark:
                    "#1C3B26",

                colorLight:
                    "#ffffff",

                correctLevel:
                    QRCode.CorrectLevel.H

            }
        );


    } catch (error) {

        console.error(
            "M & C Wedding: QR generation failed.",
            error
        );

        container.textContent =
            "Unable to generate QR pass.";
    }
}


function downloadQr() {

    const container =
        $("qrContainer");


    if (!container) {
        return;
    }


    const canvas =
        container.querySelector(
            "canvas"
        );


    const image =
        container.querySelector(
            "img"
        );


    let dataUrl =
        "";


    if (canvas) {

        dataUrl =
            canvas.toDataURL(
                "image/png"
            );

    } else if (image) {

        dataUrl =
            image.src;
    }


    if (!dataUrl) {

        alert(
            "The QR pass is not ready yet."
        );

        return;
    }


    const link =
        document.createElement(
            "a"
        );


    link.href =
        dataUrl;


    link.download =
        "Musole-Carol-Wedding-QR-Pass.png";


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();
}


function setupQr() {

    $("downloadQrBtn")
        ?.addEventListener(
            "click",
            downloadQr
        );
}


/* =========================================================
   ENVELOPE EVENTS
========================================================= */

function setupEnvelopeEvents() {

    const seal =
        $("waxSealButton");


    const continueButton =
        $("continueInvitationBtn");


    if (seal) {

        seal.addEventListener(
            "click",
            event => {

                event.preventDefault();

                openInvitation();
            }
        );


        seal.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                        "Enter" ||
                    event.key ===
                        " "
                ) {

                    event.preventDefault();

                    openInvitation();
                }
            }
        );
    }


    if (continueButton) {

        continueButton.addEventListener(
            "click",
            continueInvitation
        );


        continueButton.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                        "Enter" ||
                    event.key ===
                        " "
                ) {

                    continueInvitation(
                        event
                    );
                }
            }
        );
    }
}


/* =========================================================
   INITIALIZE
========================================================= */

async function initializeWeddingApp() {

    console.log(
        "M & C Wedding: Initializing..."
    );


    prepareInitialScreen();


    setupMusic();


    setupEnvelopeEvents();


    setupNavigation();


    setupRsvp();


    setupQr();


    setupCountdown();


    await loadGuest();


    console.log(
        "M & C Wedding: Application ready."
    );
}


/* =========================================================
   START
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeWeddingApp
    );

} else {

    initializeWeddingApp();
}


/* =========================================================
   GLOBAL API
========================================================= */

window.MCWedding = {

    openInvitation,

    continueInvitation,

    revealInvitation,

    startWeddingMusic,

    toggleWeddingMusic,

    generateGuestQr,

    downloadQr

};