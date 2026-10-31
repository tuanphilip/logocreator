import { z } from "zod";
import { queryNineRouterVision } from "@/app/lib/nine-router";

const STYLES = [
  "Minimal",
  "Geometric",
  "Gradient",
  "Mascot",
  "Hand-drawn",
  "Luxury",
  "Retro",
  "3D",
] as const;

const PROMPT = `You are a brand-design analyst. Study this reference logo/image and respond with ONLY a compact JSON object (no prose, no markdown fences) with these keys:
- "description": one tight sentence (max 240 chars) describing the mark's composition, shapes, motif and overall feel. Do NOT state the company name or transcribe any text in the logo.
- "styleGuess": exactly one of ${JSON.stringify(STYLES)}, whichever best matches.
- "dominantColor": the single most prominent brand color as a 6-digit hex like "#2F6FF5", or "auto" if it is grayscale or multicolor with no clear dominant.
- "keywords": an array of 3 to 6 short adjectives.
Return only the JSON object.`;

export async function POST(req: Request) {
  const parsed = z
    .object({
      userAPIKey: z.string().optional(),
      image: z
        .string()
        .regex(
          /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
          "Provide an image data URL.",
        ),
    })
    .safeParse(await req.json().catch(() => null));

  if (!parsed.success) {
    return new Response("Invalid request.", {
      status: 400,
      headers: { "Content-Type": "text/plain" },
    });
  }
  const data = parsed.data;

  // Cap payload size (~6 MB image)
  if (data.image.length > 8_000_000) {
    return new Response("That image is too large.", {
      status: 413,
      headers: { "Content-Type": "text/plain" },
    });
  }

  try {
    const rawText = await queryNineRouterVision({
      model: "ag/gemini-3.8-flash-medium",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: data.image } },
          ],
        },
      ],
    });

    let parsedOut: Record<string, unknown> = {};
    const text = rawText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, "$1").trim();
    try {
      parsedOut = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsedOut = JSON.parse(m[0]);
        } catch {
          /* fall through to text-only */
        }
      }
    }

    const styleGuess =
      typeof parsedOut.styleGuess === "string" &&
      (STYLES as readonly string[]).includes(parsedOut.styleGuess as (typeof STYLES)[number])
        ? parsedOut.styleGuess
        : null;
    const dominantColor =
      typeof parsedOut.dominantColor === "string" &&
      /^#[0-9a-fA-F]{6}$/.test(parsedOut.dominantColor)
        ? parsedOut.dominantColor
        : "auto";
    const description =
      typeof parsedOut.description === "string" && parsedOut.description.trim()
        ? parsedOut.description.trim().slice(0, 240)
        : text.replace(/[{}"]/g, " ").trim().slice(0, 240);
    const keywords = Array.isArray(parsedOut.keywords)
      ? parsedOut.keywords
          .filter((k): k is string => typeof k === "string")
          .slice(0, 6)
      : [];

    return Response.json(
      { description, styleGuess, dominantColor, keywords },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("Error reading reference via 9router:", error);
    return new Response("Couldn't read that image. Try another file.", {
      status: 502,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

export const runtime = "nodejs";
