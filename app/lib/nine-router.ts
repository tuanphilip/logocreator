import { execSync } from "child_process";

const NINE_ROUTER_URL = process.env.NINE_ROUTER_URL || "http://127.0.0.1:20128";
let cachedApiKey: string | null = null;

export function getNineRouterApiKey(): string {
  if (cachedApiKey) return cachedApiKey;
  if (process.env.NINE_ROUTER_API_KEY) {
    cachedApiKey = process.env.NINE_ROUTER_API_KEY.trim();
    return cachedApiKey;
  }
  try {
    const raw = execSync(
      'sqlite3 /var/lib/docker/volumes/9router-data/_data/db/data.sqlite "SELECT key FROM apiKeys WHERE name=\'Image Gen\' LIMIT 1;"',
      { encoding: "utf8", timeout: 2000 }
    ).trim();
    if (raw) {
      cachedApiKey = raw;
      return cachedApiKey;
    }
  } catch (err) {
    console.error("Failed to query 9router API key from sqlite:", err);
  }
  return "";
}

export function getNineRouterBaseUrl(): string {
  return NINE_ROUTER_URL;
}

export async function generateNineRouterImage(params: {
  prompt: string;
  image?: string;
  model?: string;
  size?: string;
}): Promise<{ b64_json?: string; url?: string; error?: string }> {
  const apiKey = getNineRouterApiKey();
  const baseUrl = getNineRouterBaseUrl();
  const model = params.model || "ag/gemini-3.1-flash-image";

  const body: Record<string, unknown> = {
    model,
    prompt: params.prompt,
    size: params.size || "1024x1024",
  };

  if (params.image) {
    body.image = params.image;
  }

  const res = await fetch(`${baseUrl}/v1/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`9router image generation failed (${res.status}): ${errText}`);
  }

  const json = await res.json();
  const first = json?.data?.[0];
  if (!first) {
    throw new Error("No image data returned from 9router");
  }

  return first;
}

export async function queryNineRouterVision(params: {
  messages: Array<{
    role: string;
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  }>;
  model?: string;
}): Promise<string> {
  const apiKey = getNineRouterApiKey();
  const baseUrl = getNineRouterBaseUrl();
  const model = params.model || "ag/gemini-3.8-flash-medium";

  const res = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: params.messages,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`9router vision chat failed (${res.status}): ${errText}`);
  }

  const json = await res.json();
  return json?.choices?.[0]?.message?.content || "";
}
