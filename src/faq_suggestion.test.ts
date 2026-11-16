import test from "node:test";
import assert from "node:assert/strict";
import { chooseSafeAction, validateSuggestionRequest, type Suggestion } from "./faq_suggestion.ts";

test("a high-risk payment answer becomes a review notification", () => {
  const request = validateSuggestionRequest({ userId: "u-7", query: "cash withdrawal", paymentEvent: "cash_withdrawal", accountStatus: "active" });
  const suggestion: Suggestion = { id: "cash-withdrawal", question: "How do I report an unrecognized cash withdrawal?", answer: "Freeze the card.", risk: "high", score: 0.95 };
  assert.equal(chooseSafeAction(request, suggestion), "request_review");
});

test("invalid account state is rejected at the request boundary", () => {
  assert.throws(() => validateSuggestionRequest({ userId: "u-7", query: "card", paymentEvent: "card_declined", accountStatus: "unknown" }));
});
