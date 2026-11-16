import { suggestFaq } from "./faq_suggestion.ts";

const result = await suggestFaq({
  userId: "demo-user",
  query: "my card payment was declined",
  paymentEvent: "card_declined",
  accountStatus: "active"
});

console.log(JSON.stringify({ answer: result.suggestions[0]?.answer, action: result.action }, null, 2));
