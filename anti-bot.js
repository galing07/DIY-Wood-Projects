```javascript
(function () {
    "use strict";

    /*
    =====================================================
    DIY WOOD PROJECTS
    ANTI-BOT / HUMAN INTERACTION GATE
    =====================================================
    */

    var CONFIG = {

        /*
         * Link Adsterra
         */
        ADSTERRA_URL:
            "https://bagelstoppage.com/yvkm7ciys5?key=55550460b8cbed46647f36c867e5577f",

        /*
         * Minimum waktu tunggu.
         * 2800 = 2.8 detik
         */
        MIN_WAIT_MS: 2800,

        /*
         * Pengunjung harus melakukan interaksi
         */
        REQUIRE_INTERACTION: true,

        /*
         * FALSE agar desktop juga bisa.
         */
        REQUIRE_TOUCH: false,

        /*
         * FALSE = Android + iPhone + iPad + Desktop
         */
        ANDROID_ONLY: false,

        /*
         * Jika TRUE:
         * URL harus mempunyai ?src=popads
         *
         * Jika FALSE:
         * /continue.html juga bisa.
         */
        REQUIRE_SRC: false,

        REQUIRED_SRC: "popads",

        /*
         * Halaman fallback
         */
        SAFE_URL: "/not-available.html",

        /*
         * ID tombol
         */
        BUTTON_ID: "goBtn",

        /*
         * Status ID
         */
        STATUS_ID: "status"
    };


    /*
    =====================================================
    HELPER
    =====================================================
    */

    function getParam(name) {

        try {

            var url =
                new URL(
                    window.location.href
                );

            return (
                url.searchParams.get(name)
                || ""
            ).toLowerCase();

        } catch (e) {

            return "";

        }
    }


    /*
    =====================================================
    SAFE REDIRECT
    =====================================================
    */

    function goSafe(reason) {

        try {

            sessionStorage.setItem(
                "blocked_reason",
                reason
            );

        } catch (e) {}

        window.location.replace(
            CONFIG.SAFE_URL
        );
    }


    /*
    =====================================================
    SEARCH LIST
    =====================================================
    */

    function containsAny(
        text,
        list
    ) {

        for (
            var i = 0;
            i < list.length;
            i++
        ) {

            if (
                text.indexOf(
                    list[i]
                ) !== -1
            ) {

                return true;

            }
        }

        return false;
    }


    /*
    =====================================================
    USER AGENT
    =====================================================
    */

    var ua =
        (
            navigator.userAgent
            || ""
        ).toLowerCase();


    if (
        !ua ||
        ua.length < 15
    ) {

        return goSafe(
            "ua_empty"
        );

    }


    /*
    =====================================================
    BASIC BOT DETECTION
    =====================================================
    */

    var botKeywords = [

        "bot",
        "crawler",
        "crawl",
        "spider",
        "slurp",

        "headless",
        "phantomjs",

        "puppeteer",
        "selenium",

        "scrapy",

        "curl",
        "wget",

        "httpclient",

        "scanner",

        "lighthouse",
        "pagespeed"

    ];


    var previewBots = [

        "facebookexternalhit",
        "facebot",

        "twitterbot",

        "telegrambot",

        "discordbot",

        "whatsapp",

        "skypeuripreview",

        "linkedinbot",

        "slackbot",

        "pinterest"

    ];


    if (
        containsAny(
            ua,
            botKeywords
        )
    ) {

        return goSafe(
            "ua_bot"
        );

    }


    if (
        containsAny(
            ua,
            previewBots
        )
    ) {

        return goSafe(
            "preview_bot"
        );

    }


    /*
    =====================================================
    WEBDRIVER
    =====================================================
    */

    if (
        navigator.webdriver === true
    ) {

        return goSafe(
            "webdriver"
        );

    }


    /*
    =====================================================
    DEVICE CHECK
    =====================================================
    */

    var isMobile =
        /android|iphone|ipad|ipod|mobile/
        .test(ua);


    /*
     * Hanya dijalankan jika Android Only
     */
    if (CONFIG.ANDROID_ONLY) {

        var isAndroid =
            ua.indexOf(
                "android"
            ) !== -1;

        if (!isAndroid) {

            return goSafe(
                "not_android"
            );

        }
    }


    /*
    =====================================================
    TOUCH CHECK
    =====================================================
    */

    if (
        CONFIG.REQUIRE_TOUCH
    ) {

        var hasTouch =
            (
                "ontouchstart"
                in window
            )
            ||
            (
                navigator.maxTouchPoints > 0
            );


        if (!hasTouch) {

            return goSafe(
                "no_touch"
            );

        }
    }


    /*
    =====================================================
    SCREEN CHECK
    =====================================================
    */

    try {

        if (
            screen.width < 320 ||
            screen.height < 320
        ) {

            return goSafe(
                "screen_small"
            );

        }

    } catch (e) {}


    /*
    =====================================================
    SOURCE CHECK
    =====================================================
    */

    if (
        CONFIG.REQUIRE_SRC
    ) {

        var src =
            getParam("src");


        if (
            src !==
            CONFIG.REQUIRED_SRC
        ) {

            return goSafe(
                "bad_src"
            );

        }
    }


    /*
    =====================================================
    HUMAN INTERACTION
    =====================================================
    */

    var startTime =
        Date.now();


    var interacted =
        false;


    var button =
        document.getElementById(
            CONFIG.BUTTON_ID
        );


    var status =
        document.getElementById(
            CONFIG.STATUS_ID
        );


    /*
    =====================================================
    STATUS
    =====================================================
    */

    function setStatus(text) {

        if (!status) {
            return;
        }

        status.innerText =
            text;
    }


    /*
    =====================================================
    BUTTON
    =====================================================
    */

    function setButton(
        enabled
    ) {

        if (!button) {
            return;
        }


        if (enabled) {

            button.classList.remove(
                "locked"
            );

            button.classList.add(
                "ready"
            );

            button.style.opacity =
                "1";

            button.style.pointerEvents =
                "auto";

            button.innerHTML =
                button.getAttribute(
                    "data-text-ready"
                )
                ||
                "CONTINUE";


            setStatus(
                "Ready. Click Continue."
            );

        } else {

            button.classList.add(
                "locked"
            );

            button.classList.remove(
                "ready"
            );

            button.style.opacity =
                "0.55";

            button.style.pointerEvents =
                "none";

            button.innerHTML =
                '<span class="spinner"></span>' +
                (
                    button.getAttribute(
                        "data-text-lock"
                    )
                    ||
                    "PLEASE WAIT…"
                );

        }
    }


    /*
    =====================================================
    MARK INTERACTION
    =====================================================
    */

    function markInteraction() {

        interacted =
            true;


        try {

            sessionStorage.setItem(
                "human_interaction",
                "1"
            );

        } catch (e) {}


        unlockButton();
    }


    /*
    =====================================================
    UNLOCK
    =====================================================
    */

    function unlockButton() {

        var elapsed =
            Date.now() -
            startTime;


        var timeOK =
            elapsed >=
            CONFIG.MIN_WAIT_MS;


        var interactionOK =
            !CONFIG.REQUIRE_INTERACTION
            ||
            interacted;


        if (
            timeOK &&
            interactionOK
        ) {

            setButton(true);

        } else {

            var remaining =
                Math.max(
                    0,
                    CONFIG.MIN_WAIT_MS -
                    elapsed
                );


            if (
                remaining > 0
            ) {

                setStatus(
                    "Please wait " +
                    (
                        remaining / 1000
                    ).toFixed(1) +
                    " seconds..."
                );

            } else {

                setStatus(
                    "Please interact with the page."
                );

            }
        }
    }


    /*
    =====================================================
    EVENTS
    =====================================================
    */

    window.addEventListener(
        "touchstart",
        markInteraction,
        {
            passive: true
        }
    );


    window.addEventListener(
        "pointerdown",
        markInteraction,
        {
            passive: true
        }
    );


    window.addEventListener(
        "mousemove",
        markInteraction,
        {
            passive: true
        }
    );


    window.addEventListener(
        "keydown",
        markInteraction
    );


    window.addEventListener(
        "scroll",
        function () {

            if (
                window.scrollY > 5
            ) {

                markInteraction();

            }

        },
        {
            passive: true
        }
    );


    /*
    =====================================================
    INITIALIZE
    =====================================================
    */

    setButton(false);


    /*
    =====================================================
    TIMER
    =====================================================
    */

    var interval =
        setInterval(
            function () {

                unlockButton();

            },
            250
        );


    setTimeout(
        function () {

            clearInterval(
                interval
            );

        },
        CONFIG.MIN_WAIT_MS + 10000
    );


    /*
    =====================================================
    REDIRECT
    =====================================================
    */

    window.safeRedirect =
        function () {

            var elapsed =
                Date.now() -
                startTime;


            if (
                elapsed <
                CONFIG.MIN_WAIT_MS
            ) {

                setStatus(
                    "Please wait a moment..."
                );

                return;
            }


            if (
                CONFIG.REQUIRE_INTERACTION
                &&
                !interacted
            ) {

                setStatus(
                    "Please interact with the page first."
                );

                return;
            }


            /*
             * Redirect ke Adsterra
             */
            window.location.href =
                CONFIG.ADSTERRA_URL;

        };


    /*
    =====================================================
    BUTTON CLICK
    =====================================================
    */

    if (button) {

        button.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                window.safeRedirect();

            }
        );
    }

})();
```
