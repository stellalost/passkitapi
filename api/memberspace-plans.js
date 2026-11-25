module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.MEMBERSPACE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      status: "error",
      message: "MEMBERSPACE_API_KEY is missing"
    });
  }

  try {
    const plans = [];
    let cursor = null;
    let pages = 0;

    while (pages < 10) {
      const headers = {
        Authorization: "Bearer " + apiKey,
        Accept: "application/json",
        "X-Items-After": "100"
      };

      if (cursor) {
        headers["X-Cursor"] = cursor;
      }

      const response = await fetch(
        "https://api.memberspace.com/admin/v1/plans",
        { method: "GET", headers: headers }
      );

      const rawResponse = await response.text();

      let body;
      try {
        body = JSON.parse(rawResponse);
      } catch {
        body = { rawResponse: rawResponse.slice(0, 2000) };
      }

      if (!response.ok) {
        return res.status(502).json({
          status: "error",
          memberspaceHttpStatus: response.status,
          details: body
        });
      }

      for (const plan of body) {
        plans.push({
          id: plan.id,
          publicId: plan.publicId,
          name: plan.name,
          status: plan.status,
          type: plan.type,
          isPublic: plan.isPublic,
          activeMemberCount: plan.activeMemberCount
        });
      }

      pages += 1;

      if (response.headers.get("x-has-more-items-after") === "true") {
        cursor = response.headers.get("x-next-cursor");
        if (!cursor) break;
      } else {
        break;
      }
    }

    return res.status(200).json({
      status: "success",
      planCount: plans.length,
      plans: plans
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      errorType: error.name,
      message: error.message
    });
  }
};
