import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";
import { FhevmType } from "@fhevm/hardhat-plugin";

task("auction:address", "Prints the FHEAuction address").setAction(async function (_args, hre) {
  const { deployments } = hre;
  const deployed = await deployments.get("FHEAuction");
  console.log(`FHEAuction address is ${deployed.address}`);
});

task("auction:create", "Create an auction")
  .addParam("name", "Auction name")
  .addParam("start", "Starting price (uint32)")
  .setAction(async function (args: TaskArguments, hre) {
    const { ethers, deployments } = hre;
    const signers = await ethers.getSigners();
    const deployed = await deployments.get("FHEAuction");
    const auction = await ethers.getContractAt("FHEAuction", deployed.address);

    const tx = await auction.connect(signers[0]).createAuction(args.name, parseInt(args.start));
    console.log(`createAuction tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`status=${receipt?.status}`);
  });

task("auction:bid", "Place encrypted bid")
  .addParam("id", "Auction id")
  .addParam("value", "Bid value (uint32)")
  .setAction(async function (args: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const deployed = await deployments.get("FHEAuction");
    const signer = (await ethers.getSigners())[0];
    const auction = await ethers.getContractAt("FHEAuction", deployed.address);

    const enc = await fhevm.createEncryptedInput(deployed.address, signer.address).add32(parseInt(args.value)).encrypt();
    const tx = await auction.connect(signer).bid(parseInt(args.id), enc.handles[0], enc.inputProof);
    console.log(`bid tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`status=${receipt?.status}`);

    const returned = await auction.bid.staticCall(parseInt(args.id), enc.handles[0], enc.inputProof);
    const clear = await fhevm.userDecryptEbool(FhevmType.ebool, returned, deployed.address, signer);
    console.log(`isHighest (decrypted): ${clear}`);
  });

task("auction:ended", "Check whether an auction ended (10 min rule)")
  .addParam("id", "Auction id")
  .setAction(async function (args: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();
    const deployed = await deployments.get("FHEAuction");
    const signer = (await ethers.getSigners())[0];
    const auction = await ethers.getContractAt("FHEAuction", deployed.address);

    const encEnded = await auction.connect(signer).checkEnded(parseInt(args.id));
    const ended = await fhevm.userDecryptEbool(FhevmType.ebool, encEnded, deployed.address, signer);
    console.log(`ended (decrypted): ${ended}`);
  });
