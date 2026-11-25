
const crypto = require("crypto");

function base64url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createPassKitToken(key, secret) {
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

  const key = process.env.PASSKIT_API_KEY;
  const secret = process.env.PASSKIT_API_SECRET;
  const baseUrl = process.env.PASSKIT_API_BASE_URL;

  if (!key || !secret || !baseUrl) {
    return res.status(500).json({
      status: "error",
      message: "PassKit environment variables are missing"
    });
  }

  try {
    const token = createPassKitToken(key, secret);

    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/user/profile`,
      {
        method: "GET",
        headers: {
          Authorization: token,
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      return res.status(502).json({
        status: "error",
        passkitStatus: response.status
      });
    }

    return res.status(200).json({
      status: "connected",
      service: "PassKit"
    });

  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Could not reach PassKit"
    });
  }
};

