require("dotenv").config();

import axios from "axios";
import * as chalk from "chalk";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../lib/db";
import { fetchUsdPrice } from "../lib/fetchUsdPrice";
import { price } from "../schema";

const webhookUrl = process.env.WEBHOOK_URL;

type ActivityEvent = {
  timestamp: number;
  chainId: number;
  project: {
    token: `0x${string}`;
  };
};

function activityEventsGql(after: string | null) {
  return `query ActivityEvents { 
    activityEvents(
      ${after ? `after: "${after}",` : ""}
      limit: 1000,
      orderBy: "timestamp",
      orderDirection:"asc",
      where: { OR: [
        {payEvent_not: null}, 
        {sendPayoutsEvent_not: null}, 
        {sendPayoutToSplitEvent_not: null}, 
        {addToBalanceEvent_not: null}, 
        {cashOutTokensEvent_not: null}
      ]}
    ) {
      pageInfo {
        endCursor
      }
      items {
        timestamp
        chainId
        project {
          token
        }
      }
    } 
  }`;
}

async function exhaustiveQueryActivityEvents() {
  const url = `https://bendystraw.xyz/schema`;

  const events: ActivityEvent[] = [];

  function pageActivityEvents(_after: string | null = null) {
    return axios
      .post<{
        data: {
          activityEvents: {
            items: ActivityEvent[];
            pageInfo: { endCursor: string };
          };
        };
      }>(
        url,
        {
          operationName: "ActivityEvents",
          query: activityEventsGql(_after),
        },
        { headers: { "Content-Type": "application/json" } }
      )
      .then(async (res) => {
        const {
          data: {
            activityEvents: {
              items,
              pageInfo: { endCursor },
            },
          },
        } = res.data;

        events.push(...items);

        if (endCursor) await pageActivityEvents(endCursor);
      });
  }

  await pageActivityEvents();

  // filter and normalize results
  return events
    .filter(
      (e) =>
        e.project.token !== `0x0000000000000000000000000000000000000000` &&
        e.project.token !== `0x000000000000000000000000000000000000eeee`
    )
    .map(({ project: { token }, timestamp, chainId }) => ({
      token: token.toLowerCase(),
      timestamp,
      chainId,
    }));
}

/**
 * Fetches and writes usd prices to any price rows missing usd price.
 */
async function main() {
  const events = await exhaustiveQueryActivityEvents();

  console.info(chalk.bold(`Found ${events.length} events`));

  // try add all new events to db
  await Promise.all(
    events.map((e) => db.insert(price).values(e).onConflictDoNothing())
  );

  // get list of table rows needing prices
  const updateList = await db.query.price.findMany({
    where: isNull(price.priceUsd),
  });

  // Split into batches to mitigate rate limiting
  // Rate limits: 30/min, 10k/mo
  const batchSize = 30;
  const batches: (typeof updateList)[] = [];

  let errorCount = 0;

  for (let i = 0; i < updateList.length; i += batchSize) {
    batches.push(updateList.slice(i, i + batchSize));
  }

  console.info(
    chalk.bold(
      `Fetching USD prices for ${updateList.length} rows in ${batches.length} batches`
    )
  );

  // One batch at a time
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    if (!batch) continue;

    await Promise.all(
      batch.map(async ({ token, timestamp, chainId }) => {
        try {
          const priceUsd = await fetchUsdPrice({
            token,
            timestamp,
            chainId,
          });

          console.info(chalk.green("Price found"));

          return db
            .update(price)
            .set({ priceUsd })
            .where(
              and(
                eq(price.token, token),
                eq(price.timestamp, timestamp),
                eq(price.chainId, chainId)
              )
            );
        } catch (e) {
          errorCount++;

          console.error(
            `Error updating price for token: ${token}, timestamp: ${timestamp}, chainId: ${chainId}: ${
              (e as Error).message
            }`
          );

          return Promise.resolve();
        }
      })
    );

    console.info(chalk.cyan(`Batch ${i + 1}/${batches.length} finished`));

    // Await delay to comply with rate limit.
    if (i < batches.length - 1) {
      const delaySecs = 62;
      console.info(chalk.cyan(`Waiting ${delaySecs} seconds...`));
      await new Promise((r) => setTimeout(r, delaySecs * 1000));
    }
  }

  console.info(
    chalk.bold(
      `Tried updating USD prices for ${updateList.length} records. ${
        updateList.length - errorCount
      } succeeded, ${errorCount} errors.`
    )
  );

  if (webhookUrl) {
    try {
      const allRows = await db.query.price.findMany();

      await axios.post(webhookUrl, {
        embeds: [
          {
            fields: [
              {
                name: "Total records",
                value: allRows.length,
              },
              {
                name: "Missing prices",
                value: allRows.filter((r) => r.priceUsd === null),
              },
              {
                name: "Attempted",
                value: updateList.length,
              },
              {
                name: "Errors",
                value: errorCount,
              },
            ],
            author: {
              name: "Prices index",
            },
            title: "Updated prices",
          },
        ],
      });
    } catch (e) {
      console.error(`Error sending webhook: ${(e as Error).message}`);
    }
  }
}

main();
