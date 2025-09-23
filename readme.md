# Bendystraw Price Index

Database of non-ETH token prices at specific historical timestamps, matching the timestamps of historical non-ETH payments on the Juicebox protocol (v4, v5). [Bendystraw](https://bendystraw.xyz) can load prices from this index while indexing historical payments, to avoid making excessive API calls to a price conversion endpoint.

`/scripts/fetchPrices.ts` will fetch historical payments from Bendystraw, then backfill the USD price for any payments with missing records.