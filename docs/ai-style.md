# AI Style

Drafts that sound like you instead of like an assistant. This page explains what Prospex learns, what it keeps, and how well it worked when we tested it.

## What it learns from

WhatsApp's own **Export chat** feature: open a chat, More, Export chat, Without media. You get a `.txt` file (or a `.zip` containing one). Upload several. Android and iOS formats, 12 and 24 hour clocks and multi-line messages are handled, and system lines and `<Media omitted>` placeholders are skipped.

You pick which participant is you. Your messages become the voice. The other person's messages are used only as the "question" in each question-and-answer pair.

## What it keeps and what it throws away

| Kept | Never kept |
|------|-----------|
| Statistics about your writing: reply length, emoji rate, exclamation and lowercase rates, how often you end without punctuation, multi-line rate, most common openers, closers and emoji | The raw chat files |
| Pairs of *what the customer wrote* and *how you answered*, with phone numbers, emails and links replaced by `<nomor>`, `<email>`, `<link>`, plus a vector of the customer message | Anything from groups you did not upload |

Delete everything with the **Delete** button on the AI Style page. Because this is retrieval and not model training, deleting the profile removes the voice completely.

If you use a hosted AI provider, the question text of your pairs is sent to it to create vectors, and the drafts you request are written by it. To keep chats on your machine, use Ollama.

## How a draft is written

1. **Habits.** Your measured statistics are described to the model ("replies of about 52 characters, emoji in 17% of messages, mostly capitalized openers").
2. **Examples.** The five of your real replies whose questions are most similar to the situation are retrieved with pgvector and shown to the model as examples of tone.
3. **Facts.** The knowledge base is searched. If nothing matches, the model is told not to state prices, schedules or policies.
4. **Spelling.** The owner's chat habits (all lowercase, no final punctuation, "gk", "yg") are not imitated: only length, word choice, warmth and emoji follow your style. The example replies shown to the model are first put into standard spelling, and every finished draft is cleaned deterministically (PUEBI): capitals at sentence starts and for names, terminal punctuation, a comma before the vocative ("Halo, Kak, ..."), "Anda", decimal comma for ratings, and an opening "Selamat sore" replaced by "Halo" because a draft is read at an unknown hour.
5. **Safety.** Text from outside (scraped listings, customers, other people in your exports) is wrapped in delimiters and treated as data. The finished draft is scanned for links, prices, discounts and bank details that no source supports, and flagged for you if it finds any.

The AI Style page shows the full trace for any test message: the habits applied, the examples used with their similarity, and the facts found.

## How well did it work

We measured it on one owner's real chats (Indonesian, 6 exports, 416 training pairs, 23 held-out pairs) with local models (gemma4 for writing, qwen3-embedding for vectors). For each held-out customer message we compared the owner's real reply, a generic AI reply, and a reply with AI Style.

| | Real replies | Generic AI | With AI Style |
|---|---|---|---|
| Average length | 97 characters | 413 | 52 |
| Length error (lower is closer, log-ratio) | | 1.53 | 0.85 |
| Replies with emoji | 13% | 100% | 17% |
| Replies starting lowercase | 26% | 0% | 100% |

A model judge picked the styled reply as closer to the owner's real reply in **17 of 23** cases.

Read this carefully:

- It is one person, one language and 23 samples. It shows the direction, not a guarantee.
- The test exposed a flaw: the styled drafts started every message in lowercase (100% against 26% in reality), and even a prompt fix did not stop it because the owner's lowercase examples outweighed the instruction. Spelling is now enforced after generation (step 4), so this no longer depends on the model. The numbers above predate that change, and lowercase and punctuation rates would now differ by design; we have not re-run the full test.
- The judge is itself a model.

Run the same test on your own exports with `apps/api/scripts/eval-style.ts` (set `EXPORT_DIR`, `ME`, `OPENAI_BASE_URL`, `CHAT_MODEL`, `EMBEDDING_MODEL`).

## Limits

- Up to 8 files per upload, 100 MB each. Zip archives are capped at 50 entries and 50 MB once extracted.
- At least 30 of your own messages are needed. The 1,500 most recent question-and-answer pairs are kept.
- Changing `EMBEDDING_MODEL` makes the stored vectors unusable. Prospex tells you to re-import instead of comparing vectors from different models. With a 4096-dimension embedding model no vector index is used (pgvector indexes stop at 2000 dimensions), so search is a sequential scan. That is fast enough for thousands of pairs.
