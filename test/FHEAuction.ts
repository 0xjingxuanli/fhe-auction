import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { FHEAuction } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = await ethers.getContractFactory("FHEAuction");
  const contract = (await factory.deploy()) as unknown as FHEAuction;
  const address = await contract.getAddress();
  return { contract, address };
}

describe("FHEAuction", function () {
  let signers: Signers;
  let auction: FHEAuction;
  let address: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite runs only on Hardhat FHEVM mock");
      this.skip();
    }
    ({ contract: auction, address } = await deployFixture());
  });

  it("creates auction and accepts higher bid, rejects lower bid", async function () {
    // Create auction with start price 100
    let tx = await auction.connect(signers.alice).createAuction("Test Auction", 100);
    await tx.wait();

    const info = await auction.getAuctionInfo(1);
    expect(info[0]).to.eq("Test Auction");
    expect(info[1]).to.eq(100);

    // Alice bids 150
    let enc150 = await fhevm.createEncryptedInput(address, signers.alice.address).add32(150).encrypt();
    tx = await auction.connect(signers.alice).bid(1, enc150.handles[0], enc150.inputProof);
    await tx.wait();

    // Bob bids 120 (should not be highest)
    const enc120 = await fhevm.createEncryptedInput(address, signers.bob.address).add32(120).encrypt();
    tx = await auction.connect(signers.bob).bid(1, enc120.handles[0], enc120.inputProof);
    await tx.wait();
    // Highest should remain 150 for bidder to decrypt
    const encHighestAfter120 = await auction.getEncryptedHighestBid(1);
    const clearHighestAfter120 = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encHighestAfter120,
      address,
      signers.bob,
    );
    expect(clearHighestAfter120).to.eq(150);

    // Bob bids 200 (should be highest)
    const enc200 = await fhevm.createEncryptedInput(address, signers.bob.address).add32(200).encrypt();
    tx = await auction.connect(signers.bob).bid(1, enc200.handles[0], enc200.inputProof);
    await tx.wait();
    const encHighestAfter200 = await auction.getEncryptedHighestBid(1);
    const clearHighestAfter200 = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encHighestAfter200,
      address,
      signers.bob,
    );
    expect(clearHighestAfter200).to.eq(200);
  });
});
