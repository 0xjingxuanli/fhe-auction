// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, euint64, eaddress, ebool, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title FHE-based sealed-bid auction manager
/// @notice Allows creating auctions and bidding using encrypted values
/// @dev All sensitive state (highest bid, bidder, last bid time) is stored encrypted.
contract FHEAuction is SepoliaConfig {
    struct Auction {
        string name; // public metadata
        euint32 startPrice; // encrypted starting price
        euint32 highestBid; // encrypted highest bid
        eaddress highestBidder; // encrypted highest bidder
        euint64 lastBidTime; // encrypted last bid timestamp
        uint256 createdAt; // plaintext creation time (does not depend on msg.sender)
        bool created; // exists flag
    }

    uint256 public auctionCount;
    mapping(uint256 => Auction) private auctions;

    event AuctionCreated(uint256 indexed id, string name);
    event BidSubmitted(uint256 indexed id, address indexed bidder);

    /// @notice Create a new auction with a plaintext starting price
    /// @param name The auction name
    /// @param startPrice The starting price in clear (will be trivially encrypted on-chain)
    function createAuction(string calldata name, uint32 startPrice) external returns (uint256 id) {
        id = ++auctionCount;

        euint32 encStart = FHE.asEuint32(startPrice);
        euint32 encHighest = encStart;
        eaddress encBidder = FHE.asEaddress(address(0));
        euint64 encNow = FHE.asEuint64(uint64(block.timestamp));

        auctions[id] = Auction({
            name: name,
            startPrice: encStart,
            highestBid: encHighest,
            highestBidder: encBidder,
            lastBidTime: encNow,
            createdAt: block.timestamp,
            created: true
        });

        // Allow this contract to keep operating on encrypted fields
        FHE.allowThis(auctions[id].startPrice);
        FHE.allowThis(auctions[id].highestBid);
        FHE.allowThis(auctions[id].highestBidder);
        FHE.allowThis(auctions[id].lastBidTime);

        emit AuctionCreated(id, name);
    }

    /// @notice Returns public info for an auction (no sensitive data)
    /// @dev Does not use msg.sender inside view methods
    function getAuctionInfo(uint256 id) external view returns (string memory name, uint256 createdAt) {
        require(auctions[id].created, "AUCTION_NOT_FOUND");
        Auction storage a = auctions[id];
        return (a.name, a.createdAt);
    }

    /// @notice Returns the encrypted highest bidder address handle for an auction
    /// @dev Caller can request client-side decryption via relayer SDK; no ACL changes done here
    function getEncryptedHighestBidder(uint256 id) external view returns (eaddress) {
        require(auctions[id].created, "AUCTION_NOT_FOUND");
        return auctions[id].highestBidder;
    }

    /// @notice Returns the encrypted highest bid handle for an auction
    /// @dev Caller can request client-side decryption via relayer SDK; no ACL changes done here
    function getEncryptedHighestBid(uint256 id) external view returns (euint32) {
        require(auctions[id].created, "AUCTION_NOT_FOUND");
        return auctions[id].highestBid;
    }

    /// @notice Submit an encrypted bid; returns an encrypted boolean indicating if it became highest
    /// @param id Auction id
    /// @param inputEuint32 Encrypted bid handle
    /// @param inputProof Input proof from relayer SDK
    /// @return isHighest Encrypted boolean set to true if bid is now the highest
    function bid(uint256 id, externalEuint32 inputEuint32, bytes calldata inputProof) external returns (ebool isHighest) {
        require(auctions[id].created, "AUCTION_NOT_FOUND");
        Auction storage a = auctions[id];

        // Validate and import encrypted bid
        euint32 encBid = FHE.fromExternal(inputEuint32, inputProof);

        // Determine if the bid is strictly greater than current highest
        isHighest = FHE.gt(encBid, a.highestBid);

        // Conditionally update encrypted fields without revealing the condition
        a.highestBid = FHE.select(isHighest, encBid, a.highestBid);
        a.highestBidder = FHE.select(isHighest, FHE.asEaddress(msg.sender), a.highestBidder);
        a.lastBidTime = FHE.select(isHighest, FHE.asEuint64(uint64(block.timestamp)), a.lastBidTime);

        // Maintain ACL to allow continued contract operations on ciphertexts
        FHE.allowThis(a.highestBid);
        FHE.allowThis(a.highestBidder);
        FHE.allowThis(a.lastBidTime);

        // Allow caller to decrypt the outcome locally
        FHE.allow(isHighest, msg.sender);

        // Optionally allow the bidder to decrypt current encrypted fields after their action
        FHE.allow(a.highestBid, msg.sender);
        FHE.allow(a.highestBidder, msg.sender);
        FHE.allow(a.lastBidTime, msg.sender);

        emit BidSubmitted(id, msg.sender);
        return isHighest;
    }

    /// @notice Compute if auction is ended (10 minutes without a higher bid) and return encrypted bool
    /// @dev Non-view to adjust ACL for return value. Does not read msg.sender inside view methods.
    function checkEnded(uint256 id) external returns (ebool ended) {
        require(auctions[id].created, "AUCTION_NOT_FOUND");
        Auction storage a = auctions[id];

        // ended if (lastBidTime + 600) <= block.timestamp
        euint64 deadline = FHE.add(a.lastBidTime, FHE.asEuint64(600));
        ended = FHE.le(deadline, FHE.asEuint64(uint64(block.timestamp)));

        FHE.allow(ended, msg.sender);
        return ended;
    }
}
