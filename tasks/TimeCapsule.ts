import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Tutorial: Deploy and Interact Locally (--network localhost)
 * ===========================================================
 *
 * 1. From a separate terminal window:
 *
 *   npx hardhat node
 *
 * 2. Deploy the TimeCapsule contract
 *
 *   npx hardhat --network localhost deploy --tags TimeCapsule
 *
 * 3. Interact with the TimeCapsule contract
 *
 *   npx hardhat --network localhost task:create-capsule --message "Hello Future" --unlock-timestamp 1735689600
 *   npx hardhat --network localhost task:get-capsule --id 0
 *   npx hardhat --network localhost task:get-user-capsules
 *
 *
 * Tutorial: Deploy and Interact on Sepolia (--network sepolia)
 * ===========================================================
 *
 * 1. Deploy the TimeCapsule contract
 *
 *   npx hardhat --network sepolia deploy --tags TimeCapsule
 *
 * 2. Interact with the TimeCapsule contract
 *
 *   npx hardhat --network sepolia task:create-capsule --message "Hello Sepolia" --unlock-timestamp 1735689600
 *   npx hardhat --network sepolia task:get-capsule --id 0
 *
 */

/**
 * Example:
 *   - npx hardhat --network localhost task:address-capsule
 *   - npx hardhat --network sepolia task:address-capsule
 */
task("task:address-capsule", "Prints the TimeCapsule address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;

  const timeCapsule = await deployments.get("TimeCapsule");

  console.log("TimeCapsule address is " + timeCapsule.address);
});

/**
 * Example:
 *   - npx hardhat --network localhost task:create-capsule --message "Hello" --unlock-timestamp 1735689600
 *   - npx hardhat --network sepolia task:create-capsule --message "Hello" --unlock-timestamp 1735689600
 */
task("task:create-capsule", "Creates a new time capsule")
  .addOptionalParam("address", "Optionally specify the TimeCapsule contract address")
  .addParam("message", "The message to encrypt")
  .addParam("unlockTimestamp", "Unix timestamp when the capsule can be unlocked")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const TimeCapsuleDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("TimeCapsule");
    console.log(`TimeCapsule: ${TimeCapsuleDeployment.address}`);

    const signers = await ethers.getSigners();
    const timeCapsuleContract = await ethers.getContractAt("TimeCapsule", TimeCapsuleDeployment.address);

    // Calculate message hash (first 32 bits)
    const messageHash = ethers.keccak256(ethers.toUtf8Bytes(taskArguments.message));
    const messageHashNum = Number(BigInt(messageHash) & BigInt("0xFFFFFFFF"));

    console.log(`Message: ${taskArguments.message}`);
    console.log(`Message hash (first 32 bits): ${messageHashNum}`);

    // Encrypt the message hash
    const encryptedHash = await fhevm
      .createEncryptedInput(TimeCapsuleDeployment.address, signers[0].address)
      .add32(messageHashNum)
      .encrypt();

    const unlockTimestamp = BigInt(taskArguments.unlockTimestamp);
    console.log(`Unlock timestamp: ${unlockTimestamp}`);

    const tx = await timeCapsuleContract
      .connect(signers[0])
      .createCapsule(
        {
          data: encryptedHash.handles[0],
        },
        encryptedHash.inputProof,
        unlockTimestamp
      );
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    // Get the capsule ID from events
    const events = receipt?.logs
      .map((log) => {
        try {
          return timeCapsuleContract.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .filter((e) => e !== null);

    const createdEvent = events?.find((e) => e?.name === "CapsuleCreated");
    if (createdEvent) {
      console.log(`Capsule created with ID: ${createdEvent.args[0]}`);
    }

    console.log(`TimeCapsule createCapsule() succeeded!`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:get-capsule --id 0
 *   - npx hardhat --network sepolia task:get-capsule --id 0
 */
task("task:get-capsule", "Gets capsule data")
  .addOptionalParam("address", "Optionally specify the TimeCapsule contract address")
  .addParam("id", "The capsule ID")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const TimeCapsuleDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("TimeCapsule");
    console.log(`TimeCapsule: ${TimeCapsuleDeployment.address}`);

    const signers = await ethers.getSigners();
    const timeCapsuleContract = await ethers.getContractAt("TimeCapsule", TimeCapsuleDeployment.address);

    const capsuleId = BigInt(taskArguments.id);
    const capsule = await timeCapsuleContract.getCapsule(capsuleId);

    console.log(`Capsule ID: ${capsuleId}`);
    console.log(`Creator: ${capsule.creator}`);
    console.log(`Unlock Timestamp: ${capsule.unlockTimestamp}`);
    console.log(`Exists: ${capsule.exists}`);

    if (capsule.encryptedMessageHash !== ethers.ZeroHash) {
      const clearHash = await fhevm.userDecryptEuint(
        FhevmType.euint32,
        capsule.encryptedMessageHash,
        TimeCapsuleDeployment.address,
        signers[0],
      );
      console.log(`Encrypted Message Hash: ${capsule.encryptedMessageHash}`);
      console.log(`Decrypted Message Hash: ${clearHash}`);
    } else {
      console.log("Encrypted Message Hash: (uninitialized)");
    }
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:get-user-capsules
 *   - npx hardhat --network sepolia task:get-user-capsules
 */
task("task:get-user-capsules", "Gets all capsule IDs for the current user")
  .addOptionalParam("address", "Optionally specify the TimeCapsule contract address")
  .addOptionalParam("user", "User address (defaults to first signer)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const TimeCapsuleDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("TimeCapsule");
    console.log(`TimeCapsule: ${TimeCapsuleDeployment.address}`);

    const signers = await ethers.getSigners();
    const userAddress = taskArguments.user || signers[0].address;
    const timeCapsuleContract = await ethers.getContractAt("TimeCapsule", TimeCapsuleDeployment.address);

    const capsuleIds = await timeCapsuleContract.getUserCapsules(userAddress);
    console.log(`User: ${userAddress}`);
    console.log(`Capsule IDs: ${capsuleIds.map((id: bigint) => id.toString()).join(", ")}`);
    console.log(`Total: ${capsuleIds.length}`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost task:can-unlock --id 0
 *   - npx hardhat --network sepolia task:can-unlock --id 0
 */
task("task:can-unlock", "Checks if a capsule can be unlocked")
  .addOptionalParam("address", "Optionally specify the TimeCapsule contract address")
  .addParam("id", "The capsule ID")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const TimeCapsuleDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("TimeCapsule");
    console.log(`TimeCapsule: ${TimeCapsuleDeployment.address}`);

    const timeCapsuleContract = await ethers.getContractAt("TimeCapsule", TimeCapsuleDeployment.address);

    const capsuleId = BigInt(taskArguments.id);
    const canUnlock = await timeCapsuleContract.canUnlock(capsuleId);

    console.log(`Capsule ID: ${capsuleId}`);
    console.log(`Can Unlock: ${canUnlock}`);
    
    if (canUnlock) {
      console.log("✅ This capsule can be unlocked!");
    } else {
      const capsule = await timeCapsuleContract.getCapsule(capsuleId);
      const now = Math.floor(Date.now() / 1000);
      const unlockTime = Number(capsule.unlockTimestamp);
      const timeLeft = unlockTime - now;
      console.log(`⏳ Unlock in ${Math.floor(timeLeft / 86400)} days, ${Math.floor((timeLeft % 86400) / 3600)} hours`);
    }
  });

