(function () {
  "use strict";

  const CONFIG = Object.assign(
    {
      api: "/api/check-visitor",
      blockUrl: "/not-available.html",
      minWaitMs: 1800,
      requireInteraction: true,
      cacheMs: 30 * 60 * 1000
    },
    window.DIY_GUARD_CONFIG || {}
  );

  const ua = String(navigator.userAgent || "").toLowerCase();

  /*
   * Known automation / bot signatures.
   */
  const AUTOMATION = [
    "headlesschrome",
    "headless",
    "phantomjs",
    "puppeteer",
    "playwright",
    "selenium",
    "webdriver",
    "scrapy",
    "curl",
    "wget",
    "python-requests",
    "python-urllib",
    "httpclient",
    "axios",
    "lighthouse",
    "pagespeed",
    "crawler",
    "spider",
    "bot"
  ];

  /*
   * Search/social preview crawlers.
   * Remove this list if you want ALL bots blocked.
   */
  const ALLOWED_CRAWLERS = [
    "googlebot",
    "bingbot",
    "yandexbot",
    "duckduckbot",
    "facebookexternalhit",
    "facebot",
    "twitterbot",
    "linkedinbot",
    "slackbot",
    "discordbot",
    "telegrambot",
    "pinterest"
  ];

  function contains(list, value) {
    return list.some(function (item) {
      return value.indexOf(item) !== -1;
    });
  }

  function block(reason) {
    try {
      sessionStorage.setItem("blocked_reason", reason);
    } catch (_) {}

    window.location.replace(CONFIG.blockUrl);
  }

  /*
   * Empty / suspicious UA.
   */
  if (!ua || ua.length < 15) {
    block("invalid_user_agent");
    return;
  }

  /*
   * Search/social crawlers are allowed.
   */
  const allowedCrawler = contains(ALLOWED_CRAWLERS, ua);

  /*
   * Detect browser automation.
   */
  const automationDetected =
    contains(AUTOMATION, ua) ||
    navigator.webdriver === true ||
    window.__nightmare !== undefined ||
    window.callPhantom !== undefined ||
    window._phantom !== undefined;

  if (automationDetected && !allowedCrawler) {
    block("browser_automation");
    return;
  }

  /*
   * Human interaction signal.
   */
  let interacted = false;

  [
    "pointerdown",
    "mousedown",
    "touchstart",
    "keydown",
    "scroll",
    "mousemove"
  ].forEach(function (eventName) {
    window.addEventListener(
      eventName,
      function () {
        interacted = true;
      },
      {
        passive: true,
        once: true
      }
    );
  });

  let checked = false;
  const startedAt = Date.now();

  function getCachedDecision() {
    try {
      const raw = sessionStorage.getItem("diy_guard_decision");

      if (!raw) return null;

      const data = JSON.parse(raw);

      if (!data || !data.ts) return null;

      if (Date.now() - data.ts > CONFIG.cacheMs) {
        sessionStorage.removeItem("diy_guard_decision");
        return null;
      }

      return data;
    } catch (_) {
      return null;
    }
  }

  function saveDecision(data) {
    try {
      sessionStorage.setItem(
        "diy_guard_decision",
        JSON.stringify({
          ts: Date.now(),
          allowed: Boolean(data.allowed),
          reason: data.reason || ""
        })
      );
    } catch (_) {}
  }

  async function securityCheck() {
    if (checked || allowedCrawler) {
      return true;
    }

    checked = true;

    const cached = getCachedDecision();

    if (cached) {
      if (!cached.allowed) {
        block(cached.reason || "blocked");
        return false;
      }

      return true;
    }

    try {
      const response = await fetch(CONFIG.api, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        /*
         * Do not accidentally block all legitimate visitors
         * when the security API has a temporary problem.
         */
        saveDecision({
          allowed: true,
          reason: "security_api_unavailable"
        });

        return true;
      }

      const result = await response.json();

      saveDecision(result);

      if (!result.allowed) {
        block(result.reason || "visitor_blocked");
        return false;
      }

      return true;
    } catch (_) {
      saveDecision({
        allowed: true,
        reason: "security_check_failed"
      });

      return true;
    }
  }

  /*
   * Start IP / reputation check immediately.
   */
  securityCheck();

  /*
   * Additional human interaction check.
   */
  const timer = setInterval(function () {
    const elapsed = Date.now() - startedAt;

    if (
      elapsed >= CONFIG.minWaitMs &&
      (!CONFIG.requireInteraction || interacted)
    ) {
      clearInterval(timer);
      securityCheck();
    }
  }, 250);

  /*
   * Safety timeout.
   */
  setTimeout(function () {
    clearInterval(timer);
  }, CONFIG.minWaitMs + 10000);
})();
