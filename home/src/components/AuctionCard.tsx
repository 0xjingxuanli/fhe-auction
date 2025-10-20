import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Contract } from 'ethers';

import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import type { AuctionItem, SignerPromise } from './types';
import '../styles/AuctionCard.css';

type AuctionCardProps = {
  auction: AuctionItem;
  canTransact: boolean;
  signerPromise: SignerPromise;
  zamaInstance: any;
  onBidPlaced: () => Promise<void> | void;
  viewerAddress: string | null;
};

type DecryptionResult = Record<string, unknown>;

const CONTRACT_ADDRESSES = [CONTRACT_ADDRESS];
const DURATION_DAYS = '10';

export function AuctionCard({
  auction,
  canTransact,
  signerPromise,
  zamaInstance,
  onBidPlaced,
  viewerAddress,
}: AuctionCardProps) {
  const [bidValue, setBidValue] = useState('');
  const [bidStatus, setBidStatus] = useState<string | null>(null);
  const [bidError, setBidError] = useState<string | null>(null);
  const [isPlacingBid, setIsPlacingBid] = useState(false);

  const [highestBid, setHighestBid] = useState<string | null>(null);
  const [lastBidTime, setLastBidTime] = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [isDecryptingHighest, setIsDecryptingHighest] = useState(false);
  const [isDecryptingTime, setIsDecryptingTime] = useState(false);

  const [auctionEnded, setAuctionEnded] = useState<boolean | null>(null);
  const [isCheckingEnded, setIsCheckingEnded] = useState(false);
  const [endedError, setEndedError] = useState<string | null>(null);

  const createdAtText = useMemo(() => new Date(auction.createdAt * 1000).toLocaleString(), [auction.createdAt]);

  useEffect(() => {
    setHighestBid(null);
    setLastBidTime(null);
    setAuctionEnded(null);
  }, [auction.highestBidHandle, auction.lastBidHandle, auction.id]);

  const requireTransacting = () => {
    if (!canTransact || !viewerAddress) {
      throw new Error('Connect your wallet to continue');
    }
    if (!zamaInstance) {
      throw new Error('Encryption service not ready');
    }
  };

  const userDecrypt = async (handles: string[]): Promise<DecryptionResult> => {
    requireTransacting();

    const sanitized = handles.filter(Boolean);
    if (sanitized.length === 0) {
      throw new Error('Nothing to decrypt');
    }

    const keypair = zamaInstance.generateKeypair();
    const handleContractPairs = sanitized.map(handle => ({
      handle,
      contractAddress: CONTRACT_ADDRESS,
    }));
    const startTimestamp = Math.floor(Date.now() / 1000).toString();
    const eip712 = zamaInstance.createEIP712(
      keypair.publicKey,
      CONTRACT_ADDRESSES,
      startTimestamp,
      DURATION_DAYS,
    );

    const signer = await signerPromise;
    if (!signer) {
      throw new Error('Wallet signer not available');
    }

    const signature = await signer.signTypedData(
      eip712.domain,
      { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
      eip712.message,
    );

    const signerAddress = await signer.getAddress();

    return zamaInstance.userDecrypt(
      handleContractPairs,
      keypair.privateKey,
      keypair.publicKey,
      signature.replace('0x', ''),
      CONTRACT_ADDRESSES,
      signerAddress,
      startTimestamp,
      DURATION_DAYS,
    );
  };

  const handleDecryptHighest = async () => {
    setDecryptError(null);
    setIsDecryptingHighest(true);
    try {
      const result = await userDecrypt([auction.highestBidHandle]);
      const value = result[auction.highestBidHandle];

      if (typeof value === 'bigint' || typeof value === 'number') {
        setHighestBid(Number(value).toString());
      } else if (typeof value === 'string') {
        setHighestBid(value);
      } else if (value === undefined) {
        setHighestBid('You do not have access yet');
      } else {
        setHighestBid('Unavailable');
      }
    } catch (err) {
      console.error('Failed to decrypt highest bid', err);
      setDecryptError(err instanceof Error ? err.message : 'Unable to decrypt highest bid');
    } finally {
      setIsDecryptingHighest(false);
    }
  };

  const handleDecryptLastBidTime = async () => {
    setDecryptError(null);
    setIsDecryptingTime(true);
    try {
      const result = await userDecrypt([auction.lastBidHandle]);
      const value = result[auction.lastBidHandle];

      if (typeof value === 'bigint' || typeof value === 'number') {
        const timestamp = Number(value);
        setLastBidTime(new Date(timestamp * 1000).toLocaleString());
      } else if (value === undefined) {
        setLastBidTime('You do not have access yet');
      } else {
        setLastBidTime('Unavailable');
      }
    } catch (err) {
      console.error('Failed to decrypt last bid time', err);
      setDecryptError(err instanceof Error ? err.message : 'Unable to decrypt last bid time');
    } finally {
      setIsDecryptingTime(false);
    }
  };

  const handleBid = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBidError(null);
    setBidStatus(null);

    try {
      requireTransacting();
    } catch (err) {
      setBidError(err instanceof Error ? err.message : 'Wallet unavailable');
      return;
    }

    const value = Number(bidValue);
    if (!Number.isFinite(value) || value <= 0) {
      setBidError('Enter a valid bid amount');
      return;
    }

    try {
      setIsPlacingBid(true);
      setBidStatus('Encrypting bid and preparing transaction...');

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet signer not available');
      }

      const signerAddress = await signer.getAddress();
      const encryptedInput = zamaInstance.createEncryptedInput(CONTRACT_ADDRESS, signerAddress);
      encryptedInput.add32(Math.trunc(value));
      const encrypted = await encryptedInput.encrypt();

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const handleResult = await contract.bid.staticCall(
        BigInt(auction.id),
        encrypted.handles[0],
        encrypted.inputProof,
      );

      const tx = await contract.bid(
        BigInt(auction.id),
        encrypted.handles[0],
        encrypted.inputProof,
      );

      setBidStatus('Waiting for confirmation...');
      await tx.wait();

      const resultHandle = handleResult as string;
      const decrypted = await userDecrypt([resultHandle]);
      const valueResult = decrypted[resultHandle];
      const isHighest = valueResult === true || valueResult === 'true';

      setBidStatus(isHighest ? 'Your bid is now the highest.' : 'Bid submitted but not the highest.');
      setBidValue('');
      await onBidPlaced();
    } catch (err) {
      console.error('Failed to place bid', err);
      const reason = err instanceof Error ? err.message : 'Unknown error';
      setBidError(`Bid failed: ${reason}`);
    } finally {
      setIsPlacingBid(false);
    }
  };

  const handleCheckEnded = async () => {
    setEndedError(null);
    setIsCheckingEnded(true);
    try {
      requireTransacting();

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet signer not available');
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const handleResult = await contract.checkEnded.staticCall(BigInt(auction.id));
      const tx = await contract.checkEnded(BigInt(auction.id));
      await tx.wait();

      const resultHandle = handleResult as string;
      const decrypted = await userDecrypt([resultHandle]);
      const ended = decrypted[resultHandle];
      setAuctionEnded(ended === true || ended === 'true');
    } catch (err) {
      console.error('Failed to check auction end status', err);
      setEndedError(err instanceof Error ? err.message : 'Unable to check auction status');
    } finally {
      setIsCheckingEnded(false);
    }
  };

  return (
    <div className="auction-card">
      <header className="card-header">
        <h3>{auction.name}</h3>
        <span className="pill">ID #{auction.id}</span>
      </header>

      <div className="card-row">
        <span className="row-label">Created</span>
        <span className="row-value">{createdAtText}</span>
      </div>
      <div className="card-row">
        <span className="row-label">Start Price</span>
        <span className="row-value">{auction.startPrice}</span>
      </div>

      {highestBid && (
        <div className="card-row">
          <span className="row-label">Highest Bid</span>
          <span className="row-value strong">{highestBid}</span>
        </div>
      )}

      {lastBidTime && (
        <div className="card-row">
          <span className="row-label">Last Bid</span>
          <span className="row-value">{lastBidTime}</span>
        </div>
      )}

      {auctionEnded !== null && (
        <div className="card-row">
          <span className="row-label">Ended</span>
          <span className={`ended-indicator ${auctionEnded ? 'ended-yes' : 'ended-no'}`}>
            {auctionEnded ? 'Yes' : 'No'}
          </span>
        </div>
      )}

      {decryptError && <p className="error-line">{decryptError}</p>}

      <div className="actions-grid">
        <button
          className="secondary-button"
          onClick={handleDecryptHighest}
          disabled={isDecryptingHighest || !canTransact}
        >
          {isDecryptingHighest ? 'Decrypting…' : 'Decrypt Highest Bid'}
        </button>
        <button
          className="secondary-button"
          onClick={handleDecryptLastBidTime}
          disabled={isDecryptingTime || !canTransact}
        >
          {isDecryptingTime ? 'Decrypting…' : 'Decrypt Last Bid Time'}
        </button>
      </div>

      <form className="bid-form" onSubmit={handleBid}>
        <label className="form-label">
          Place Bid (wei)
          <input
            className="form-input"
            type="number"
            min={1}
            value={bidValue}
            onChange={(event) => setBidValue(event.target.value)}
            placeholder="Enter your secret bid"
            disabled={!canTransact || isPlacingBid}
            required
          />
        </label>
        <button className="primary-button" type="submit" disabled={!canTransact || isPlacingBid}>
          {isPlacingBid ? 'Submitting…' : 'Submit Bid'}
        </button>
      </form>

      {bidError && <p className="error-line">{bidError}</p>}
      {bidStatus && !bidError && <p className="info-line">{bidStatus}</p>}

      <button
        className="secondary-button full-width"
        onClick={handleCheckEnded}
        disabled={!canTransact || isCheckingEnded}
      >
        {isCheckingEnded ? 'Checking…' : 'Check Auction Ended'}
      </button>
      {endedError && <p className="error-line">{endedError}</p>}
    </div>
  );
}
