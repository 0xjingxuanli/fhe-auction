# FHE Auction Platform

The FHE Auction Platform is a decentralized auction marketplace that protects bid confidentiality with fully homomorphic encryption while preserving transparent settlement on-chain. It allows sellers to create auction listings with a starting price, lets bidders submit Zama-encrypted offers, and automatically finalizes the highest encrypted bid when no new bids arrive within the configured timeout window. The solution combines solidity smart contracts, Zama’s FHE tooling, and a React front end so developers can explore privacy-preserving auctions end to end.

## Core Advantages

- **Confidential bidding**: All submitted bids are encrypted client-side using Zama FHE tooling, ensuring rivals never see each other’s raw offers while the contract still determines the winner.
- **Transparent outcomes**: The smart contract emits verifiable events and stores the encrypted leading bid, enabling post-auction decryption by the winner to prove settlement integrity.
- **Deterministic settlement**: Auctions automatically close after ten minutes of inactivity, lowering operational overhead and preventing indefinite stalemates.
- **Developer oriented**: Hardhat tasks, tests, and deployment scripts streamline local experimentation, Sepolia deployments, and integration with existing FHEVM infrastructure.
- **Production-ready frontend**: The `home` React + Vite application uses viem for reads and ethers for writes, integrates RainbowKit for wallet onboarding, and consumes the generated contract ABI directly from `deployments/sepolia`.

## Technology Stack

- **Smart contracts**: Solidity on Hardhat with TypeScript tooling, integrating Zama’s FHE libraries for encrypted arithmetic.
- **On-chain tooling**: Hardhat deploy scripts, custom tasks, and typed contract factories generated in `types/`.
- **Frontend**: React + Vite, RainbowKit, viem for state reads, and ethers v6 for write interactions without relying on browser storage or Tailwind CSS.
- **Encryption**: Zama FHEVM primitives, guided by `docs/zama_llm.md` and `docs/zama_doc_relayer.md` for correct key handling and relayer usage.
- **Deployment**: Sepolia via Infura RPC, authenticating with `process.env.INFURA_API_KEY` and a wallet `PRIVATE_KEY` loaded through `dotenv`.

## Problems We Solve

- **Leakage-free price discovery**: Traditional auctions leak live bidding behavior; homomorphic encryption keeps bids sealed until the contract declares a winner.
- **Trustless settlement**: Eliminates the need for centralized auctioneers, guaranteeing that the recorded highest encrypted bid matches the chain’s state.
- **Composable privacy**: Demonstrates how existing DeFi participants can integrate FHE-secured auctions without sacrificing Ethereum compatibility.
- **Developer onboarding**: Provides a reproducible template for running Zama-enabled auctions, from local simulation to testnet deployment and frontend interaction.

## Feature Highlights

- **Auction creation**: Sellers deploy listings specifying a name and starting price directly on-chain.
- **Encrypted bidding**: Participants encrypt bid values client-side, submit them through the contract, and receive an encrypted boolean (`ebool`) indicating if they currently lead.
- **Leader persistence**: When a bid is highest, the contract stores the encrypted value and bidder address as the active leader.
- **Timeout-based finalization**: If ten minutes pass without new bids, the last leader wins automatically and can decrypt their victory off-chain.
- **Event-driven UI**: The frontend reflects live auctions by reading contract state via viem and listening to Hardhat/Sepolia events.

## System Workflow

1. **Seller deploys auction**: Uses Hardhat task or UI to create an auction with a starting price and metadata.
2. **Bidders encrypt offers**: The frontend leverages Zama SDK helpers to encrypt amounts before transmitting them to the contract.
3. **Contract evaluates bids**: Encrypted comparisons determine if the new bid tops the current leader. Non-leading bidders receive `false` and can decrypt it locally.
4. **Leader tracked on-chain**: Winning bids store the encrypted value and bidder address without revealing the price.
5. **Timeout closes auction**: A background check ensures that after ten minutes without updates, the contract declares the stored leader as the winner.
6. **Winner decrypts outcome**: The victor retrieves the encrypted winning bid, decrypts it, and can optionally publish the value for transparency.

## Getting Started

### Prerequisites

- Node.js 20+
- npm (bundled with Node.js)
- An Infura account and funded Sepolia wallet for remote deployment

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env` file at the project root and define the following variables:

```
INFURA_API_KEY=<your_infura_project_id>
PRIVATE_KEY=<private_key_with_sepolia_funds>
```

The Hardhat configuration imports `dotenv` and consumes these values through `process.env.INFURA_API_KEY` and `process.env.PRIVATE_KEY` as required for deployments and task execution.

## Testing & Validation

- **Compile contracts**: `npm run compile`
- **Run unit tests**: `npm run test`
- **Execute custom tasks**: Use `npx hardhat` to list available Zama/FHE-specific tasks under the `tasks/` directory.

Always ensure tests and tasks complete successfully before promoting deployments beyond local environments.

## Deployment Workflow

1. **Local simulation**
   - Start an FHEVM-compatible Hardhat node: `npx hardhat node`
   - Deploy contracts locally: `npx hardhat deploy --network localhost`

2. **Sepolia deployment**
   - Verify `.env` includes `INFURA_API_KEY` and `PRIVATE_KEY`
   - Deploy with Hardhat: `npx hardhat deploy --network sepolia`
   - After deployment, copy the generated ABI from `deployments/sepolia` into the frontend integration points.

3. **Post-deploy verification (optional)**
   - Run targeted tests against Sepolia: `npx hardhat test --network sepolia`
   - Verify contracts with Etherscan if desired: `npx hardhat verify --network sepolia <contract_address>`

## Frontend Guide

- Navigate to the `home` directory and install dependencies if separate from the root install.
- Launch the Vite development server: `npm run dev`
- Connect with a RainbowKit-supported wallet on Sepolia; read calls flow through viem, while bids and auction creation use ethers write functions.
- The UI sources its ABI from `deployments/sepolia`, avoiding mock data, local storage, or environment variables as mandated by the project requirements.

## Future Roadmap

- **Batch auctions**: Support simultaneous multi-lot auctions with shared settlement windows.
- **Advanced analytics**: Provide optional zero-knowledge proofs that demonstrate bid ranges without revealing exact amounts.
- **Dynamic timeouts**: Allow sellers to configure variable timeout lengths or extend auctions on demand while preserving fairness.
- **Multi-network support**: Explore deployments on additional FHE-enabled L2s and rollups once available.
- **Frontend enhancements**: Add responsive layouts, richer auction history views, and improved encryption status indicators.

## Resources

- Zama FHEVM Documentation: <https://docs.zama.ai/fhevm>
- Hardhat Official Documentation: <https://hardhat.org/docs>
- Project-specific Zama guides: `docs/zama_llm.md`, `docs/zama_doc_relayer.md`

## License

This repository is distributed under the BSD-3-Clause-Clear License. Refer to `LICENSE` for full terms.
