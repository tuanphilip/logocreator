import { currentUser } from "@clerk/nextjs/server";
import { Redis } from "@upstash/redis";
import { FREE_CREDITS, creditsKey } from "@/app/lib/credits";

/**
 * Server-truth read of the signed-in user's free-credit balance (the Upstash
 * ledger the generate/edit routes spend from). `remaining: null` means there
 * is nothing trustworthy to show: signed out, auth disabled, or no Upstash
 * configured (in which case nothing is being metered anyway).
 */
export async function GET() {
  return Response.json({ enabled: false, remaining: 9999 });
}

export const runtime = "nodejs";
