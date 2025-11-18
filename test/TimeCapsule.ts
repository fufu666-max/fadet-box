import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { TimeCapsule, TimeCapsule__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("TimeCapsule")) as TimeCapsule__factory;
  const timeCapsuleContract = (await factory.deploy(await (await ethers.getSigners())[0].getAddress())) as TimeCapsule;
  const timeCapsuleContractAddress = await timeCapsuleContract.getAddress();

  return { timeCapsuleContract, timeCapsuleContractAddress };
}

describe("TimeCapsule", function () {
  let signers: Signers;
  let timeCapsuleContract: TimeCapsule;
  let timeCapsuleContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ timeCapsuleContract, timeCapsuleContractAddress } = await deployFixture());
  });

  it("should initialize with zero capsules", async function () {
    const totalCapsules = await timeCapsuleContract.getTotalCapsules();
    expect(totalCapsules).to.eq(0);
  });

  it("should create a capsule with encrypted message hash", async function () {
    // Encode message to two parts (up to 8 characters)
    const message = "Hello";
    const messageBytes = ethers.toUtf8Bytes(message);
    
    // Encode first 4 bytes as uint32 (Part 1)
    let messageNum1 = 0;
    for (let i = 0; i < Math.min(4, messageBytes.length); i++) {
      messageNum1 = (messageNum1 << 8) | messageBytes[i];
    }
    
    // Encode next 4 bytes as uint32 (Part 2)
    let messageNum2 = 0;
    for (let i = 4; i < Math.min(8, messageBytes.length); i++) {
      messageNum2 = (messageNum2 << 8) | messageBytes[i];
    }

    // Encrypt both message parts
    const encryptedPart1 = await fhevm
      .createEncryptedInput(timeCapsuleContractAddress, signers.alice.address)
      .add32(messageNum1)
      .encrypt();
    
    const encryptedPart2 = await fhevm
      .createEncryptedInput(timeCapsuleContractAddress, signers.alice.address)
      .add32(messageNum2)
      .encrypt();

    // Set unlock date to 1 day from now
    const unlockTimestamp = Math.floor(Date.now() / 1000) + 86400;

    const tx = await timeCapsuleContract
      .connect(signers.alice)
      .createCapsule(
        encryptedPart1.handles[0],
        encryptedPart1.inputProof,
        encryptedPart2.handles[0],
        encryptedPart2.inputProof,
        unlockTimestamp
      );
    const receipt = await tx.wait();

    // Check that capsule was created
    const totalCapsules = await timeCapsuleContract.getTotalCapsules();
    expect(totalCapsules).to.eq(1);

    // Get capsule data
    const capsule = await timeCapsuleContract.getCapsule(0);
    expect(capsule.exists).to.be.true;
    expect(capsule.creator).to.eq(signers.alice.address);
    expect(capsule.unlockTimestamp).to.eq(unlockTimestamp);

    // Check user capsules
    const userCapsules = await timeCapsuleContract.getUserCapsules(signers.alice.address);
    expect(userCapsules.length).to.eq(1);
    expect(userCapsules[0]).to.eq(0);
  });

  it("should reject creation with past unlock date", async function () {
    const message = "Test";
    const messageBytes = ethers.toUtf8Bytes(message);
    let messageNum1 = 0;
    for (let i = 0; i < Math.min(4, messageBytes.length); i++) {
      messageNum1 = (messageNum1 << 8) | messageBytes[i];
    }
    let messageNum2 = 0;

    const encryptedPart1 = await fhevm
      .createEncryptedInput(timeCapsuleContractAddress, signers.alice.address)
      .add32(messageNum1)
      .encrypt();
    
    const encryptedPart2 = await fhevm
      .createEncryptedInput(timeCapsuleContractAddress, signers.alice.address)
      .add32(messageNum2)
      .encrypt();

    // Set unlock date to past
    const unlockTimestamp = Math.floor(Date.now() / 1000) - 86400;

    await expect(
      timeCapsuleContract
        .connect(signers.alice)
        .createCapsule(
          encryptedPart1.handles[0],
          encryptedPart1.inputProof,
          encryptedPart2.handles[0],
          encryptedPart2.inputProof,
          unlockTimestamp
        )
    ).to.be.revertedWith("Unlock date must be in the future");
  });

  it("should allow decryption after unlock date", async function () {
    const message = "Test";
    const messageBytes = ethers.toUtf8Bytes(message);
    let messageNum1 = 0;
    for (let i = 0; i < Math.min(4, messageBytes.length); i++) {
      messageNum1 = (messageNum1 << 8) | messageBytes[i];
    }
    let messageNum2 = 0;

    const encryptedPart1 = await fhevm
      .createEncryptedInput(timeCapsuleContractAddress, signers.alice.address)
      .add32(messageNum1)
      .encrypt();
    
    const encryptedPart2 = await fhevm
      .createEncryptedInput(timeCapsuleContractAddress, signers.alice.address)
      .add32(messageNum2)
      .encrypt();

    // Set unlock date to 1 second from now (for testing)
    const currentTime = await ethers.provider.getBlock("latest");
    const unlockTimestamp = (currentTime?.timestamp || Math.floor(Date.now() / 1000)) + 2;

    await timeCapsuleContract
      .connect(signers.alice)
      .createCapsule(
        encryptedPart1.handles[0],
        encryptedPart1.inputProof,
        encryptedPart2.handles[0],
        encryptedPart2.inputProof,
        unlockTimestamp
      );

    // Wait for unlock time
    await ethers.provider.send("evm_increaseTime", [3]);
    await ethers.provider.send("evm_mine", []);

    // Check if can unlock
    const canUnlock = await timeCapsuleContract.canUnlock(0);
    expect(canUnlock).to.be.true;

    // Decrypt the message parts
    const capsule = await timeCapsuleContract.getCapsule(0);
    const decryptedPart1 = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      capsule.encryptedMessagePart1,
      timeCapsuleContractAddress,
      signers.alice
    );
    
    const decryptedPart2 = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      capsule.encryptedMessagePart2,
      timeCapsuleContractAddress,
      signers.alice
    );

    expect(Number(decryptedPart1)).to.eq(messageNum1);
    expect(Number(decryptedPart2)).to.eq(messageNum2);
  });

  it("should track multiple capsules per user", async function () {
    const message1 = "Cap1";
    const messageBytes1 = ethers.toUtf8Bytes(message1);
    let messageNum1_1 = 0;
    for (let i = 0; i < Math.min(4, messageBytes1.length); i++) {
      messageNum1_1 = (messageNum1_1 << 8) | messageBytes1[i];
    }
    let messageNum1_2 = 0;

    const encryptedPart1_1 = await fhevm
      .createEncryptedInput(timeCapsuleContractAddress, signers.alice.address)
      .add32(messageNum1_1)
      .encrypt();
    
    const encryptedPart1_2 = await fhevm
      .createEncryptedInput(timeCapsuleContractAddress, signers.alice.address)
      .add32(messageNum1_2)
      .encrypt();

    const unlockTimestamp1 = Math.floor(Date.now() / 1000) + 86400;

    await timeCapsuleContract
      .connect(signers.alice)
      .createCapsule(
        encryptedPart1_1.handles[0],
        encryptedPart1_1.inputProof,
        encryptedPart1_2.handles[0],
        encryptedPart1_2.inputProof,
        unlockTimestamp1
      );

    const message2 = "Cap2";
    const messageBytes2 = ethers.toUtf8Bytes(message2);
    let messageNum2_1 = 0;
    for (let i = 0; i < Math.min(4, messageBytes2.length); i++) {
      messageNum2_1 = (messageNum2_1 << 8) | messageBytes2[i];
    }
    let messageNum2_2 = 0;

    const encryptedPart2_1 = await fhevm
      .createEncryptedInput(timeCapsuleContractAddress, signers.alice.address)
      .add32(messageNum2_1)
      .encrypt();
    
    const encryptedPart2_2 = await fhevm
      .createEncryptedInput(timeCapsuleContractAddress, signers.alice.address)
      .add32(messageNum2_2)
      .encrypt();

    const unlockTimestamp2 = Math.floor(Date.now() / 1000) + 172800;

    await timeCapsuleContract
      .connect(signers.alice)
      .createCapsule(
        encryptedPart2_1.handles[0],
        encryptedPart2_1.inputProof,
        encryptedPart2_2.handles[0],
        encryptedPart2_2.inputProof,
        unlockTimestamp2
      );

    const userCapsules = await timeCapsuleContract.getUserCapsules(signers.alice.address);
    expect(userCapsules.length).to.eq(2);
    expect(userCapsules[0]).to.eq(0);
    expect(userCapsules[1]).to.eq(1);

    const totalCapsules = await timeCapsuleContract.getTotalCapsules();
    expect(totalCapsules).to.eq(2);
  });
});

