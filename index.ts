import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "./lib/db";
import { fetchUsdPrice } from "./lib/fetchUsdPrice";
import { price } from "./schema";

const app = new Hono();

app.get("/price", async (c) => {
  try {
    const { token, chainId: _chainId, timestamp: _timestamp } = c.req.query();

    const chainId = parseInt(_chainId);
    const timestamp = parseInt(_timestamp);

    if (isNaN(chainId) || isNaN(timestamp)) {
      return c.status(400);
    }

    // check for stored price matching query
    const row = await db.query.price.findFirst({
      where: and(
        eq(price.token, token.toLowerCase()),
        eq(price.chainId, chainId),
        eq(price.timestamp, timestamp)
      ),
    });

    // if no stored price, fetch and insert to DB
    if (!row?.priceUsd) {
      const priceUsd = await fetchUsdPrice({
        token,
        chainId,
        timestamp,
      });

      await db
        .insert(price)
        .values({
          token: token.toLowerCase(), // lowercase all token addresses
          chainId,
          timestamp,
          priceUsd,
        })
        .onConflictDoNothing();

      return c.json({ priceUsd }, 200);
    }

    return c.json({ priceUsd: row.priceUsd }, 200);
  } catch (e) {
    console.error("GET price error:", (e as Error).message);
    return c.text((e as Error).message, 500);
  }
});
