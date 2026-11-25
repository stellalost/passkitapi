
const crypto = require("crypto");

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

    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/members/tiers/list`,
      {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
            programId: programId,
  filters: {
    limit: 100,
    offset: 0,
    orderBy: "created",
    orderAsc: true,
    filterGroups: [{
      condition: "AND",
      fieldFilters: [{
        filterField: "programId",
        filterValue: programId,
        filterOperator: "eq"
              }]
            }]
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        status: "error",
        passkitStatus: response.status,
        details: result
      });
    }

    return res.status(200).json({
      status: "success",
      tiers: result
    });

  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Could not retrieve PassKit tiers"
    });
  }
};
