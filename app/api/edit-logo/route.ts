import { z } from "zod";
import { generateNineRouterImage } from "@/app/lib/nine-router";

/**
 * Image-to-image edit of an existing logo via local 9router Antigravity.
 * Powers the brand kit's AI variants and the "keep editing" iterate flow.
 */
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
      prompt: z.string().max(2000),
      width: z.number().optional(),
      height: z.number().optional(),
    })
    .safeParse(await req.json().catch(() => null));

  if (!parsed.success) {
    return new Response("Invalid edit request.", {
      status: 400,
      headers: { "Content-Type": "text/plain" },
    });
  }
  const data = parsed.data;

  // Cap payload size (~7 MB image) before forwarding it to the model.
  if (data.image.length > 9_000_000) {
    return new Response("That image is too large.", {
      status: 413,
      headers: { "Content-Type": "text/plain" },
    });
  }

  try {
    const width = Math.min(1536, Math.max(64, Math.round(data.width ?? 1024)));
    const height = Math.min(1536, Math.max(64, Math.round(data.height ?? 1024)));

    const result = await generateNineRouterImage({
      prompt: data.prompt,
      image: data.image,
      model: "ag/gemini-3.1-flash-image",
      size: `${width}x${height}`,
    });

    return Response.json(
      {
        b64_json: result.b64_json,
        url: result.url,
        remaining: 9999,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    console.error("Error editing logo via 9router:", error);
    const msg = error instanceof Error ? error.message : "Couldn't apply that edit. Try again.";
    return new Response(msg, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

export const runtime = "nodejs";
