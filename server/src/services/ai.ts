import Anthropic from "@anthropic-ai/sdk";
import type { DB } from "../lib/db.js";
import { MealEstimateSchema, type MealEstimate } from "@sentience/shared";
import { getSetting } from "./settings.js";
import { HttpError } from "../lib/http.js";

/**
 * Optional AI features. Off until you add an Anthropic API key (env
 * ANTHROPIC_API_KEY, or Settings → AI). Only the text you send for that
 * request leaves the server: a meal description/photo, or an export bundle.
 */
const MODEL = "claude-opus-5-5";
// Opus-tier safety classifiers occasionally decline benign requests; with
// server-side fallbacks the API re-runs a declined request on Anthropic's
// recommended fallback model instead of returning a refusal.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export function aiStatus(db: DB): { enabled: boolean; source: "env" | "settings" | null; model: string } {
  if (process.env.ANTHROPIC_API_KEY) return { enabled: true, source: "env", model: MODEL };
  if (getSetting(db, "anthropic_api_key")) return { enabled: true, source: "settings", model: MODEL };
  return { enabled: false, source: null, model: MODEL };
}

function client(db: DB): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY || getSetting(db, "anthropic_api_key");
  if (!key) throw new HttpError(409, "AI is off. Add an Anthropic API key in Settings → AI.");
  return new Anthropic({ apiKey: key });
}

function mapError(e: unknown): never {
  if (e instanceof HttpError) throw e;
  if (e instanceof Anthropic.AuthenticationError) throw new HttpError(401, "The Anthropic API key was rejected. Check it in Settings → AI.");
  if (e instanceof Anthropic.RateLimitError) throw new HttpError(429, "AI is rate limited right now. Try again in a minute.");
  if (e instanceof Anthropic.BadRequestError) throw new HttpError(400, `AI request rejected: ${e.message}`);
  if (e instanceof Anthropic.APIError) throw new HttpError(502, `AI service error (${e.status ?? "?"}): ${e.message}`);
  if (e instanceof Anthropic.APIConnectionError) throw new HttpError(502, "Couldn't reach the AI service. Is the server online?");
  throw e;
}

const MEAL_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items", "confidence", "notes"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "portion", "kcal", "protein_g", "carbs_g", "fat_g", "fibre_g"],
        properties: {
          name: { type: "string" },
          portion: { type: "string" },
          kcal: { type: "number" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" },
          fibre_g: { type: "number" },
        },
      },
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    notes: { type: "string" },
  },
} as const;

const MEAL_SYSTEM = `You estimate the nutrition of meals people describe or photograph, for a personal food diary.

Work like a dietitian estimating a home-cooked plate:
- Split the meal into its components (e.g. lasagne, garlic bread, side salad) and estimate each one.
- Turn vague amounts into concrete portions ("two portions of lasagne" is about 2 x 350 g for a typical home-made serving) and state the portion you assumed.
- Home-made dishes usually carry more oil, butter and cheese than packaged equivalents; account for it.
- Use UK conventions: kcal, grams, and UK portion sizes.
- If the description is vague, pick the most likely interpretation, estimate it, and say in notes what would change the number most.
- confidence is "high" only for clearly described, standard items; "low" when portions or ingredients are guesses.
Keep notes to one or two sentences.`;

export async function estimateMeal(db: DB, input: { description: string; image?: { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" } }): Promise<MealEstimate> {
  const anthropic = client(db);
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.image) content.push({ type: "image", source: { type: "base64", media_type: input.image.mediaType, data: input.image.data } });
  content.push({ type: "text", text: input.description.trim() || "Estimate the meal in this photo." });
  try {
    const res = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      system: MEAL_SYSTEM,
      output_config: { effort: "medium", format: { type: "json_schema", schema: MEAL_JSON_SCHEMA as unknown as Record<string, unknown> } },
      messages: [{ role: "user", content }],
    });
    if (res.stop_reason === "refusal") throw new HttpError(422, "The AI declined to estimate this. Try describing the food differently.");
    const text = res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")?.text;
    if (!text) throw new HttpError(502, "The AI returned no estimate.");
    return MealEstimateSchema.parse(JSON.parse(text));
  } catch (e) {
    mapError(e);
  }
}

const ASSESS_SYSTEM = `You review a person's self-tracking export (profile, record, test results, goals, and day-by-day events with Apple Health data) and give them an honest, practical read of how they're doing.

Write for the person themselves, in plain British English, in Markdown:
1. A two-sentence overview.
2. "What's going well": 2 to 4 bullets, each tied to specific numbers or days.
3. "What to look at": 2 to 4 bullets on patterns across several days (not one-off noise), each citing the data.
4. "Try this next week": exactly three small, specific changes, each with how they'd know it worked using what this app tracks.
5. One line flagging anything that warrants a GP conversation (out-of-range results, persistent abnormal heart data), or say there's nothing pressing.

Rules: base every claim on the data provided and say when data is too thin to judge. Treat genetic markers as weak context, never as a diagnosis. Don't diagnose. Be warm but direct; no filler.`;

export async function assessRange(db: DB, markdown: string): Promise<{ markdown: string; model: string }> {
  const anthropic = client(db);
  try {
    const stream = anthropic.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      system: ASSESS_SYSTEM,
      output_config: { effort: "high" },
      messages: [{ role: "user", content: markdown }],
    });
    const res = await stream.finalMessage();
    if (res.stop_reason === "refusal") throw new HttpError(422, "The AI declined this request.");
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n\n");
    return { markdown: text, model: res.model };
  } catch (e) {
    mapError(e);
  }
}
