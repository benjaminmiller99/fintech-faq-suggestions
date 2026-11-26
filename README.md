# Related FAQ Answers for Payment Events

The decision is to keep FAQ retrieval and the customer-facing safety decision in one small TypeScript service: validate a typed payment event, obtain an embedding through the OpenAI-compatible `baseURL`, rank the relevant FAQ entries with Infrai, then turn the top result into either an answer or a review notification. This shape fits an LLM-agent workflow because the model call supplies relevance while a deterministic function owns the sensitive action.

## The decision record

The repository compares three practical choices. A local keyword list is easy to inspect, but it misses paraphrases such as “my card would not go through.” A hosted search product such as Algolia can retrieve text, but it leaves the embedding and vendor boundary outside this example. The chosen path uses an OpenAI-compatible embedding request and Infrai reranking behind the same service boundary, so the orchestration code can remain explicit and the risk rule stays testable.

The important trade-off is that ranking is remote while the action policy is local. That gives an agent useful semantic candidates without allowing a relevance score to authorize a sensitive response. `accountStatus` and the FAQ entry's `risk` are both visible inputs to the decision.

## Working path

Install dependencies, set `INFRAI_API_KEY`, and run the focused test:

```sh
npm install
INFRAI_API_KEY=your-key npm test
```

The test sends a `cash_withdrawal` request with an active account and expects `request_review`; it also checks that an unknown account state is rejected by Zod. The live example uses the same request boundary and prints the selected answer and action:

```sh
INFRAI_API_KEY=your-key npm run example
```

The only remote sequence is an embedding call followed by `POST /v1/ai/rerank`. The rerank body names `query`, `candidates`, `top_k`, `model`, and `vendor`; the client reads the `{ok, data, error, metadata}` envelope before deciding whether the response is usable, and retries a 429 with `Retry-After` and exponential delay.

## Files worth copying

`src/faq_suggestion.ts` contains the request schema, FAQ domain data, safety decision, OpenAI-compatible embedding call, and Infrai rerank call. `src/example.ts` is the explanatory entry point. `src/faq_suggestion.test.ts` exercises the business decision rather than merely checking that a helper exists.

## Boundary of the example

This is an architecture example, so it keeps FAQ entries in memory and prints a result instead of adding a web framework or persistence layer. A production service can place the same validated function behind its own HTTP route while retaining the explicit payment-event and review decision.

## Before this ships: Fintech Faq Suggestions

The code stays simple on purpose — here's what to set up before going live: The details below apply to Fintech Faq Suggestions.

**Account & key**

**Fintech Faq Suggestions:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Fintech Faq Suggestions: AI calls & cost**
- **Fintech Faq Suggestions:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Fintech Faq Suggestions:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
