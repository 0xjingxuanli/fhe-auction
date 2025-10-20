import type { FormEvent } from 'react';
import { useState } from 'react';
import { Contract } from 'ethers';

import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import type { SignerPromise } from './types';
import '../styles/AuctionForm.css';

type CreateAuctionFormProps = {
  canTransact: boolean;
  signerPromise: SignerPromise;
  onCreated: () => Promise<void> | void;
};

export function CreateAuctionForm({ canTransact, signerPromise, onCreated }: CreateAuctionFormProps) {
  const [name, setName] = useState('');
  const [startPrice, setStartPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canTransact) {
      setError('Connect your wallet to create an auction');
      return;
    }

    const trimmedName = name.trim();
    const numericStart = Number(startPrice);

    if (!trimmedName) {
      setError('Auction name is required');
      return;
    }

    if (!Number.isFinite(numericStart) || numericStart < 0) {
      setError('Starting price must be a positive number');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setStatusMessage('Awaiting wallet confirmation...');

      const signer = await signerPromise;

      if (!signer) {
        throw new Error('Wallet signer not available');
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.createAuction(trimmedName, numericStart);

      setStatusMessage('Transaction submitted. Waiting for confirmation...');
      await tx.wait();

      setStatusMessage('Auction created successfully');
      setName('');
      setStartPrice('');

      await onCreated();
    } catch (err) {
      console.error('Failed to create auction', err);
      const reason = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to create auction: ${reason}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-card">
      <h2 className="card-title">Create Auction</h2>
      <p className="card-subtitle">Set a name and starting price to launch a new private auction.</p>

      <form className="create-form" onSubmit={handleSubmit}>
        <label className="form-label">
          Auction Name
          <input
            className="form-input"
            placeholder="Vintage guitar"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isSubmitting}
            required
          />
        </label>

        <label className="form-label">
          Starting Price (wei)
          <input
            className="form-input"
            type="number"
            min={0}
            placeholder="100"
            value={startPrice}
            onChange={(event) => setStartPrice(event.target.value)}
            disabled={isSubmitting}
            required
          />
        </label>

        {error && <p className="error-line">{error}</p>}
        {statusMessage && !error && <p className="info-line">{statusMessage}</p>}

        <button type="submit" className="primary-button" disabled={!canTransact || isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Auction'}
        </button>
      </form>
    </div>
  );
}
