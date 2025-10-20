import type { JsonRpcSigner } from 'ethers';

export type SignerPromise = Promise<JsonRpcSigner> | undefined;

export type AuctionItem = {
  id: number;
  name: string;
  startPrice: number;
  createdAt: number;
  highestBidHandle: string;
  lastBidHandle: string;
};
