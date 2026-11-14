import test from "node:test";
import assert from "node:assert/strict";
import { countryName, followUpCraft, marketLine, parseSalesJudge, salesCraft, salesJudgeMessages, salesProblems, SALES_PERSONA } from "./sales-playbook";
import { normalizeDraft } from "../ai/orthography";
import { buildDraftMessages, buildOutreachMessages } from "../ai/chat-import/style-prompt";
import { agentSystemPrompt } from "./outreach-agent-prompt";

test("the market line names the country and language from runtime data, for any country", () => {
  assert.equal(countryName("ID"), "Indonesia");
  assert.equal(countryName("br"), "Brazil");
  assert.equal(countryName("zz9"), null);
  assert.match(marketLine("es", "MX"), /Mexico.*Spanish/s);
  assert.match(marketLine("ar", "EG"), /Egypt.*Arabic/s);
  assert.match(marketLine("indonesian", "ID"), /Indonesia.*Bahasa Indonesia/s);
  assert.match(marketLine("fr", null), /French/);
});

test("the craft names no industry and sets no length limit", () => {
  const t = salesCraft({ language: "de", country: "DE", channel: "whatsapp", offerKind: "product" });
  assert.match(t, /no length limit/i);
  assert.doesNotMatch(t, /\b\d+ to \d+ words\b/);
  assert.doesNotMatch(t, /\b(bakery|restaurant|salon|clinic|hotel)\b/i);
  assert.match(followUpCraft({ number: 2, of: 2, daysSince: 5 }), /last one/);
  assert.doesNotMatch(followUpCraft({ number: 1, of: 2, daysSince: 3 }), /\b\d+ to \d+ words\b/);
  assert.match(SALES_PERSONA, /never mention it/);
});

test("code checks never limit length, but need an easy question and no shouting", () => {
  const long = `${"This sentence carries real information. ".repeat(80)}Does that fit how you work?`;
  assert.deepEqual(salesProblems(long, { channel: "whatsapp" }), []);
  assert.equal(salesProblems("Halo, kami bantu usaha Anda.", { channel: "whatsapp" }).length, 1);
  for (const q of ["¿Le interesa?", "هل هذا مناسب؟", "ご興味はありますか？", "Is this useful?"]) assert.deepEqual(salesProblems(`x ${q}`, { channel: "email" }), [], q);
  assert.ok(salesProblems("Wow! Great! Now! Is it?", { channel: "email" }).some((p) => /tanda seru/.test(p)));
});

test("the sales judge only blocks a clearly weak message and never an unreadable answer", () => {
  assert.equal(parseSalesJudge('{"hook":4,"value":5,"ask":4,"human":4,"fix":""}'), null);
  assert.equal(parseSalesJudge("not json"), null);
  assert.equal(parseSalesJudge('{"hook":"x"}'), null);
  assert.match(parseSalesJudge('{"hook":1,"value":4,"ask":4,"human":4,"fix":"Open with their situation."}')!, /hook.*Open with their situation/);
  assert.match(parseSalesJudge('{"hook":3,"value":3,"ask":3,"human":3,"fix":"x"}')!, /rendah/);
  assert.match(salesJudgeMessages({ message: "hi <b>", recipientKind: "shop", offer: "o" })[1].content, /<message>/);
});

test("other languages are not run through Indonesian or English spelling rules", () => {
  const ar = "مرحبا، هل تستقبلون الطلبات ليلا";
  assert.equal(normalizeDraft(ar, { language: "other" }), ar);
  const ja = "こんにちは。ご注文は夜も届きますか";
  assert.equal(normalizeDraft(ja, { language: "other" }), ja);
  assert.equal(normalizeDraft("hello there", { language: "english" }), "Hello there.");
  assert.equal(normalizeDraft("Boa tarde  ,  podemos ajudar", { language: "other", names: ["Contoh Ltda"] }), "Boa tarde, podemos ajudar");
});

test("prompts carry the persona and market for any language, with no length limit", () => {
  const agent = agentSystemPrompt({ languageCode: "pt", country: "BR", channel: "whatsapp", business: "Exemplo", offer: "o", recipientKind: "k", generic: false, offerKind: "product" });
  assert.match(agent, /decades of field experience/);
  assert.match(agent, /Brazil.*Portuguese/s);
  assert.match(agent, /HARD FACTS NEED A SOURCE, SITUATIONS DO NOT/);
  assert.doesNotMatch(agent, /\b\d+ to \d+ words\b/);
  const out = buildOutreachMessages({ businessDescription: "Exemplo", offer: "o", language: "english", languageCode: "tr", country: "TR", writeIn: "Turkish", lead: { name: "X", category: "k" }, channel: "whatsapp", offerKind: "product" })[0].content;
  assert.match(out, /(Turkey|Türkiye).*Turkish/s);
  assert.match(out, /decades of field experience/);
  const fu = buildOutreachMessages({ businessDescription: "Exemplo", offer: "o", language: "english", lead: { name: "X" }, followUp: { number: 1, of: 2, previousMessage: "earlier", daysSince: 3 } })[0].content;
  assert.match(fu, /FOLLOW-UP CRAFT/);
  assert.match(fu, /Never "just checking in"/);
});

test("replies work without a trained style, in any language, with the right task per action", () => {
  const base = { businessDescription: "Exemplo", examples: [], incoming: "ya tenemos uno", prospect: true, reason: true, writeIn: "Spanish", country: "ES" };
  const sys = buildDraftMessages({ ...base, action: "objection" })[0].content;
  assert.match(sys, /already have a solution/);
  assert.match(sys, /LANGUAGE: write the whole reply in Spanish/);
  assert.doesNotMatch(sys, /PUEBI/);
  assert.match(sys, /HOW AN EXPERT SALESPERSON REPLIES/);
  assert.match(buildDraftMessages({ ...base, action: "thanks_close" })[0].content, /door open/);
  assert.doesNotMatch(buildDraftMessages({ ...base, action: "answer" })[0].content, /\bat most\b/);
});
