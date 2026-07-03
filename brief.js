// api/brief.js
// Vercel serverless function. Runs on the server only, so the Anthropic API
// key never reaches the browser. Set ANTHROPIC_API_KEY in your Vercel
// project's Environment Variables (same pattern as the Text Humanizer app).

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-5";
const MIN_LENGTH = 200;
const MAX_LENGTH = 80000;

const SYSTEM_PROMPT = `You are a legal writing assistant that produces structured case briefs for law students.

Given the text of a court opinion, extract the following, in your own words, based only on the opinion provided:

- case_name: the case name and citation if identifiable from the text. Leave as an empty string if not identifiable.
- facts: the relevant factual background, in 150 to 250 words.
- issue: the precise legal question before the court, in one or two sentences.
- holding: the court's answer to that issue, in one to three sentences.
- reasoning: the court's reasoning and analysis, in 250 to 400 words.
- rule: the legal rule or test the court applied or established, in two to four sentences.
- plain_summary: a plain English summary a person with no legal training could understand, in three to five sentences, with no legal jargon.

Base every section only on the text provided. Do not invent facts, parties, or citations that are not in the text. If the text does not clearly read as a court opinion, still do your best with whatever facts, issues, and reasoning are present, and say so plainly in plain_summary.

Call the submit_case_brief tool with your result. Do not include any text outside the tool call.`;

const BRIEF_TOOL = {
  name: "submit_case_brief",
  description: "Submit a structured case brief for the opinion provided.",
  input_schema: {
    type: "object",
    properties: {
      case_name: {
        type: "string",
        description: "Case name and citation if identifiable, otherwise an empty string.",
      },
      facts: { type: "string", description: "150 to 250 words." },
      issue: { type: "string", description: "One or two sentences." },
      holding: { type: "string", description: "One to three sentences." },
      reasoning: { type: "string", description: "250 to 400 words." },
      rule: { type: "string", description: "Two to four sentences." },
      plain_summary: { type: "string", description: "Three to five sentences, no legal jargon." },
    },
    required: ["case_name", "facts", "issue", "holding", "reasoning", "rule", "plain_summary"],
  },
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Request body must be valid JSON." });
    }
  }

  const opinionText = (body && body.opinionText ? String(body.opinionText) : "").trim();

  if (opinionText.length < MIN_LENGTH) {
    return res.status(400).json({
      error: `Paste more of the opinion. At least ${MIN_LENGTH} characters are needed for a reliable brief.`,
    });
  }

  if (opinionText.length > MAX_LENGTH) {
    return res.status(400).json({
      error: `That opinion is longer than this tool currently accepts (${MAX_LENGTH.toLocaleString()} characters). Try trimming to the majority opinion, or split it into sections.`,
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "The server is missing its Anthropic API key. Set ANTHROPIC_API_KEY in Vercel." });
  }

  try {
    const anthropicRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Here is the court opinion:\n\n${opinionText}`,
          },
        ],
        tools: [BRIEF_TOOL],
        tool_choice: { type: "tool", name: "submit_case_brief" },
      }),
    });

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, detail);
      const message =
        anthropicRes.status === 429
          ? "The brief service is getting a lot of requests right now. Wait a moment and try again."
          : "The brief service could not process that opinion. Try again in a moment.";
      return res.status(502).json({ error: message });
    }

    const data = await anthropicRes.json();
    const toolBlock = (data.content || []).find((block) => block.type === "tool_use");

    if (!toolBlock || !toolBlock.input) {
      console.error("No tool_use block in response:", JSON.stringify(data));
      return res.status(502).json({ error: "The brief service returned an unexpected response. Try again." });
    }

    return res.status(200).json({ brief: toolBlock.input });
  } catch (err) {
    console.error("Unhandled error calling Anthropic API:", err);
    return res.status(500).json({ error: "Something went wrong generating the brief. Try again." });
  }
};
