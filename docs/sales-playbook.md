# Sales playbook: how Prospex writes messages that get answered

Prospex writes first messages, follow-ups and replies for any kind of business in any country. This page explains what the writer is told, what code still checks, and what is deliberately left to the model. Source: `apps/api/src/messaging/sales-playbook.ts`, `outreach-agent-prompt.ts`, `ai/chat-import/style-prompt.ts`, `reply-plan.ts`.

## Design

**One expert, no industry.** Every prompt starts from the same persona (`SALES_PERSONA`): a marketing and sales expert with decades of field experience across many kinds of business and countries, who sees how a business earns money and where it leaks it, and sells by being useful. The persona is how the model thinks. It never appears in a message: a draft must not boast about experience, years or deals closed, because the owner cannot back that up.

**Craft, not a script.** `salesCraft` gives principles, and the model chooses words, order and angle:

1. *Hook*: the first line is about the recipient's world, a concrete and plausible situation for that kind of business, as a question or a plain observation. A real fact from the listing may be stated once as a number, never interpreted.
2. *Bridge*: one sentence on what you do for exactly that situation, as an outcome, and who is writing.
3. *Proof*: at most one, only if a source states it.
4. *Ask*: one small, specific question that is easier to answer than to ignore.
5. *Length*: there is no length limit. The writer is told never to drop an important point or leave a sentence half-said to be short.
6. *Voice*: calm, specific, respectful; not apologetic, not hype, no brochure vocabulary in any language.
7. *Offer kind*: a finished product may offer a demo only if a source says so; a build-to-order service never claims a finished product.

Before writing, the model is asked to work out what a normal week looks like for that kind of business, where it most plausibly loses time, customers or money in the area your offer covers, and which single part of your offer fixes that. If your sources do not connect the offer to that kind of business, it asks a curious question instead of asserting a benefit.

**Any niche.** No prompt names an industry. What a niche needs comes from your Marketing Brief and knowledge base at run time, through the agent's tools.

**Any country and language.** `marketLine` adds the campaign's country and language, taken from the runtime's own locale data (`Intl.DisplayNames`), so no country list lives in the code. The model is told to write as a respected local business person writes to a local business owner: the right politeness level, greeting habits, directness and channel habits for that market. Money, units and dates appear only when a source gives them. For languages other than Indonesian and English:
- the Indonesian and English spelling rules are skipped (`normalizeDraft` with `language: "other"`), so Arabic, Chinese, Japanese and every other script are left as written;
- the Indonesian honorific rewriting (`Kak`, `Bapak`) runs only on Indonesian text;
- the "reply STOP" line is translated once by your AI provider (the word STOP stays in Latin letters because that is what the opt-out check listens for) and cached; if translating fails the English line is used;
- replies in these languages are always written by the model; the fixed Indonesian and English wording is never sent to a Spanish or Arabic speaker. If two attempts fail the checks, the last text is kept and flagged `check`, instead of an English fallback.

## Facts versus situations

Hard facts need a source: features, how it works, numbers, prices, durations, guarantees, customers, locations, results, and anything about the recipient's actual situation. The agent lists each one as a claim with a source id, code checks the claim against what was retrieved, every number must appear in a source, and an auditor model lists statements the sources do not support.

A plausible situation typical of that kind of business, put as a question ("Do orders reach you at all hours?"), is not a claim and needs no source. This is how a sale starts, and the earlier rule that fell back to "an honest introduction and a question about relevance" is gone. The benefit offered in answer must still be sourced.

## Checks

| Check | What it does |
|---|---|
| `outreachProblems` | Rejects stubs, a demo offered for a custom service, clients from your brief named to an unrelated business. |
| `salesProblems` | Language-independent: an ask is missing (no question mark in any script: `? ？ ؟ ¿`), or three or more exclamation marks. **No length check.** |
| Fact audit | Statements the sources do not support. |
| Sales judge (`salesJudgeMessages`, `parseSalesJudge`) | A second model reads the message as the prospect would and scores hook, value, ask and human voice from 1 to 5. A message is sent back only when a score is 2 or less or the average is under 3.5; an unreadable answer never blocks. Runs only after the fact audit passes. |

A failed message goes back to the writer with the reasons.

## Follow-ups

A follow-up is a new reason to answer, never a reminder (`followUpCraft`): it must bring one new thing (a different benefit from the brief, a sharper question, or a concrete small offer that exists in your sources), never "just checking in". The last one is warm, adds one useful thing and says you will not write again. Timing is unchanged: after 3 and 5 days, at most two.

## Replies

The action is chosen in code, then the model phrases it (`planReplyAction`):

| Action | When | Written by |
|---|---|---|
| `answer`, `next_step` | question, price, interest, meeting | model |
| `objection` | "we already have one", in the **first exchange only**, never after a flat no | model |
| `thanks_close`, `thanks_later` | declined, not now | model (fixed line is the fallback in Indonesian and English) |
| `thanks_referral`, `ask_contact`, `thanks_wait` | pointed to someone else, will check internally | fixed wording in Indonesian and English, model in any other language |

`REPLY_CRAFT` tells the model how an expert answers: the answer in the first line; the price stated plainly if it is in the facts, never invented otherwise; a price objection acknowledged without defending and without inventing a discount; interest met with one concrete step and two options; no length limit; mirror the prospect's language and formality. Tone is confident and courteous, not servile and not pushy. A reply no longer needs a trained AI Style: without one it is written in a plain, warm voice.

## What is not verified yet

- The persona and craft are covered by unit tests of the prompts and checks (`sales-playbook.test.ts`, `reply-plan.test.ts`). Drafts in many languages and niches have not yet been generated and read with a real model, and reply rates have not been compared with the previous prompts. Treat the effect on reply rate as a hypothesis until the reply-rate dashboard (roadmap) exists.
- Languages other than Indonesian and English: prompts and normalisation are tested; right-to-left display of drafts in the Outbox is not.
- Intent detection for replies is still rules for Indonesian and English; other languages rely on the model reading the conversation when the rules find nothing.
