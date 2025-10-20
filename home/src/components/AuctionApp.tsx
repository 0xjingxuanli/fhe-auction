import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';

import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import type { AuctionItem } from './types';
import { Header } from './Header';
import { CreateAuctionForm } from './CreateAuctionForm';
import { AuctionCard } from './AuctionCard';
import '../styles/AuctionApp.css';

export function AuctionApp() {
  const { address, isConnected } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: isZamaLoading, error: zamaError } = useZamaInstance();
  const publicClient = usePublicClient();

  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canTransact = useMemo(() => isConnected && !!address, [isConnected, address]);

  const loadAuctions = useCallback(async () => {
    if (!publicClient) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const count = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'auctionCount',
      });

      const total = Number(count);
      if (Number.isNaN(total) || total === 0) {
        setAuctions([]);
        return;
      }

      const items: AuctionItem[] = [];
      for (let idx = total; idx >= 1; idx -= 1) {
        const id = BigInt(idx);
        const info = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'getAuctionInfo',
          args: [id],
        }) as readonly [string, number | bigint, bigint | number];

        const [name, startPriceValue, createdAtValue] = info;

        const highestBidHandle = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'getEncryptedHighestBid',
          args: [id],
        }) as string;

        const lastBidHandle = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'getEncryptedLastBidTime',
          args: [id],
        }) as string;

        items.push({
          id: idx,
          name,
          startPrice: Number(startPriceValue),
          createdAt: Number(createdAtValue),
          highestBidHandle,
          lastBidHandle,
        });
      }

      setAuctions(items);
    } catch (err) {
      console.error('Failed to load auctions', err);
      setError(err instanceof Error ? err.message : 'Unknown error while loading auctions');
    } finally {
      setIsLoading(false);
    }
  }, [publicClient]);

  useEffect(() => {
    loadAuctions();
  }, [loadAuctions]);

  const refreshAuctions = useCallback(async () => {
    await loadAuctions();
  }, [loadAuctions]);

  return (
    <div className="auction-app">
      <Header />
      <main className="auction-main">
        <section className="auction-panel">
          <CreateAuctionForm
            canTransact={canTransact}
            signerPromise={signerPromise}
            onCreated={refreshAuctions}
          />
          {isZamaLoading && (
            <p className="info-line">Loading encryption service...</p>
          )}
          {zamaError && (
            <p className="error-line">{zamaError}</p>
          )}
        </section>

        <section className="auction-list">
          <div className="list-header">
            <div>
              <h2>Active Auctions</h2>
              <p className="subtitle">Bid privately with Zama FHE</p>
            </div>
            <button className="refresh-button" onClick={refreshAuctions} disabled={isLoading}>
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {error && <p className="error-line">{error}</p>}

          {!isLoading && auctions.length === 0 && (
            <div className="empty-state">
              <p>No auctions created yet. Be the first to launch one!</p>
            </div>
          )}

          {isLoading && (
            <div className="empty-state">
              <p>Loading auctions...</p>
            </div>
          )}

          <div className="cards-grid">
            {auctions.map(auction => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                canTransact={canTransact}
                signerPromise={signerPromise}
                zamaInstance={instance}
                onBidPlaced={refreshAuctions}
                viewerAddress={address ?? null}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
