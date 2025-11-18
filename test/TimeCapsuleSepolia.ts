import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { TimeCapsule } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("TimeCapsuleSepolia", function () {
  let signers: Signers;
  let timeCapsuleContract: TimeCapsule;
  let timeCapsuleContractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const TimeCapsuleDeployment = await deployments.get("TimeCapsule");
      timeCapsuleContractAddress = TimeCapsuleDeployment.address;
      timeCapsuleContract = await ethers.getContractAt("TimeCapsule", TimeCapsuleDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("should create a capsule on Sepolia", async function () {
    steps = 8;

    this.timeout(4 * 40000);

    progress("Creating message hash...");
    const messageHash = ethers.keccak256(ethers.toUtf8Bytes("Hello Sepolia!"));
    const messageHashNum = BigInt(messageHash) & BigInt("0xFFFFFFFF");

    progress(`Encrypting message hash (${Number(messageHashNum)})...`);
    const encryptedHash = await fhevm
      .createEncryptedInput(timeCapsuleContractAddress, signers.alice.address)
      .add32(Number(messageHashNum))
      .encrypt();

    progress(`Setting unlock date...`);
    const unlockTimestamp = Math.floor(Date.now() / 1000) + 86400; // 1 day from now

    progress(
      `Call createCapsule() TimeCapsule=${timeCapsuleContractAddress} handle=${ethers.hexlify(encryptedHash.handles[0])} signer=${signers.alice.address}...`
    );
    const tx = await timeCapsuleContract
      .connect(signers.alice)
      .createCapsule(encryptedHash.handles[0], encryptedHash.inputProof, unlockTimestamp);
    await tx.wait();

    progress(`Call getTotalCapsules()...`);
    const totalCapsules = await timeCapsuleContract.getTotalCapsules();
    expect(totalCapsules).to.eq(1);

    progress(`Call getCapsule(0)...`);
    const capsule = await timeCapsuleContract.getCapsule(0);
    expect(capsule.exists).to.be.true;
    expect(capsule.creator).to.eq(signers.alice.address);

    progress(`Decrypting encrypted message hash...`);
    const decryptedHash = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      capsule.encryptedMessageHash,
      timeCapsuleContractAddress,
      signers.alice
    );
    progress(`Decrypted hash: ${decryptedHash}`);

    expect(Number(decryptedHash)).to.eq(Number(messageHashNum));
  });
});

