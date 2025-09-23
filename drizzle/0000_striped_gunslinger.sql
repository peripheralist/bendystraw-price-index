CREATE TABLE "price" (
	"token" varchar(42) NOT NULL,
	"timestamp" integer NOT NULL,
	"chainId" integer NOT NULL,
	"priceUsd" double precision,
	CONSTRAINT "price_token_chainId_timestamp_pk" PRIMARY KEY("token","chainId","timestamp"),
	CONSTRAINT "address_check_format" CHECK ("price"."token" LIKE '0x%')
);
