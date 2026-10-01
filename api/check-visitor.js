export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  const ip = getClientIp(req);

  const userAgent = String(
    req.headers["user-agent"] || ""
  ).toLowerCase();

  /*
   * Search/social crawlers.
   * Allowed so SEO and social previews continue working.
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
      reason: "verified_crawler"
    });
  }

  /*
   * Browser automation / command-line detection.
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
      reason: "browser_automation"
    });
  }

  /*
   * No visitor IP.
   */
  if (!ip) {
    return res.status(200).json({
      allowed: false,
      reason: "missing_ip"
    });
  }

  /*
   * IPinfo token.
   *
   * Vercel:
   * Settings
   * -> Environment Variables
   *
   * Name:
   * IPINFO_TOKEN
   */
  const token = process.env.IPINFO_TOKEN;

  /*
   * Token missing.
   *
   * Fail-open so a configuration mistake does not
   * accidentally take the whole website offline.
   */
  if (!token) {
    return res.status(200).json({
      allowed: true,
      reason: "ipinfo_token_missing"
    });
  }

  try {
    /*
     * IPinfo API.
     *
     * Privacy fields are returned on plans that include
     * Privacy Detection.
     */
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

    if (!response.ok) {
      return res.status(200).json({
        allowed: true,
        reason: "ipinfo_provider_error"
      });
    }

    const data = await response.json();

    /*
     * IPinfo Privacy Detection.
     *
     * Depending on IPinfo response/plan, privacy data
     * can appear under:
     *
     * data.privacy
     * data.anonymous
     */
    const privacy =
      data.privacy ||
      data.anonymous ||
      {};

    const isVpn =
      privacy.is_vpn === true;

    const isProxy =
      privacy.is_proxy === true;

    const isTor =
      privacy.is_tor === true ||
      privacy.tor === true;

    const isRelay =
      privacy.is_relay === true ||
      privacy.relay === true;

    const isHosting =
      privacy.is_hosting === true ||
      data.is_hosting === true ||
      data.as?.type === "hosting";

    const isResidentialProxy =
      privacy.is_res_proxy === true ||
      privacy.is_residential_proxy === true;

    /*
     * BLOCK:
     *
     * VPN
     * Proxy
     * Tor
     * Hosting / Datacenter
     * Residential Proxy
     * Relay
     */
    const blocked =
      isVpn ||
      isProxy ||
      isTor ||
      isRelay ||
      isHosting ||
      isResidentialProxy;

    let reason = "clean";

    if (isVpn) {
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

    return res.status(200).json({
      allowed: !blocked,
      reason,

      ip: data.ip || ip,

      country:
        data.country ||
        data.country_code ||
        null,

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
     * IPinfo temporary error.
     *
     * Do not block legitimate traffic because
     * the external provider is temporarily unavailable.
     */
    return res.status(200).json({
      allowed: true,
      reason: "ipinfo_provider_exception"
    });
  }
}


/*
 * Get visitor IP behind Vercel.
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
