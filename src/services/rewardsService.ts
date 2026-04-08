import {
  doc,
  updateDoc,
  increment,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../lib/firebase";
import { ireward } from "../types";

export type RewardAction = "sms" | "email" | "walk" | "survey" | "admin_adj";

export interface RedemptionResult {
  success: boolean;
  newBalance?: number;
  error?: string;
}

/**
 * ATOMIC POINTS AWARDS
 */
export const awardPoints = async (
  uid: string,
  action: RewardAction,
  amount: number = 1,
) => {
  if (!uid) return;
  const userRef = doc(db, "users", uid);
  try {
    await updateDoc(userRef, {
      points_balance: increment(amount),
    });
  } catch (err) {
    console.error("awardPoints Error:", err);
    throw err;
  }
};

/**
 * REWARDS CATALOG MANAGEMENT
 */
export const getAllRewards = async (): Promise<ireward[]> => {
  const colRef = collection(db, "rewards");
  const q = query(colRef, orderBy("points_cost", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ireward);
};

export const addReward = async (rewardData: any) => {
  return await addDoc(collection(db, "rewards"), {
    ...rewardData,
    created_at: Date.now(),
    updated_at: Date.now(),
  });
};

export const updateReward = async (id: string, updates: any) => {
  await updateDoc(doc(db, "rewards", id), {
    ...updates,
    updated_at: Date.now(),
  });
};

export const deleteReward = async (id: string) => {
  await deleteDoc(doc(db, "rewards", id));
};

/**
 * REDEMPTION FLOW (SECURE VERSION)
 * Calls the 'redeemRewardCloud' function in index.js to handle the transaction.
 */
export const redeemReward = async (
  uid: string,
  reward: ireward,
  shippingAddress?: string,
): Promise<RedemptionResult> => {
  const redeemCall = httpsCallable(functions, "redeemRewardCloud");

  try {
    const result = await redeemCall({
      rewardId: reward.id,
      shippingAddress: shippingAddress,
    });

    return result.data as RedemptionResult;
  } catch (err: any) {
    console.error("Redemption Service Error:", err);
    return {
      success: false,
      error: err.message || "An unexpected error occurred.",
    };
  }
};

export const getAllRedemptions = async () => {
  const q = query(collection(db, "redemptions"), orderBy("redeemedAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const updateRedemptionStatus = async (id: string, status: string) => {
  await updateDoc(doc(db, "redemptions", id), {
    status,
    updated_at: serverTimestamp(),
  });
};
