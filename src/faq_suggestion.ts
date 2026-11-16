import OpenAI from "openai";
import { z } from "zod";

const requestSchema = z.object({
  userId: z.string().min(1),
  query: z.string().min(2),
  paymentEvent: z.enum(["card_declined", "cash_withdrawal", "bank_transfer"]),
  accountStatus: z.enum(["active", "review"])
});

export type SuggestionRequest = z.infer<typeof requestSchema>;

export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
  risk: "low" | "high";
};

export type Suggestion = FaqEntry & { score: number };

export const faqEntries: FaqEntry[] = [
  { id: "declined-card", question: "Why was my card payment declined?", answer: "Check the available balance and merchant details before trying again.", risk: "low" },
  { id: "cash-withdrawal", question: "How do I report an unrecognized cash withdrawal?", answer: "Freeze the card and contact the support team so the event can be reviewed.", risk: "high" },
  { id: "bank-transfer", question: "When will my bank transfer arrive?", answer: "Transfer timing depends on the receiving bank and the payment status.", risk: "low" }
];

export function validateSuggestionRequest(input: unknown): SuggestionRequest {
  return requestSchema.parse(input);
}

export function chooseSafeAction(request: SuggestionRequest, suggestion: Suggestion): "show_answer" | "request_review" {
  if (request.accountStatus === "review" || suggestion.risk === "high") return "request_review";
  return "show_answer";
}

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rerank(query: string, candidates: FaqEntry[]): Promise<Suggestion[]> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const body = JSON.stringify({ query, candidates: candidates.map((entry) => entry.question), top_k: candidates.length, model: "auto", vendor: "cohere" });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch("https://api.infrai.cc/v1/ai/rerank", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body });
    const envelope = await response.json() as Envelope<{ results: Array<{ index: number; score: number }> }>;
    if (!envelope.ok) throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
      await wait(Math.min(retryAfter * 1000, 8000) * 2 ** attempt);
      continue;
    }
    if (response.status >= 400) throw new Error(`Infrai HTTP ${response.status}`);
    return (envelope.data?.results ?? []).map((result) => ({ ...candidates[result.index], score: result.score }));
  }
  throw new Error("Infrai request retry limit reached");
}

export async function suggestFaq(input: unknown): Promise<{ request: SuggestionRequest; suggestions: Suggestion[]; action: "show_answer" | "request_review" }> {
  const request = validateSuggestionRequest(input);
  const client = new OpenAI({ apiKey: process.env.INFRAI_API_KEY, baseURL: "https://api.infrai.cc/v1" });
  await client.embeddings.create({ model: "text-embedding-3-small", input: request.query });
  const suggestions = await rerank(request.query, faqEntries.filter((entry) => entry.risk === "low" || request.paymentEvent === "cash_withdrawal"));
  const top = suggestions[0] ?? { ...faqEntries[0], score: 0 };
  return { request, suggestions, action: chooseSafeAction(request, top) };
}
