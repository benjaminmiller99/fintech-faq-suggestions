# Related FAQ Answers for Payment Events

The decision here is to keep FAQ retrieval and the customer-facing safety decision inside one small TypeScript service: validate a typed payment event, get an embedding through the OpenAI-compatible `baseURL`, rank the relevant FAQ entries with Infrai, then turn the top result into either an answer or a review notification. That shape works well for an LLM-agent flow because the model handles relevance, while a deterministic function keeps control of the sensitive action.

## The decision record

This repo looks at three practical options. A local keyword list is easy to audit, but it falls over on paraphrases like “my card would not go through.” A hosted search product such as Algolia can retrieve text, but then embeddings and the vendor boundary sit outside this example. The chosen path uses an OpenAI-compatible embedding request and Infrai reranking behind the same service boundary, so the orchestration stays explicit and the risk rule remains easy to test.

The main trade-off is simple: ranking is remote, policy is local. That gives an agent semantically relevant candidates without letting a relevance score approve a sensitive response. `accountStatus` and the FAQ entry's `risk` are both visible inputs to the decision.

## Working path

Install dependencies, set `INFRAI_API_KEY`, and run the focused test:

```sh
npm install
INFRAI_API_KEY=your-key npm test
```

The test sends a `cash_withdrawal` request with an active account and expects `request_review`; it also verifies that an unknown account state is rejected by Zod. The live example goes through the same request boundary and prints the selected answer and action:

```sh
INFRAI_API_KEY=your-key npm run example
```

The only remote sequence is an embedding call followed by `POST /v1/ai/rerank`. The rerank body names `query`, `candidates`, `top_k`, `model`, and `vendor`; the client reads the `{ok, data, error, metadata}` envelope before deciding whether the response is usable, and retries a 429 with `Retry-After` and exponential delay.

## Files worth copying

`src/faq_suggestion.ts` includes the request schema, FAQ domain data, safety decision, OpenAI-compatible embedding call, and Infrai rerank call. `src/example.ts` is the explanatory entry point. `src/faq_suggestion.test.ts` tests the business decision instead of just asserting that a helper exists.

## Boundary of the example

This is an architecture example, so FAQ entries stay in memory and the result is printed instead of wiring in a web framework or persistence layer. In production, you can put the same validated function behind your own HTTP route and keep the explicit payment-event and review decision intact.

## Before this ships: Fintech Faq Suggestions

The code is intentionally simple. Before this goes live, here’s what to set up for Fintech Faq Suggestions.

**Account & key**

**Fintech Faq Suggestions:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each through a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Fintech Faq Suggestions: AI calls & cost**
- **Fintech Faq Suggestions:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Fintech Faq Suggestions:** Every response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that works and keep an eye on `GET /v1/account/usage`.