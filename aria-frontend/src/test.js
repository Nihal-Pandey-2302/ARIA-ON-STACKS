import { createAsset } from "@stacks/transactions";

const asset = createAsset(
  'SP3FGQ8Z7JY9BWYZ5WM53E0M9NK7WHJF0691NZ159', // valid testnet address
  'my-contract',                                   // your contract name
  'my-nft'                                         // your asset name
);

console.log(asset);
