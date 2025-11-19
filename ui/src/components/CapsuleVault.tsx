import { Clock, Unlock, Lock, Eye } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { useFhevm } from "@/hooks/useFhevm";
import { TimeCapsuleABI } from "@/abi/TimeCapsuleABI";
import { TimeCapsuleAddresses } from "@/abi/TimeCapsuleAddresses";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ethers } from "ethers";

interface CapsuleData {
  id: number;
  unlockTimestamp: bigint;
  creator: string;
  exists: boolean;
  encryptedMessagePart1: string;
  encryptedMessagePart2: string;
  decryptedHash?: number;
  message?: string; // Store decrypted message separately
}

export const CapsuleVault = () => {
  const chainId = useChainId();
  const { address } = useAccount();
  const effectiveChainId = chainId ?? 31337;
  
  const contractInfo = useMemo(
    () => TimeCapsuleAddresses[effectiveChainId.toString()],
    [effectiveChainId]
  );
  const contractAddress = contractInfo?.address;
  const deployed = contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000";

  const fhe = useFhevm(chainId);
  const [capsules, setCapsules] = useState<CapsuleData[]>([]);
  const [selectedCapsule, setSelectedCapsule] = useState<CapsuleData | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // Get user's capsule IDs
  const { data: userCapsuleIds } = useReadContract({
    address: deployed ? (contractAddress as `0x${string}`) : undefined,
    abi: TimeCapsuleABI.abi,
    functionName: "getUserCapsules",
    args: address ? [address] : undefined,
    query: {
      enabled: !!deployed && !!address,
    },
  });

  // Load capsules data
  const loadCapsules = useCallback(async () => {
    if (!deployed || !contractAddress || !address || !userCapsuleIds || !fhe.isReady) {
      setCapsules([]);
      return;
    }

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const contract = new ethers.Contract(
        contractAddress,
        TimeCapsuleABI.abi,
        provider
      );

      const capsulePromises = (userCapsuleIds as bigint[]).map(async (id) => {
        const capsule = await contract.getCapsule(id);
        
        // Format handles to bytes32 (66 characters: 0x + 64 hex digits)
        const formatHandle = (handle: string): string => {
          if (handle && handle !== "0x") {
            const hexPart = handle.startsWith("0x") ? handle.slice(2) : handle;
            const padded = hexPart.padStart(64, "0");
            return `0x${padded}`;
          }
          return "0x0000000000000000000000000000000000000000000000000000000000000000";
        };
        
        return {
          id: Number(id),
          unlockTimestamp: capsule.unlockTimestamp,
          creator: capsule.creator,
          exists: capsule.exists,
          encryptedMessagePart1: formatHandle(String(capsule.encryptedMessagePart1)),
          encryptedMessagePart2: formatHandle(String(capsule.encryptedMessagePart2)),
        } as CapsuleData;
      });

      const loadedCapsules = await Promise.all(capsulePromises);
      setCapsules(loadedCapsules);
    } catch (error) {
      console.error("[CapsuleVault] Failed to load capsules:", error);
      setCapsules([]);
    }
  }, [deployed, contractAddress, address, userCapsuleIds, fhe.isReady]);

  useEffect(() => {
    loadCapsules();
  }, [loadCapsules]);

  useEffect(() => {
    const handleCapsuleCreated = () => {
      loadCapsules();
    };
    
    window.addEventListener("capsule-created", handleCapsuleCreated);
    return () => window.removeEventListener("capsule-created", handleCapsuleCreated);
  }, [loadCapsules]);

  const handleUnlock = async (capsule: CapsuleData) => {
    const now = Math.floor(Date.now() / 1000);
    const unlockTime = Number(capsule.unlockTimestamp);
    
    if (now < unlockTime) {
      toast.error("This capsule is still locked!");
      return;
    }

    if (!contractAddress || !address || !fhe.isReady) {
      toast.error("Cannot decrypt: FHEVM not ready");
      return;
    }

    try {
      setIsDecrypting(true);

      // Decrypt both encrypted message parts
      console.log("[CapsuleVault] Decrypting message parts...");
      const decryptedNum1 = await fhe.decrypt(
        capsule.encryptedMessagePart1,
        contractAddress,
        address,
        chainId
      );
      
      const decryptedNum2 = await fhe.decrypt(
        capsule.encryptedMessagePart2,
        contractAddress,
        address,
        chainId
      );

      // Decode both numbers back to message text
      const decodeNumber = (num: number): string => {
        const bytes: number[] = [];
        let n = num;
        
        // Extract bytes from the number (big-endian: most significant byte first)
        // We encoded as: (byte0 << 24) | (byte1 << 16) | (byte2 << 8) | byte3
        for (let i = 0; i < 4; i++) {
          bytes.unshift(n & 0xFF); // Insert at beginning to maintain order
          n = n >>> 8;
        }
        
        // Convert bytes to string, filtering out null bytes (padding)
        return bytes
          .filter(b => b !== 0) // Remove padding null bytes
          .map(b => {
            // Handle UTF-8 single-byte characters (0-127)
            if (b >= 32 && b <= 126) {
              return String.fromCharCode(b);
            } else if (b === 0) {
              return ''; // Skip null bytes
            } else {
              return String.fromCharCode(b); // Try to decode anyway
            }
          })
          .join('');
      };
      
      const messagePart1 = decodeNumber(decryptedNum1);
      const messagePart2 = decodeNumber(decryptedNum2);
      const decryptedMessage = messagePart1 + messagePart2;
      
      console.log("[CapsuleVault] Decryption result:", {
        decryptedNum1,
        decryptedNum2,
        messagePart1,
        messagePart2,
        decryptedMessage
      });

      // Display the decrypted message
      const updatedCapsule = {
        ...capsule,
        decryptedHash: decryptedNum1,
        message: decryptedMessage || `Decrypted values: ${decryptedNum1}, ${decryptedNum2}`,
      };

      setSelectedCapsule(updatedCapsule);
      toast.success("Time Capsule Unlocked! 🎉", {
        description: `Message: "${decryptedMessage}"`,
      });
    } catch (error: any) {
      console.error("[CapsuleVault] Decryption failed:", error);
      toast.error("Failed to decrypt capsule: " + (error?.message ?? String(error)));
    } finally {
      setIsDecrypting(false);
    }
  };

  return (
    <>
      <section id="vault" className="py-20 px-4 bg-secondary/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Your <span className="text-accent">Vault</span>
            </h2>
            <p className="text-muted-foreground text-lg">
              Encrypted time capsules waiting to be unlocked
            </p>
          </div>

          {!address ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                Connect your wallet to view your time capsules
              </p>
            </div>
          ) : !deployed ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                Contract not deployed. Please deploy the TimeCapsule contract first.
              </p>
            </div>
          ) : capsules.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                No time capsules yet. Create your first one above!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {capsules.map((capsule) => (
                <CapsuleCard
                  key={capsule.id}
                  capsule={capsule}
                  onUnlock={handleUnlock}
                  isDecrypting={isDecrypting}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <Dialog open={!!selectedCapsule} onOpenChange={() => setSelectedCapsule(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Time Capsule Unlocked! 🎉</DialogTitle>
            <DialogDescription>
              Created by {selectedCapsule?.creator && `${selectedCapsule.creator.slice(0, 6)}...${selectedCapsule.creator.slice(-4)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 p-6 bg-secondary/30 rounded-lg">
            <p className="text-foreground whitespace-pre-wrap">
              {selectedCapsule?.message || "Decryption successful!"}
            </p>
            {selectedCapsule?.decryptedHash && (
              <p className="text-sm text-muted-foreground mt-2">
                Decrypted Hash: {selectedCapsule.decryptedHash}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

interface CapsuleCardProps {
  capsule: CapsuleData;
  onUnlock: (capsule: CapsuleData) => void;
  isDecrypting: boolean;
}

const CapsuleCard = ({ capsule, onUnlock, isDecrypting }: CapsuleCardProps) => {
  const [timeLeft, setTimeLeft] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      const unlockTime = Number(capsule.unlockTimestamp);
      const difference = unlockTime - now;

      if (difference <= 0) {
        setIsUnlocked(true);
        return "Ready to unlock!";
      }

      const days = Math.floor(difference / (60 * 60 * 24));
      const hours = Math.floor((difference / (60 * 60)) % 24);
      const minutes = Math.floor((difference / 60) % 60);

      return `${days}d ${hours}h ${minutes}m`;
    };

    setTimeLeft(calculateTimeLeft());
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 60000);

    return () => clearInterval(interval);
  }, [capsule.unlockTimestamp]);

  const unlockDate = new Date(Number(capsule.unlockTimestamp) * 1000);

  return (
    <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-all hover:scale-105 group">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-2">
            {unlockDate.toLocaleDateString()}
          </p>
          <p className="text-foreground line-clamp-2">Capsule #{capsule.id}</p>
        </div>
        {isUnlocked ? (
          <Unlock className="w-5 h-5 text-primary" />
        ) : (
          <Lock className="w-5 h-5 text-accent animate-glow-pulse" />
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-accent" />
            <span className={`font-mono ${!isUnlocked ? "text-accent animate-countdown-glow" : "text-primary"}`}>
              {timeLeft}
            </span>
          </div>
          {isUnlocked && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onUnlock(capsule)}
              disabled={isDecrypting}
              className="h-8 hover:bg-primary/10"
            >
              <Eye className="w-4 h-4 mr-1" />
              {isDecrypting ? "Decrypting..." : "Unlock"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
