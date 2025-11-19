import { TimeCapsule } from "@/types/capsule";

const STORAGE_KEY = "time_capsules";

export const saveCapsule = (capsule: TimeCapsule): void => {
  const capsules = getCapsules();
  capsules.push(capsule);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(capsules));
};

export const getCapsules = (): TimeCapsule[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const getCapsulesByWallet = (walletAddress: string): TimeCapsule[] => {
  return getCapsules().filter(
    (capsule) => capsule.walletAddress.toLowerCase() === walletAddress.toLowerCase()
  );
};

export const deleteCapsule = (id: string): void => {
  const capsules = getCapsules().filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(capsules));
};
