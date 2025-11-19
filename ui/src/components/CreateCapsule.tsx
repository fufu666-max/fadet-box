import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Lock, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import { useFhevm } from "@/hooks/useFhevm";
import { TimeCapsuleABI } from "@/abi/TimeCapsuleABI";
import { TimeCapsuleAddresses } from "@/abi/TimeCapsuleAddresses";
import { ethers } from "ethers";

export const CreateCapsule = () => {
  const [message, setMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  const chainId = useChainId();
  const { address } = useAccount();
  const effectiveChainId = chainId ?? 31337;
  
  // Calculate minimum date (1 minute from now) and default date (5 minutes from now)
  const minDate = useMemo(() => {
    const min = new Date(Date.now() + 60 * 1000);
    return min.toISOString().slice(0, 16);
  }, []);
  
  const defaultDate = useMemo(() => {
    const defaultTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
    return defaultTime.toISOString().slice(0, 16);
  }, []);
  
  // Initialize unlockDate with defaultDate using a function to ensure it's calculated
  const [unlockDate, setUnlockDate] = useState(() => {
    const defaultTime = new Date(Date.now() + 5 * 60 * 1000);
    return defaultTime.toISOString().slice(0, 16);
  });
  
  const contractInfo = useMemo(
    () => TimeCapsuleAddresses[effectiveChainId.toString()],
    [effectiveChainId]
  );
  const contractAddress = contractInfo?.address;
  const deployed = contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000";

  const write = useWriteContract();
  const fhe = useFhevm(chainId);

  const canCreate = useMemo(() => {
    const hasMessage = message.trim().length > 0;
    // unlockDate should always have a value (initialized with defaultDate)
    const hasUnlockDate = unlockDate && unlockDate.length > 0;
    
    // Parse datetime-local value correctly
    // datetime-local format: "YYYY-MM-DDTHH:mm" (local time, no timezone)
    let isFuture = false;
    const dateToCheck = unlockDate;
    if (dateToCheck) {
      try {
        // Parse the datetime-local string as local time
        // Format: "YYYY-MM-DDTHH:mm"
        const [datePart, timePart] = dateToCheck.split('T');
        if (datePart && timePart) {
          const [year, month, day] = datePart.split('-').map(Number);
          const [hours, minutes] = timePart.split(':').map(Number);
          
          // Create date in local timezone
          const unlockDateTime = new Date(year, month - 1, day, hours, minutes);
          const now = new Date();
          
          // Add a small buffer (1 minute) to account for any timing issues
          const buffer = 60 * 1000; // 1 minute in milliseconds
          isFuture = unlockDateTime.getTime() > (now.getTime() + buffer);
          
          // Debug date comparison
          console.log("[CreateCapsule] Date check:", {
            dateToCheck,
            parsed: {
              year, month, day, hours, minutes
            },
            unlockDateTime: unlockDateTime.toLocaleString(),
            unlockTimestamp: unlockDateTime.getTime(),
            now: now.toLocaleString(),
            nowTimestamp: now.getTime(),
            differenceMs: unlockDateTime.getTime() - now.getTime(),
            differenceMinutes: Math.round((unlockDateTime.getTime() - now.getTime()) / (60 * 1000)),
            isFuture,
          });
        } else {
          console.error("[CreateCapsule] Invalid date format:", dateToCheck);
        }
      } catch (error) {
        console.error("[CreateCapsule] Error parsing date:", error, dateToCheck);
        isFuture = false;
      }
    }
    
    const chainOk = chainId === 31337 || chainId === 11155111;
    
    // Check if FHEVM is ready (instance exists and not loading)
    const fheReady = fhe.instance !== null && !fhe.loading;
    const result = deployed && address && chainOk && fheReady && hasMessage && hasUnlockDate && isFuture && !isCreating;
    
    // Debug logging
    if (!result) {
      console.log("[CreateCapsule] Button disabled:", {
        deployed,
        hasAddress: !!address,
        chainId,
        chainOk,
        fheInstance: !!fhe.instance,
        fheIsReady: fhe.isReady,
        fheReady,
        fheLoading: fhe.loading,
        fheError: fhe.error?.message,
        hasMessage,
        hasUnlockDate,
        isFuture,
        isCreating,
      });
    }
    
    return result;
  }, [deployed, address, chainId, fhe.instance, fhe.isReady, fhe.loading, fhe.error, message, unlockDate, defaultDate, isCreating]);

  const handleCreate = async () => {
    if (!canCreate || !contractAddress || !address) return;

    try {
      setIsCreating(true);

      // Encode message to two numbers for FHE encryption (up to 8 characters)
      // Convert message UTF-8 bytes to two uint32 numbers
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
      
      console.log("[CreateCapsule] Encoding message to numbers:", {
        message,
        messageBytes: Array.from(messageBytes),
        messageNum1,
        messageNum2,
        messageLength: messageBytes.length
      });

      console.log("[CreateCapsule] Encrypting message parts...");
      const encrypted1 = await fhe.encrypt(contractAddress as `0x${string}`, address as `0x${string}`, messageNum1);
      const encrypted2 = await fhe.encrypt(contractAddress as `0x${string}`, address as `0x${string}`, messageNum2);

      console.log("[CreateCapsule] Encryption complete, submitting transaction...");
      const handlePart1 = encrypted1.handles[0] as `0x${string}`;
      const proofPart1 = encrypted1.inputProof as `0x${string}`;
      const handlePart2 = encrypted2.handles[0] as `0x${string}`;
      const proofPart2 = encrypted2.inputProof as `0x${string}`;

      // Convert unlock date to Unix timestamp
      // Parse the date correctly
      const [datePart, timePart] = unlockDate.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);
      const unlockDateTime = new Date(year, month - 1, day, hours, minutes);
      const unlockTimestamp = Math.floor(unlockDateTime.getTime() / 1000);

      await write.writeContractAsync({
        abi: TimeCapsuleABI.abi,
        address: contractAddress as `0x${string}`,
        functionName: "createCapsule",
        args: [
          handlePart1,
          proofPart1,
          handlePart2,
          proofPart2,
          BigInt(unlockTimestamp),
        ],
      });

      toast.success("Time capsule created and encrypted!", {
        description: `Will unlock on ${new Date(unlockDate).toLocaleDateString()}`,
      });

      setMessage("");
      setUnlockDate("");

      // Trigger a custom event to refresh the vault
      window.dispatchEvent(new Event("capsule-created"));
    } catch (e: any) {
      console.error("[CreateCapsule] Creation failed:", e);
      toast.error("Failed to create capsule: " + (e?.message ?? String(e)));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section id="create" className="py-20 px-4">
      <div className="container mx-auto max-w-2xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Create Your <span className="text-primary">Time Capsule</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Encrypt your message and set when it should be revealed
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
          <div className="space-y-6">
            <div>
              <Label htmlFor="message" className="text-lg mb-2 block">
                Your Secret Message
              </Label>
              <Textarea
                id="message"
                placeholder="Write your message to the future..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[200px] text-base bg-background border-border focus:border-primary resize-none"
              />
            </div>

            <div>
              <Label htmlFor="unlock-date" className="text-lg mb-2 block flex items-center gap-2">
                <Calendar className="w-5 h-5 text-accent" />
                Unlock Date
              </Label>
              <Input
                id="unlock-date"
                type="datetime-local"
                value={unlockDate}
                onChange={(e) => {
                  const value = e.target.value;
                  // If user clears the input, use defaultDate
                  setUnlockDate(value || defaultDate);
                }}
                className="text-base bg-background border-border focus:border-primary"
                min={minDate}
                placeholder={defaultDate}
              />
              <p className="text-sm text-muted-foreground mt-2">
                Select a future date and time when the capsule should be unlocked. Minimum: 1 minute from now.
              </p>
            </div>

            <Button
              onClick={handleCreate}
              disabled={!canCreate || fhe.loading}
              className="w-full py-6 text-lg font-semibold bg-primary hover:bg-primary/90 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Lock className="w-5 h-5" />
              {fhe.loading ? "Initializing FHE..." : isCreating ? "Creating..." : "Encrypt & Lock"}
            </Button>

            {!canCreate && (
              <div className="text-xs text-muted-foreground space-y-1 p-4 bg-muted/50 rounded-lg">
                <p className="font-semibold mb-2">Button is disabled. Please check:</p>
                {!address && <p className="text-destructive">❌ Please connect your wallet</p>}
                {address && chainId && chainId !== 31337 && chainId !== 11155111 && (
                  <p className="text-destructive">❌ Please switch to local Hardhat network (31337) or Sepolia (11155111). Current: {chainId}</p>
                )}
                {address && (chainId === 31337 || chainId === 11155111) && fhe.loading && (
                  <p className="text-yellow-600">⏳ Initializing FHEVM... Please wait</p>
                )}
                {address && (chainId === 31337 || chainId === 11155111) && !fhe.instance && !fhe.loading && fhe.error && (
                  <p className="text-destructive">❌ FHEVM Error: {fhe.error.message}</p>
                )}
                {address && (chainId === 31337 || chainId === 11155111) && !fhe.instance && !fhe.loading && !fhe.error && (
                  <p className="text-destructive">❌ FHEVM not ready. Check console for details.</p>
                )}
                {address && (chainId === 31337 || chainId === 11155111) && fhe.instance && !fhe.isReady && (
                  <p className="text-yellow-600">⏳ FHEVM instance created, finalizing...</p>
                )}
                {address && (chainId === 31337 || chainId === 11155111) && fhe.isReady && !deployed && (
                  <p className="text-destructive">❌ Contract not deployed. Address: {contractAddress || "Not set"}</p>
                )}
                {address && message.trim().length === 0 && <p className="text-destructive">❌ Please enter a message</p>}
                {address && (!unlockDate || unlockDate.length === 0) && (
                  <p className="text-destructive">❌ Please select an unlock date</p>
                )}
                {address && unlockDate && (() => {
                  try {
                    const [datePart, timePart] = unlockDate.split('T');
                    if (datePart && timePart) {
                      const [year, month, day] = datePart.split('-').map(Number);
                      const [hours, minutes] = timePart.split(':').map(Number);
                      const unlockDateTime = new Date(year, month - 1, day, hours, minutes);
                      const now = new Date();
                      const buffer = 60 * 1000; // 1 minute buffer
                      const isFuture = unlockDateTime.getTime() > (now.getTime() + buffer);
                      
                      if (!isFuture) {
                        const diffMs = now.getTime() + buffer - unlockDateTime.getTime();
                        const diffMinutes = Math.ceil(diffMs / (60 * 1000));
                        if (diffMinutes > 0 && diffMinutes < 1000000) { // Sanity check
                          return (
                            <p className="text-destructive">
                              ❌ Unlock date must be at least 1 minute in the future. 
                              Please select a time at least {diffMinutes + 1} minute(s) later.
                            </p>
                          );
                        } else {
                          return (
                            <p className="text-destructive">
                              ❌ Unlock date must be at least 1 minute in the future.
                            </p>
                          );
                        }
                      }
                    }
                  } catch (error) {
                    return (
                      <p className="text-destructive">
                        ❌ Invalid date format. Please select a valid date and time.
                      </p>
                    );
                  }
                  return null;
                })()}
                {isCreating && <p className="text-yellow-600">⏳ Creating capsule...</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
