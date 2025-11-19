// FHEVM SDK utilities for frontend
import { ethers } from "ethers";
import { JsonRpcProvider } from "ethers";

// Import @zama-fhe/relayer-sdk
// Note: Requires UMD script in index.html to set up window.relayerSDK
import { createInstance, initSDK, SepoliaConfig } from "@zama-fhe/relayer-sdk/bundle";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/bundle";

// Import @fhevm/mock-utils for localhost mock FHEVM
let MockFhevmInstance: any = null;
let userDecryptHandleBytes32: any = null;

export interface EncryptedInput {
  handles: string[];
  inputProof: string;
}

export enum FhevmType {
  euint8 = 0,
  euint16 = 1,
  euint32 = 2,
  euint64 = 3,
  euint128 = 4,
  euint256 = 5,
}

let fhevmInstance: FhevmInstance | null = null;
let isSDKInitialized = false;

/**
 * Initialize FHEVM instance
 * Local network (31337): Uses @fhevm/mock-utils + Hardhat plugin
 * Sepolia (11155111): Uses @zama-fhe/relayer-sdk
 */
export async function initializeFHEVM(chainId?: number): Promise<FhevmInstance> {
  if (!fhevmInstance) {
    // Check window.ethereum
    if (typeof window === "undefined" || !(window as any).ethereum) {
      throw new Error("window.ethereum is not available. Please install MetaMask.");
    }

    // Get chainId first
    let currentChainId = chainId;
    if (!currentChainId) {
      try {
        const chainIdHex = await (window as any).ethereum.request({ method: "eth_chainId" });
        currentChainId = parseInt(chainIdHex, 16);
      } catch (error) {
        console.error("[FHEVM] Failed to get chainId:", error);
        currentChainId = 31337;
      }
    }

    console.log("[FHEVM] Current chain ID:", currentChainId);

    // Initialize SDK for Sepolia (loads WASM)
    if (currentChainId === 11155111 && !isSDKInitialized) {
      console.log("[FHEVM] Initializing FHE SDK for Sepolia...");
      try {
        await initSDK();
        isSDKInitialized = true;
        console.log("[FHEVM] ✅ SDK initialized successfully");
      } catch (error: any) {
        console.error("[FHEVM] SDK initialization failed:", error);
        console.warn("[FHEVM] Continuing with createInstance...");
        isSDKInitialized = true; // Mark as attempted to avoid retry loop
      }
    }

    // Local network: Use Mock FHEVM
    if (currentChainId === 31337) {
      const localhostRpcUrl = "http://localhost:8545";
      
      try {
        console.log("[FHEVM] Fetching FHEVM metadata from Hardhat node...");
        const provider = new JsonRpcProvider(localhostRpcUrl);
        const metadata = await provider.send("fhevm_relayer_metadata", []);
        
        console.log("[FHEVM] Metadata:", metadata);
        
        if (metadata && metadata.ACLAddress && metadata.InputVerifierAddress && metadata.KMSVerifierAddress) {
          // Use @fhevm/mock-utils to create mock instance
          if (!MockFhevmInstance || !userDecryptHandleBytes32) {
            const mockUtils = await import("@fhevm/mock-utils");
            MockFhevmInstance = mockUtils.MockFhevmInstance;
            userDecryptHandleBytes32 = mockUtils.userDecryptHandleBytes32;
            console.log("[FHEVM] ✅ Loaded mock-utils");
          }
          
          const mockInstance = await MockFhevmInstance.create(provider, provider, {
            aclContractAddress: metadata.ACLAddress,
            chainId: 31337,
            gatewayChainId: 55815,
            inputVerifierContractAddress: metadata.InputVerifierAddress,
            kmsContractAddress: metadata.KMSVerifierAddress,
            verifyingContractAddressDecryption: "0x5ffdaAB0373E62E2ea2944776209aEf29E631A64",
            verifyingContractAddressInputVerification: "0x812b06e1CDCE800494b79fFE4f925A504a9A9810",
          });
          
          fhevmInstance = mockInstance;
          console.log("[FHEVM] Mock FHEVM instance created successfully!");
          return mockInstance;
        } else {
          throw new Error("FHEVM metadata is incomplete");
        }
      } catch (error: any) {
        console.error("[FHEVM] Failed to create Mock instance:", error);
        throw new Error(
          `Local Hardhat node FHEVM initialization failed: ${error.message}\n\n` +
          `Please ensure:\n` +
          `1. Hardhat node is running (npx hardhat node)\n` +
          `2. @fhevm/hardhat-plugin is imported in hardhat.config.ts\n` +
          `3. Restart Hardhat node and retry`
        );
      }
    }
    
    // Sepolia network: Use official SDK
    else if (currentChainId === 11155111) {
      try {
        console.log("[FHEVM] Creating Sepolia FHEVM instance...");
        
        if (typeof window === "undefined" || !(window as any).ethereum) {
          throw new Error("MetaMask not detected. Please install MetaMask to use Sepolia network.");
        }
        
        const config = {
          ...SepoliaConfig,
          network: (window as any).ethereum,
        };
        
        fhevmInstance = await createInstance(config);
        console.log("[FHEVM] ✅ Sepolia FHEVM instance created successfully!");
      } catch (error: any) {
        console.error("[FHEVM] ❌ Sepolia instance creation failed:", error);
        throw new Error(
          `Failed to create Sepolia FHEVM instance: ${error.message || "Unknown error"}`
        );
      }
    }
    
    else {
      throw new Error(`Unsupported network (Chain ID: ${currentChainId}). Please switch to local network (31337) or Sepolia (11155111).`);
    }
  }
  
  return fhevmInstance;
}

