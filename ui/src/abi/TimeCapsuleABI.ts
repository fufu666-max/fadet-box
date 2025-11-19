/*
  This file is auto-generated.
  Command: 'npm run genabi'
  Update this file after deploying the contract.
*/
export const TimeCapsuleABI = {
  abi: [
    {
      inputs: [
        {
          internalType: "address",
          name: "manager",
          type: "address",
        },
      ],
      stateMutability: "nonpayable",
      type: "constructor",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "uint256",
          name: "capsuleId",
          type: "uint256",
        },
        {
          indexed: true,
          internalType: "address",
          name: "creator",
          type: "address",
        },
        {
          indexed: false,
          internalType: "uint256",
          name: "unlockTimestamp",
          type: "uint256",
        },
      ],
      name: "CapsuleCreated",
      type: "event",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          internalType: "uint256",
          name: "capsuleId",
          type: "uint256",
        },
        {
          indexed: true,
          internalType: "address",
          name: "creator",
          type: "address",
        },
      ],
      name: "CapsuleUnlocked",
      type: "event",
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "capsuleId",
          type: "uint256",
        },
      ],
      name: "canUnlock",
      outputs: [
        {
          internalType: "bool",
          name: "",
          type: "bool",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "bytes32",
          name: "encMessagePart1",
          type: "bytes32",
        },
        {
          internalType: "bytes",
          name: "messagePart1Proof",
          type: "bytes",
        },
        {
          internalType: "bytes32",
          name: "encMessagePart2",
          type: "bytes32",
        },
        {
          internalType: "bytes",
          name: "messagePart2Proof",
          type: "bytes",
        },
        {
          internalType: "uint256",
          name: "unlockTimestamp",
          type: "uint256",
        },
      ],
      name: "createCapsule",
      outputs: [
        {
          internalType: "uint256",
          name: "capsuleId",
          type: "uint256",
        },
      ],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [],
      name: "decryptManager",
      outputs: [
        {
          internalType: "address",
          name: "",
          type: "address",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      name: "capsules",
      outputs: [
        {
          internalType: "bytes32",
          name: "encryptedMessagePart1",
          type: "bytes32",
        },
        {
          internalType: "bytes32",
          name: "encryptedMessagePart2",
          type: "bytes32",
        },
        {
          internalType: "uint256",
          name: "unlockTimestamp",
          type: "uint256",
        },
        {
          internalType: "address",
          name: "creator",
          type: "address",
        },
        {
          internalType: "bool",
          name: "exists",
          type: "bool",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "getTotalCapsules",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "uint256",
          name: "capsuleId",
          type: "uint256",
        },
      ],
      name: "getCapsule",
      outputs: [
        {
          internalType: "bytes32",
          name: "encryptedMessagePart1",
          type: "bytes32",
        },
        {
          internalType: "bytes32",
          name: "encryptedMessagePart2",
          type: "bytes32",
        },
        {
          internalType: "uint256",
          name: "unlockTimestamp",
          type: "uint256",
        },
        {
          internalType: "address",
          name: "creator",
          type: "address",
        },
        {
          internalType: "bool",
          name: "exists",
          type: "bool",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [
        {
          internalType: "address",
          name: "user",
          type: "address",
        },
      ],
      name: "getUserCapsules",
      outputs: [
        {
          internalType: "uint256[]",
          name: "",
          type: "uint256[]",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
  ],
} as const;

