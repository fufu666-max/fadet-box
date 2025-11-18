// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title TimeCapsule
/// @notice A time capsule contract that stores encrypted messages until a specified unlock date.
///         Messages are encrypted using FHE, and can only be decrypted after the unlock date.
contract TimeCapsule is SepoliaConfig {
    /// @notice Address allowed to decrypt capsules after unlock date
    address public immutable decryptManager;

    /// @notice Structure to store capsule data
    struct Capsule {
        euint32 encryptedMessagePart1;  // Encrypted first part of the message (4 bytes)
        euint32 encryptedMessagePart2;  // Encrypted second part of the message (4 bytes, optional)
        uint256 unlockTimestamp;        // Unix timestamp when capsule can be unlocked
        address creator;                // Address of the capsule creator
        bool exists;                    // Whether the capsule exists
    }

    /// @notice Mapping from capsule ID to capsule data
    mapping(uint256 => Capsule) public capsules;

    /// @notice Mapping from creator address to their capsule IDs
    mapping(address => uint256[]) public userCapsules;

    /// @notice Counter for generating unique capsule IDs
    uint256 private _capsuleCounter;

    /// @notice Event emitted when a new capsule is created
    event CapsuleCreated(
        uint256 indexed capsuleId,
        address indexed creator,
        uint256 unlockTimestamp
    );

    /// @notice Event emitted when a capsule is unlocked
    event CapsuleUnlocked(uint256 indexed capsuleId, address indexed creator);

    /// @param manager Address authorized to decrypt capsules after unlock date
    constructor(address manager) {
        decryptManager = manager;
        _capsuleCounter = 0;
    }

    /// @notice Create a new time capsule with encrypted message parts
    /// @param encMessagePart1 Encrypted first part of the message (4 bytes)
    /// @param messagePart1Proof Input proof for encMessagePart1
    /// @param encMessagePart2 Encrypted second part of the message (4 bytes, can be zero)
    /// @param messagePart2Proof Input proof for encMessagePart2
    /// @param unlockTimestamp Unix timestamp when the capsule can be unlocked
    /// @return capsuleId The ID of the newly created capsule
    function createCapsule(
        externalEuint32 encMessagePart1,
        bytes calldata messagePart1Proof,
        externalEuint32 encMessagePart2,
        bytes calldata messagePart2Proof,
        uint256 unlockTimestamp
    ) external returns (uint256) {
        require(unlockTimestamp > block.timestamp, "Unlock date must be in the future");

        uint256 capsuleId = _capsuleCounter;
        _capsuleCounter++;

        euint32 encryptedPart1 = FHE.fromExternal(encMessagePart1, messagePart1Proof);
        euint32 encryptedPart2 = FHE.fromExternal(encMessagePart2, messagePart2Proof);

        // Initialize encrypted values
        capsules[capsuleId] = Capsule({
            encryptedMessagePart1: encryptedPart1,
            encryptedMessagePart2: encryptedPart2,
            unlockTimestamp: unlockTimestamp,
            creator: msg.sender,
            exists: true
        });

        // Add to user's capsule list
        userCapsules[msg.sender].push(capsuleId);

        // Grant decryption permissions for both parts
        FHE.allowThis(encryptedPart1);
        FHE.allowThis(encryptedPart2);
        if (decryptManager != address(0)) {
            FHE.allow(encryptedPart1, decryptManager);
            FHE.allow(encryptedPart2, decryptManager);
        }
        // Allow creator to decrypt their own capsule after unlock
        FHE.allow(encryptedPart1, msg.sender);
        FHE.allow(encryptedPart2, msg.sender);

        emit CapsuleCreated(capsuleId, msg.sender, unlockTimestamp);

        return capsuleId;
    }

    /// @notice Get capsule data (encrypted message parts and metadata)
    /// @param capsuleId The ID of the capsule
    /// @return encryptedMessagePart1 The encrypted first part of the message
    /// @return encryptedMessagePart2 The encrypted second part of the message
    /// @return unlockTimestamp The unlock timestamp
    /// @return creator The creator address
    /// @return exists Whether the capsule exists
    function getCapsule(uint256 capsuleId)
        external
        view
        returns (
            euint32 encryptedMessagePart1,
            euint32 encryptedMessagePart2,
            uint256 unlockTimestamp,
            address creator,
            bool exists
        )
    {
        Capsule memory capsule = capsules[capsuleId];
        return (
            capsule.encryptedMessagePart1,
            capsule.encryptedMessagePart2,
            capsule.unlockTimestamp,
            capsule.creator,
            capsule.exists
        );
    }

    /// @notice Get all capsule IDs for a user
    /// @param user The user's address
    /// @return An array of capsule IDs
    function getUserCapsules(address user) external view returns (uint256[] memory) {
        return userCapsules[user];
    }

    /// @notice Check if a capsule can be unlocked
    /// @param capsuleId The ID of the capsule
    /// @return True if the capsule can be unlocked (unlock date has passed)
    function canUnlock(uint256 capsuleId) external view returns (bool) {
        Capsule memory capsule = capsules[capsuleId];
        require(capsule.exists, "Capsule does not exist");
        return block.timestamp >= capsule.unlockTimestamp;
    }

    /// @notice Get the total number of capsules created
    /// @return The total capsule count
    function getTotalCapsules() external view returns (uint256) {
        return _capsuleCounter;
    }
}

