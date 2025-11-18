import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Deploy TimeCapsule contract with deployer as decrypt manager
  const deployedTimeCapsule = await deploy("TimeCapsule", {
    from: deployer,
    args: [deployer], // deployer is the decrypt manager
    log: true,
  });

  console.log(`TimeCapsule contract deployed at: ${deployedTimeCapsule.address}`);
  console.log(`Decrypt manager: ${deployer}`);
};

export default func;
func.id = "deploy_timecapsule"; // id required to prevent reexecution
func.tags = ["TimeCapsule"];

