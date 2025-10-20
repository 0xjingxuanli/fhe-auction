import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // const deployedFHECounter = await deploy("FHECounter", {
  //   from: deployer,
  //   log: true,
  // });
  // console.log(`FHECounter contract: `, deployedFHECounter.address);

  const deployedFHEAuction = await deploy("FHEAuction", {
    from: deployer,
    log: true,
  });
  console.log(`FHEAuction contract: `, deployedFHEAuction.address);
};
export default func;
func.id = "deploy_fheContracts"; // id required to prevent reexecution
func.tags = ["FHECounter", "FHEAuction"];
