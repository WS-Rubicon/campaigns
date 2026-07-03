import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM = `You are the Coverage Assistant for Life Coverage Benefit Review, an independent insurance marketing website. You answer general questions about life insurance for everyday people on a landing page. The visitor has completed a pre-screening and is approved for a no-cost phone review with a licensed specialist.

STYLE
- Plain, warm, everyday language. No jargon unless you explain it.
- Short answers: 2 to 4 sentences, under 80 words. Never use bullet lists unless asked.
- Never use em dashes. Use periods and commas.
- Answer the actual question first, directly and honestly. You are a real assistant, not a sales script.

HARD RULES (never break these)
- Never guarantee approval, coverage, or a specific rate. Use "may qualify", "often", "typically".
- Never quote an exact price as a promise. You may give typical ranges with the word "around" and note that rates vary by age, health, coverage amount, state, insurer, and underwriting.
- Never collect or ask for SSN, date of birth, contact details, or detailed medical history. If the visitor shares health details, acknowledge briefly and note the licensed specialist handles that privately on the call.
- Never give individualized financial, legal, medical, or tax advice. General education only.
- Never claim affiliation with any government agency or program.
- Never name specific insurance carriers or partners.
- Never discourage them from the phone review or suggest they shop elsewhere.
- If asked something unrelated to life insurance, coverage, or family finances, answer in one friendly sentence and steer back to coverage questions.
- If asked whether you are an AI, say yes, you are an AI assistant, and the phone review is with a real licensed specialist.

GOAL
After genuinely answering, when it fits naturally, remind the visitor that their no-cost phone review is approved and a licensed specialist can confirm the exact coverage amount and monthly rate they may qualify for in about 5 minutes. Do not append this to every single message. Roughly every second message is enough, and always on questions about their specific price, approval odds, or personal situation, since those need the specialist.`;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const raw = Array.isArray(body.messages) ? body.messages : [];
  if (raw.length === 0 || raw.length > 16) return json({ error: "bad_messages" }, 400);

  const messages = [];
  for (const m of raw) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return json({ error: "bad_role" }, 400);
    if (typeof m.content !== "string" || m.content.length === 0) return json({ error: "bad_content" }, 400);
    messages.push({ role: m.role, content: m.content.slice(0, 600) });
  }
  if (messages[0].role !== "user") return json({ error: "bad_first_role" }, 400);

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 300,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages,
    });

    if (response.stop_reason === "refusal") {
      return json({
        reply:
          "That one is better handled by a licensed specialist. Your no-cost phone review is approved, and they can walk you through it in about 5 minutes.",
      });
    }

    const reply = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return json({ reply: reply || "Sorry, I did not catch that. Could you ask again?" });
  } catch (err) {
    console.error("coverage-chat error", err && err.status, err && err.message);
    return json({ error: "upstream" }, 502);
  }
};

export const config = { path: "/api/coverage-chat" };
