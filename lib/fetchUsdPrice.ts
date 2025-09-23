require("dotenv").config();

import axios from "axios";

const API_KEY = process.env.COINGECKO_API_KEY;

if (!API_KEY) throw new Error("Missing API key");

export async function fetchUsdPrice({
  token,
  timestamp,
  chainId,
}: {
  token: string;
  timestamp: number | bigint;
  chainId: number;
}) {
  const gcChainId = gcIdOfChain(chainId);

  if (!gcChainId) return 0;

  const from = Number(timestamp) - 30 * 24 * 60 * 60; // 30 day range. arbitrary, but if too small will have no price instances
  const url = `https://api.coingecko.com/api/v3/coins/${gcChainId}/contract/${token}/market_chart/range?vs_currency=usd&from=${from}&to=${timestamp}&precision=full`;

  const response = await axios.get<{ prices: [number, number][] }>(url, {
    headers: { "x-cg-demo-api-key": API_KEY },
  });

  const prices = response.data.prices;

  if (!prices.length) throw new Error("Empty price feed");

  const [_, latestPrice] = prices.sort(([timestampA], [timestampB]) =>
    timestampA < timestampB ? 1 : -1
  )[0]!;

  // sanity check
  if (isNaN(latestPrice)) throw new Error("Bad price value");

  return latestPrice;
}

function gcIdOfChain(chainId: number) {
  switch (chainId) {
    case 1:
      return "ethereum";
    case 8453:
      return "base";
    case 42161:
      return "arbitrum-one";
    case 10:
      return "optimistic-ethereum";
    // testnets not supported
  }
}
