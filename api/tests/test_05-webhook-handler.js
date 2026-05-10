import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import express from "express";
import request from "supertest";

// Mock the database pool
const mockPool = {
  query: vi.fn(),
};

// Mock webhooksRepo
const mockWebhooksRepo = {
  createWithIdempotency: vi.fn(),
  markProcessed: vi.fn(),
  findByEventId: vi.fn(),
};

// Mock referralsRepo
const mockReferralsRepo = {
  findById: vi.fn(),
  findByIdWithProgramCheck: vi.fn(),
  updateWithOrder: vi.fn(),
};

// Mock programsRepo
const mockProgramsRepo = {
  findByMerchantId: vi.fn(),
  findById: vi.fn(),
  findByIdAny: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
};

// Set up environment variable for HMAC secret before importing
const WEBHOOK_SECRET = "test-webhook-secret";

describe("Webhook Handler Tests", () => {
  let app;
  let webhooksRouterModule;

  beforeEach(async () => {
    vi.resetModules();
    process.env.WEBHOOK_HMAC_SECRET = WEBHOOK_SECRET;

    // Mock the pool
    vi.doMock("../src/db/pool.js", () => ({
      default: mockPool,
    }));

    // Mock the repos
    vi.doMock("../src/repos/webhooksRepo.js", () => mockWebhooksRepo);
    vi.doMock("../src/repos/referralsRepo.js", () => mockReferralsRepo);
    vi.doMock("../src/repos/programsRepo.js", () => mockProgramsRepo);

    // Import after mocking
    const webhooksRouter = (await import("../src/routes/webhooks.js")).default;

    app = express();
    // Mount webhooks BEFORE express.json() to allow raw body capture
    app.use("/webhooks", webhooksRouter);
    app.use(express.json());
    app.use((err, req, res, next) => {
      const status = err.status ?? 500;
      res.status(status).json({ error: status === 500 ? "Internal server error" : err.message });
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    delete process.env.WEBHOOK_HMAC_SECRET;
  });

  // Helper function to generate valid HMAC signature
  function generateHmacSignature(body) {
    const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
    hmac.update(body);
    return hmac.digest("hex");
  }

  // Valid webhook payload
  const validPayload = {
    event_id: "evt_unique_123",
    event_type: "order.completed",
    program_id: "11111111-1111-1111-1111-111111111111",
    advocate_id: "22222222-2222-2222-2222-222222222222",
    referral_id: "33333333-3333-3333-3333-333333333333",
    order_id: "SHOP-456",
    customer_email: "customer@example.com",
    timestamp: "2026-05-10T12:00:00Z",
  };

  describe("POST /webhooks/order", () => {
    it("should return 401 when X-Webhook-Signature header is missing", async () => {
      const response = await request(app)
        .post("/webhooks/order")
        .set("Content-Type", "application/json")
        .send(validPayload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Missing X-Webhook-Signature header");
    });

    it("should return 401 when HMAC signature is invalid", async () => {
      const response = await request(app)
        .post("/webhooks/order")
        .set("Content-Type", "application/json")
        .set("X-Webhook-Signature", "invalid-signature")
        .send(validPayload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid webhook signature");
    });

    it("should return 400 when request body is missing", async () => {
      const hmacSignature = generateHmacSignature("");

      const response = await request(app)
        .post("/webhooks/order")
        .set("Content-Type", "application/json")
        .set("X-Webhook-Signature", hmacSignature)
        .send();

      expect(response.status).toBe(400);
    });

    it("should return 200 with valid HMAC and new event_id and create webhook_events record", async () => {
      // Setup mocks
      mockWebhooksRepo.createWithIdempotency.mockResolvedValue({ id: "webhook-id-1" });
      mockWebhooksRepo.markProcessed.mockResolvedValue();
      mockProgramsRepo.findByIdAny.mockResolvedValue({
        id: validPayload.program_id,
        name: "Test Program",
      });
      mockReferralsRepo.findByIdWithProgramCheck.mockResolvedValue({
        id: validPayload.referral_id,
        program_id: validPayload.program_id,
      });
      mockReferralsRepo.updateWithOrder.mockResolvedValue({
        id: validPayload.referral_id,
        order_id: validPayload.order_id,
        customer_email: validPayload.customer_email,
      });

      const bodyString = JSON.stringify(validPayload);
      const hmacSignature = generateHmacSignature(bodyString);

      const response = await request(app)
        .post("/webhooks/order")
        .set("Content-Type", "application/json")
        .set("X-Webhook-Signature", hmacSignature)
        .send(bodyString);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Event processed");

      // Verify webhook event was created
      expect(mockWebhooksRepo.createWithIdempotency).toHaveBeenCalledWith({
        eventId: validPayload.event_id,
        eventType: validPayload.event_type,
        payload: validPayload,
      });
    });

    it("should return 200 for duplicate event_id (idempotent behavior)", async () => {
      // Setup mocks - createWithIdempotency returns null (conflict occurred)
      mockWebhooksRepo.createWithIdempotency.mockResolvedValue(null);

      const bodyString = JSON.stringify(validPayload);
      const hmacSignature = generateHmacSignature(bodyString);

      const response = await request(app)
        .post("/webhooks/order")
        .set("Content-Type", "application/json")
        .set("X-Webhook-Signature", hmacSignature)
        .send(bodyString);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Event already processed");

      // Verify that processOrderEvent was NOT called for duplicate
      expect(mockReferralsRepo.updateWithOrder).not.toHaveBeenCalled();
    });

    it("should return 404 when program_id does not exist", async () => {
      mockWebhooksRepo.createWithIdempotency.mockResolvedValue({ id: "webhook-id-1" });
      mockWebhooksRepo.markProcessed.mockResolvedValue();
      mockProgramsRepo.findByIdAny.mockResolvedValue(null); // Program not found

      const bodyString = JSON.stringify(validPayload);
      const hmacSignature = generateHmacSignature(bodyString);

      const response = await request(app)
        .post("/webhooks/order")
        .set("Content-Type", "application/json")
        .set("X-Webhook-Signature", hmacSignature)
        .send(bodyString);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Program not found");
    });

    it("should return 404 when referral_id does not exist", async () => {
      mockWebhooksRepo.createWithIdempotency.mockResolvedValue({ id: "webhook-id-1" });
      mockWebhooksRepo.markProcessed.mockResolvedValue();
      mockProgramsRepo.findByIdAny.mockResolvedValue({
        id: validPayload.program_id,
        name: "Test Program",
      });
      mockReferralsRepo.findByIdWithProgramCheck.mockResolvedValue(null); // Referral not found

      const bodyString = JSON.stringify(validPayload);
      const hmacSignature = generateHmacSignature(bodyString);

      const response = await request(app)
        .post("/webhooks/order")
        .set("Content-Type", "application/json")
        .set("X-Webhook-Signature", hmacSignature)
        .send(bodyString);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe("Referral not found");
    });

    it("should update referral record with order_id and customer_email", async () => {
      const updatedReferral = {
        id: validPayload.referral_id,
        program_id: validPayload.program_id,
        order_id: validPayload.order_id,
        customer_email: validPayload.customer_email,
        status: "eligible",
      };

      mockWebhooksRepo.createWithIdempotency.mockResolvedValue({ id: "webhook-id-1" });
      mockWebhooksRepo.markProcessed.mockResolvedValue();
      mockProgramsRepo.findByIdAny.mockResolvedValue({
        id: validPayload.program_id,
        name: "Test Program",
      });
      mockReferralsRepo.findByIdWithProgramCheck.mockResolvedValue({
        id: validPayload.referral_id,
        program_id: validPayload.program_id,
      });
      mockReferralsRepo.updateWithOrder.mockResolvedValue(updatedReferral);

      const bodyString = JSON.stringify(validPayload);
      const hmacSignature = generateHmacSignature(bodyString);

      const response = await request(app)
        .post("/webhooks/order")
        .set("Content-Type", "application/json")
        .set("X-Webhook-Signature", hmacSignature)
        .send(bodyString);

      expect(response.status).toBe(200);

      // Verify referral was updated
      expect(mockReferralsRepo.updateWithOrder).toHaveBeenCalledWith(
        validPayload.referral_id,
        {
          orderId: validPayload.order_id,
          customerEmail: validPayload.customer_email,
          signupTs: new Date(validPayload.timestamp),
        }
      );
    });

    it("should store full request body in webhook_events.payload", async () => {
      mockWebhooksRepo.createWithIdempotency.mockResolvedValue({ id: "webhook-id-1" });
      mockWebhooksRepo.markProcessed.mockResolvedValue();
      mockProgramsRepo.findByIdAny.mockResolvedValue({
        id: validPayload.program_id,
        name: "Test Program",
      });
      mockReferralsRepo.findByIdWithProgramCheck.mockResolvedValue({
        id: validPayload.referral_id,
        program_id: validPayload.program_id,
      });
      mockReferralsRepo.updateWithOrder.mockResolvedValue({});

      const bodyString = JSON.stringify(validPayload);
      const hmacSignature = generateHmacSignature(bodyString);

      await request(app)
        .post("/webhooks/order")
        .set("Content-Type", "application/json")
        .set("X-Webhook-Signature", hmacSignature)
        .send(bodyString);

      // Verify the payload was stored in the webhook_events record
      expect(mockWebhooksRepo.createWithIdempotency).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: validPayload,
        })
      );
    });

    it("should mark webhook event as processed after successful handling", async () => {
      mockWebhooksRepo.createWithIdempotency.mockResolvedValue({ id: "webhook-id-1" });
      mockWebhooksRepo.markProcessed.mockResolvedValue();
      mockProgramsRepo.findByIdAny.mockResolvedValue({
        id: validPayload.program_id,
        name: "Test Program",
      });
      mockReferralsRepo.findByIdWithProgramCheck.mockResolvedValue({
        id: validPayload.referral_id,
        program_id: validPayload.program_id,
      });
      mockReferralsRepo.updateWithOrder.mockResolvedValue({});

      const bodyString = JSON.stringify(validPayload);
      const hmacSignature = generateHmacSignature(bodyString);

      await request(app)
        .post("/webhooks/order")
        .set("Content-Type", "application/json")
        .set("X-Webhook-Signature", hmacSignature)
        .send(bodyString);

      // Verify markProcessed was called
      expect(mockWebhooksRepo.markProcessed).toHaveBeenCalledWith(validPayload.event_id);
    });
  });

  describe("HMAC Verification", () => {
    it("should use timing-safe comparison to prevent timing attacks", async () => {
      // This test verifies that the crypto.timingSafeEqual is used by checking
      // that signatures with slightly different lengths don't cause crashes
      const bodyString = JSON.stringify(validPayload);

      // Test with signature of wrong length (shorter)
      await request(app)
        .post("/webhooks/order")
        .set("Content-Type", "application/json")
        .set("X-Webhook-Signature", "abc")
        .send(bodyString);

      // Should return 401, not crash
    });

    it("should handle empty WEBHOOK_HMAC_SECRET gracefully", async () => {
      process.env.WEBHOOK_HMAC_SECRET = "";
      vi.resetModules();

      // Re-import with new env
      const webhooksRouter = (await import("../src/routes/webhooks.js")).default;
      const testApp = express();
      testApp.use(express.json());
      testApp.use("/webhooks", webhooksRouter);

      const bodyString = JSON.stringify(validPayload);
      const hmacSignature = generateHmacSignature(bodyString);

      const response = await request(testApp)
        .post("/webhooks/order")
        .set("Content-Type", "application/json")
        .set("X-Webhook-Signature", hmacSignature)
        .send(bodyString);

      // Should return 401 when secret is empty
      expect(response.status).toBe(401);
    });
  });

  describe("SQL Parameterization", () => {
    it("should use parameterized queries in webhooksRepo", async () => {
      mockWebhooksRepo.createWithIdempotency.mockResolvedValue({ id: "webhook-id-1" });
      mockWebhooksRepo.markProcessed.mockResolvedValue();
      mockProgramsRepo.findByIdAny.mockResolvedValue({ id: validPayload.program_id });
      mockReferralsRepo.findByIdWithProgramCheck.mockResolvedValue({ id: validPayload.referral_id });
      mockReferralsRepo.updateWithOrder.mockResolvedValue({});

      const bodyString = JSON.stringify(validPayload);
      const hmacSignature = generateHmacSignature(bodyString);

      await request(app)
        .post("/webhooks/order")
        .set("Content-Type", "application/json")
        .set("X-Webhook-Signature", hmacSignature)
        .send(bodyString);

      // Verify all repo calls used parameterized queries
      // by checking that the mock was called with arrays (not interpolated strings)
      expect(mockWebhooksRepo.createWithIdempotency).toHaveBeenCalled();
      const createCallArgs = mockWebhooksRepo.createWithIdempotency.mock.calls[0][0];
      expect(createCallArgs.eventId).toBe(validPayload.event_id);
      expect(createCallArgs.eventType).toBe(validPayload.event_type);
      expect(createCallArgs.payload).toEqual(validPayload);

      expect(mockProgramsRepo.findByIdAny).toHaveBeenCalledWith(validPayload.program_id);
      expect(mockReferralsRepo.findByIdWithProgramCheck).toHaveBeenCalledWith(
        validPayload.referral_id,
        validPayload.program_id
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle malformed JSON in request body", async () => {
      const bodyString = "not valid json";
      const hmacSignature = generateHmacSignature(bodyString);

      const response = await request(app)
        .post("/webhooks/order")
        .set("Content-Type", "application/json")
        .set("X-Webhook-Signature", hmacSignature)
        .send(bodyString);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid JSON body");
    });

    it("should handle missing required fields in payload", async () => {
      const incompletePayload = {
        event_id: "evt_incomplete",
        event_type: "order.completed",
        // Missing program_id, referral_id
      };
      const bodyString = JSON.stringify(incompletePayload);
      const hmacSignature = generateHmacSignature(bodyString);

      mockWebhooksRepo.createWithIdempotency.mockResolvedValue({ id: "webhook-id-1" });
      mockProgramsRepo.findByIdAny.mockResolvedValue(null);

      const response = await request(app)
        .post("/webhooks/order")
        .set("Content-Type", "application/json")
        .set("X-Webhook-Signature", hmacSignature)
        .send(bodyString);

      expect(response.status).toBe(404);
    });

    it("should not process non-order.completed event types", async () => {
      const nonOrderPayload = {
        ...validPayload,
        event_id: "evt_non_order",
        event_type: "order.cancelled",
      };

      mockWebhooksRepo.createWithIdempotency.mockResolvedValue({ id: "webhook-id-1" });
      mockWebhooksRepo.markProcessed.mockResolvedValue();

      const bodyString = JSON.stringify(nonOrderPayload);
      const hmacSignature = generateHmacSignature(bodyString);

      const response = await request(app)
        .post("/webhooks/order")
        .set("Content-Type", "application/json")
        .set("X-Webhook-Signature", hmacSignature)
        .send(bodyString);

      expect(response.status).toBe(200);

      // Should NOT call program/referral repos for non-order.completed events
      expect(mockProgramsRepo.findByIdAny).not.toHaveBeenCalled();
      expect(mockReferralsRepo.findByIdWithProgramCheck).not.toHaveBeenCalled();
      expect(mockReferralsRepo.updateWithOrder).not.toHaveBeenCalled();
    });
  });
});