/**
 * Get or initialize FHEVM instance
 */
export async function getFHEVMInstance(chainId?: number): Promise<FhevmInstance> {
  return initializeFHEVM(chainId);
}

/**
 * Encrypt input data (message hash)
 */
export async function encryptInput(
  fhevm: FhevmInstance,
  contractAddress: string,
  userAddress: string,
  messageHash: number
): Promise<EncryptedInput> {
  try {
    const encryptedInput = fhevm
      .createEncryptedInput(contractAddress, userAddress)
      .add32(messageHash);
    
    const encrypted = await encryptedInput.encrypt();
    
    // Convert to format required by contract
    const handles = encrypted.handles.map(handle => {
      const hexHandle = ethers.hexlify(handle);
      if (hexHandle.length < 66) {
        const padded = hexHandle.slice(2).padStart(64, '0');
        return `0x${padded}`;
      }
      if (hexHandle.length > 66) {
        return hexHandle.slice(0, 66);
      }
      return hexHandle;
    });
    
    return {
      handles,
      inputProof: ethers.hexlify(encrypted.inputProof),
    };
  } catch (error: any) {
    console.error("[FHEVM] Encryption failed:", error);
    throw new Error(`Encryption failed: ${error.message || "Unknown error"}`);
  }
}

/**
 * Batch decrypt multiple handles using Zama standard flow
 */
