const crypto = require("crypto");

const ALLOWED_TIERS = ["circus", "access_z", "access_y", "access_x"];

function base64url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createToken(key, secret) {
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    uid: key,
    iat: now,
    exp: now + 300
  };

  const unsigned =
    base64url(JSON.stringify(header)) + "." +
    base64url(JSON.stringify(payload));

  const signature = crypto
    .createHmac("sha256", secret)
    .update(unsigned)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return unsigned + "." + signature;
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const tierId = req.query.tierId;

  if (!ALLOWED_TIERS.includes(tierId)) {
    return res.status(400).json({
      status: "error",
      message: "tierId must be one of: " + ALLOWED_TIERS.join(", ")
    });
  }

  const key = process.env.PASSKIT_API_KEY;
  const secret = process.env.PASSKIT_API_SECRET;
  const baseUrl = process.env.PASSKIT_API_BASE_URL;
  const programId = process.env.PASSKIT_PROGRAM_ID;

  if (!key || !secret || !baseUrl || !programId) {
    return res.status(500).json({
      status: "error",
      message: "Required environment variables are missing"
    });
  }

  try {
    const token = createToken(key, secret);

    const url =
      baseUrl.replace(/\/$/, "") +
      "/members/tier/" +
      encodeURIComponent(programId) +
      "/" +
      encodeURIComponent(tierId);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: token,
        Accept: "application/json"
      }
    });

    const rawResponse = await response.text();

    let result;
    try {
      result = JSON.parse(rawResponse);
    } catch {
      result = { rawResponse: rawResponse.slice(0, 2000) };
    }

    return res.status(response.ok ? 200 : 502).json({
      status: response.ok ? "success" : "error",
      requestedTierId: tierId,
      passkitHttpStatus: response.status,
      contentType: response.headers.get("content-type"),
      responseBody: result
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      errorType: error.name,
      message: error.message
    });
  }
};
