export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  /*
   * ==========================================
   * CONFIGURATION
   * ==========================================
   *
   * Vercel Environment Variables:
   *
   * IPINFO_TOKEN=YOUR_IPINFO_TOKEN
   * TARGET_COUNTRY=US
   *
   * TARGET_COUNTRY can be:
   * US
   * CA
   * GB
   * AU
   * etc.
   */

  const TARGET_COUNTRY = String(
    process.env.TARGET_COUNTRY || "US"
  ).trim().toUpperCase();

  /*
   * ==========================================
   * GET VISITOR INFORMATION
   * ==========================================
   */

  const ip = getClientIp(req);

  const userAgent = String(
    req.headers["user-agent"] || ""
  ).toLowerCase();

  /*
   * ==========================================
   * ALLOWED SEARCH / SOCIAL CRAWLERS
   * ==========================================
   *
   * These are allowed so SEO and social previews
   * are not unnecessarily broken.
   */

  const allowedCrawlers = [
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

  if (
    allowedCrawlers.some(function (name) {
      return userAgent.includes(name);
    })
  ) {
    return res.status(200).json({
      allowed: true,
      reason: "verified_crawler",
      country: null
    });
  }

  /*
   * ==========================================
   * BOT / AUTOMATION DETECTION
   * ==========================================
   */

  const automation = [
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
    "spider"
  ];

  if (
    automation.some(function (name) {
      return userAgent.includes(name);
    })
  ) {
    return res.status(200).json({
      allowed: false,
      reason: "browser_automation",
      country: null
    });
  }

  /*
   * ==========================================
   * IP CHECK
   * ==========================================
   */

  if (!ip) {
    return res.status(200).json({
      allowed: false,
      reason: "missing_ip",
      country: null
    });
  }

  /*
   * ==========================================
   * IPINFO TOKEN
   * ==========================================
   */

  const token = process.env.IPINFO_TOKEN;

  /*
   * If token is missing, fail-open.
   *
   * This prevents accidentally blocking the
   * entire website because of configuration.
   */

  if (!token) {
    return res.status(200).json({
      allowed: true,
      reason: "ipinfo_token_missing",
      country: null
    });
  }

  /*
   * ==========================================
   * CALL IPINFO
   * ==========================================
   */

  try {
    const apiUrl =
      "https://ipinfo.io/" +
      encodeURIComponent(ip) +
      "/json?token=" +
      encodeURIComponent(token);

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    /*
     * IPinfo API error.
     *
     * Fail-open so temporary provider failures
     * do not cause a total website outage.
     */

    if (!response.ok) {
      return res.status(200).json({
        allowed: true,
        reason: "ipinfo_provider_error",
        country: null
      });
    }

    const data = await response.json();

    /*
     * ==========================================
     * COUNTRY / GEO
     * ==========================================
     */

    const country = String(
      data.country || ""
    )
      .trim()
      .toUpperCase();

    const geoBlocked =
      country !== TARGET_COUNTRY;

    /*
     * ==========================================
     * IPINFO PRIVACY DATA
     * ==========================================
     */

    const privacy =
      data.privacy ||
      data.anonymous ||
      {};

    /*
     * VPN
     */

    const isVpn =
      privacy.is_vpn === true;

    /*
     * Proxy
     */

    const isProxy =
      privacy.is_proxy === true;

    /*
     * TOR
     */

    const isTor =
      privacy.is_tor === true ||
      privacy.tor === true;

    /*
     * Relay
     */

    const isRelay =
      privacy.is_relay === true ||
      privacy.relay === true;

    /*
     * Hosting / Datacenter
     */

    const isHosting =
      privacy.is_hosting === true ||
      data.is_hosting === true ||
      data.as?.type === "hosting";

    /*
     * Residential Proxy
     */

    const isResidentialProxy =
      privacy.is_res_proxy === true ||
      privacy.is_residential_proxy === true;

    /*
     * ==========================================
     * FINAL BLOCK DECISION
     * ==========================================
     *
     * BLOCK if:
     *
     * 1. Wrong country
     * 2. VPN
     * 3. Proxy
     * 4. TOR
     * 5. Relay
     * 6. Hosting / Datacenter
     * 7. Residential Proxy
     */

    const blocked =
      geoBlocked ||
      isVpn ||
      isProxy ||
      isTor ||
      isRelay ||
      isHosting ||
      isResidentialProxy;

    /*
     * ==========================================
     * BLOCK REASON
     * ==========================================
     *
     * GEO is checked first so visitors outside
     * the target country receive:
     *
     * geo_not_allowed
     */

    let reason = "clean";

    if (geoBlocked) {
      reason = "geo_not_allowed";
    } else if (isVpn) {
      reason = "vpn";
    } else if (isProxy) {
      reason = "proxy";
    } else if (isTor) {
      reason = "tor";
    } else if (isResidentialProxy) {
      reason = "residential_proxy";
    } else if (isHosting) {
      reason = "datacenter";
    } else if (isRelay) {
      reason = "relay";
    }

    /*
     * ==========================================
     * RESPONSE
     * ==========================================
     */

    return res.status(200).json({
      allowed: !blocked,
      reason,

      target_country: TARGET_COUNTRY,

      ip: data.ip || ip,

      country: country || null,

      region: data.region || null,

      city: data.city || null,

      timezone: data.timezone || null,

      asn:
        data.as?.asn ||
        data.org ||
        null,

      privacy: {
        vpn: isVpn,
        proxy: isProxy,
        tor: isTor,
        relay: isRelay,
        hosting: isHosting,
        residential_proxy: isResidentialProxy
      }
    });
  } catch (error) {
    /*
     * ==========================================
     * IPINFO EXCEPTION
     * ==========================================
     *
     * Keep website available if IPinfo has
     * a temporary network/API problem.
     */

    return res.status(200).json({
      allowed: true,
      reason: "ipinfo_provider_exception",
      target_country: TARGET_COUNTRY,
      country: null
    });
  }
}


/*
 * ==========================================
 * GET CLIENT IP
 * ==========================================
 *
 * Vercel runs behind a proxy, so first check
 * x-forwarded-for.
 */

function getClientIp(req) {
  const forwarded =
    req.headers["x-forwarded-for"];

  if (forwarded) {
    const firstIp = String(forwarded)
      .split(",")[0]
      .trim();

    if (firstIp) {
      return firstIp;
    }
  }

  const realIp =
    req.headers["x-real-ip"];

  if (realIp) {
    return String(realIp)
      .trim()
      .replace(/^::ffff:/, "");
  }

  return String(
    req.socket?.remoteAddress || ""
  )
    .trim()
    .replace(/^::ffff:/, "");
}