export async function batchDecrypt(
  fhevm: FhevmInstance,
  handles: { handle: string; contractAddress: string }[],
  userAddress: string,
  signer: any,
  chainId?: number
): Promise<Record<string, number>> {
  console.log("[FHEVM] 🔓 Batch decrypting", handles.length, "handles...");
  console.log("[FHEVM] Input handles:", handles.map(h => ({ handle: h.handle, length: h.handle?.length, contractAddress: h.contractAddress })));
  
  if (handles.length === 0) {
    return {};
  }
  
  // Filter out invalid handles with STRICT validation
  const validHandles = handles.filter(h => {
    const handleStr = String(h.handle);
    const isValid = handleStr && 
                   handleStr !== "0x" && 
                   handleStr.length === 66 &&
                   handleStr !== "0x0000000000000000000000000000000000000000000000000000000000000000" &&
                   /^0x[0-9a-fA-F]{64}$/.test(handleStr);
    
    if (!isValid) {
      console.error("[FHEVM] ❌ Rejecting invalid handle:", {
        original: h.handle,
        asString: handleStr,
        length: handleStr.length,
        reason: handleStr === "0x" ? "Empty (0x)" : 
                handleStr.length !== 66 ? `Wrong length (${handleStr.length} != 66)` :
                handleStr === "0x0000000000000000000000000000000000000000000000000000000000000000" ? "All zeros" :
                "Invalid format"
      });
    }
    
    return isValid;
  });
  
  if (validHandles.length === 0) {
    console.error("[FHEVM] ❌ NO VALID HANDLES AFTER FILTERING!");
    return {};
  }
  
  console.log("[FHEVM] ✅ Valid handles:", validHandles.length);
  
  try {
    const isLocalNetwork = chainId === 31337;
    const isSepoliaNetwork = chainId === 11155111;
    
    if (isLocalNetwork) {
      if (!userDecryptHandleBytes32) {
        const mockUtils = await import("@fhevm/mock-utils");
        userDecryptHandleBytes32 = mockUtils.userDecryptHandleBytes32;
      }
      
      const provider = new JsonRpcProvider("http://localhost:8545");
      const decrypted: Record<string, number> = {};
      
      for (const h of validHandles) {
        try {
          const value = await userDecryptHandleBytes32(
            provider,
            signer,
            h.contractAddress,
            h.handle,
            userAddress
          );
          decrypted[h.handle] = Number(value);
        } catch (error: any) {
          console.error(`[FHEVM] Failed to decrypt ${h.handle}:`, error.message);
        }
      }
      
      return decrypted;
    } else if (isSepoliaNetwork) {
      console.log("[FHEVM] Using userDecrypt (Sepolia network)");
      console.log("[FHEVM] Valid handles for decryption:", validHandles.map(h => ({
        handle: h.handle,
        contractAddress: h.contractAddress
      })));
      
      // Generate keypair
      const keypair = fhevm.generateKeypair();
      console.log("[FHEVM] ✅ Generated keypair");
      
      // Prepare handle-contract pairs
      const handleContractPairs = validHandles.map(h => ({
        handle: h.handle,
        contractAddress: h.contractAddress,
      }));
      
      // Get unique contract addresses
      const contractAddresses = [...new Set(validHandles.map(h => h.contractAddress))];
      console.log("[FHEVM] Contract addresses:", contractAddresses);
      
      // Create EIP712 typed data
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = "10";
      
      console.log("[FHEVM] Creating EIP712 typed data...");
      const eip712 = fhevm.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimeStamp,
        durationDays
      );
      
      console.log("[FHEVM] 🔑 Requesting signature...");
      console.log("[FHEVM] EIP712 domain:", eip712.domain);
      console.log("[FHEVM] EIP712 message:", eip712.message);
      
      // Request signature from user
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );
      
      console.log("[FHEVM] ✅ Got signature, decrypting...");
      console.log("[FHEVM] Signature (without 0x):", signature.replace("0x", ""));
      console.log("[FHEVM] Calling userDecrypt with:", {
        handleContractPairs: handleContractPairs.length,
        contractAddresses: contractAddresses.length,
        userAddress,
        startTimeStamp,
        durationDays
      });
      
      // Decrypt with user's signature
      const result = await fhevm.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace("0x", ""),
        contractAddresses,
        userAddress,
        startTimeStamp,
        durationDays
      );
      
      console.log("[FHEVM] ✅ Batch decryption complete!");
      console.log("[FHEVM] Decryption result:", result);
      
      // Convert to numbers
      const decrypted: Record<string, number> = {};
      for (const h of validHandles) {
        if (result[h.handle] !== undefined) {
          decrypted[h.handle] = Number(result[h.handle]);
          console.log(`[FHEVM] Decrypted handle ${h.handle.slice(0, 20)}...: ${result[h.handle]}`);
        } else {
          console.warn(`[FHEVM] No result for handle ${h.handle.slice(0, 20)}...`);
        }
      }
      
      return decrypted;
    } else {
      throw new Error(`Unsupported network for decryption. ChainId: ${chainId}`);
    }
  } catch (error: any) {
    console.error("[FHEVM] Batch decrypt failed:", error);
    throw error;
  }
}

/**
 * Decrypt euint32 value (single value)
 */
export async function decryptEuint32(
  fhevm: FhevmInstance,
  handle: string,
  contractAddress: string,
  userAddress: string,
  signer: any,
  chainId?: number
): Promise<number> {
  // Use batch decrypt for single value
  const results = await batchDecrypt(
    fhevm,
    [{ handle, contractAddress }],
    userAddress,
    signer,
    chainId
  );
  
  return results[handle] || 0;
}

/**
 * Reset FHEVM instance (for network switching)
 */
export function resetFHEVMInstance() {
  fhevmInstance = null;
  console.log("[FHEVM] Instance reset");
}

