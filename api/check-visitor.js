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
   * They are allowed so Google indexing and social previews
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
      reason: "verified_crawler"
    });
  }

  /*
   * Automation / command-line clients.
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
   * No IP = reject.
   */
  if (!ip) {
    return res.status(200).json({
      allowed: false,
      reason: "missing_ip"
    });
  }

  /*
   * IPAPI.IS API key.
   *
   * Vercel:
   * Settings
   * -> Environment Variables
   * -> IPAPI_KEY
   */
  const apiKey = process.env.IPAPI_KEY;

  /*
   * Without API key we cannot reliably determine
   * VPN / Proxy / Tor / Datacenter status.
   *
   * Fail-open to prevent accidental outage.
   */
  if (!apiKey) {
    return res.status(200).json({
      allowed: true,
      reason: "ipapi_key_missing"
    });
  }

  try {
    const url =
      "https://api.ipapi.is/?" +
      "q=" +
      encodeURIComponent(ip) +
      "&key=" +
      encodeURIComponent(apiKey);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    /*
     * Do not block everyone if IPAPI temporarily fails.
     */
    if (!response.ok) {
      return res.status(200).json({
        allowed: true,
        reason: "ip_provider_error"
      });
    }

    const data = await response.json();

    /*
     * Block suspicious IP reputation.
     */
    const blocked =
      data.is_vpn === true ||
      data.is_proxy === true ||
      data.is_tor === true ||
      data.is_datacenter === true ||
      data.is_abuser === true ||
      data.is_bogon === true;

    let reason = "clean";

    if (data.is_vpn === true) {
      reason = "vpn";
    } else if (data.is_proxy === true) {
      reason = "proxy";
    } else if (data.is_tor === true) {
      reason = "tor";
    } else if (data.is_datacenter === true) {
      reason = "datacenter";
    } else if (data.is_abuser === true) {
      reason = "abuser";
    } else if (data.is_bogon === true) {
      reason = "bogon";
    }

    return res.status(200).json({
      allowed: !blocked,
      reason: reason,
      ip: data.ip || ip,
      country: data.country || null,
      asn: data.asn || null
    });
  } catch (error) {
    /*
     * Provider error -> do not lock out normal users.
     */
    return res.status(200).json({
      allowed: true,
      reason: "ip_provider_exception"
    });
  }
}


/*
 * Get visitor IP behind Vercel proxy.
 */
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (forwarded) {
    const firstIp = String(forwarded)
      .split(",")[0]
      .trim();

    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = req.headers["x-real-ip"];

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
