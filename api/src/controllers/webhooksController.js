import * as webhooksService from "../services/webhooksService.js";

export async function postOrder(req, res, next) {
  try {
    const signature = req.get("X-Webhook-Signature");
    if (!signature) {
      return res.status(401).json({ error: "Missing X-Webhook-Signature header" });
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      return res.status(400).json({ error: "Missing request body" });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const result = await webhooksService.handleWebhook(
      rawBody,
      signature,
      payload
    );

    if (result.duplicate) {
      return res.status(200).json({ message: "Event already processed" });
    }

    res.status(200).json({ message: "Event processed" });
  } catch (err) {
    const safeMessages = {
      401: "Authentication failed",
      404: "Resource not found",
      500: "Internal server error"
    };
    if (err.status) {
      return res.status(err.status).json({ error: safeMessages[err.status] || "Request failed" });
    }
    next(err);
  }
}
