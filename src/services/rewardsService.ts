import {
  doc,
  updateDoc,
  increment,
  arrayUnion,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { ireward } from "../types";

export type RewardAction = "sms" | "email" | "walk" | "survey" | "admin_adj";

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
      points_history: arrayUnion({
        action,
        amount,
        timestamp: Date.now(),
      }),
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
  const colRef = collection(db, "rewards_catalog");
  const q = query(colRef, orderBy("points_cost", "asc")); // Updated to points_cost
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ireward);
};

// Fixed to handle the Omit type mismatch by spreading and adding default timestamps
export const addReward = async (rewardData: any) => {
  return await addDoc(collection(db, "rewards_catalog"), {
    ...rewardData,
    created_at: Date.now(),
    updated_at: Date.now(),
  });
};

export const updateReward = async (id: string, updates: any) => {
  await updateDoc(doc(db, "rewards_catalog", id), {
    ...updates,
    updated_at: Date.now(),
  });
};

export const deleteReward = async (id: string) => {
  await deleteDoc(doc(db, "rewards_catalog", id));
};

/**
 * REDEMPTION FLOW
 * Updated to return a result object { success: boolean, error?: string }
 */
export const redeemReward = async (uid: string, reward: ireward) => {
  try {
    // 1. Create the pending redemption record
    await addDoc(collection(db, "redemptions"), {
      userId: uid,
      rewardId: reward.id,
      rewardTitle: reward.title,
      points_cost: reward.points_cost, // Updated to points_cost
      status: "pending",
      redeemedAt: serverTimestamp(),
    });

    // 2. Deduct points from user balance
    await updateDoc(doc(db, "users", uid), {
      points_balance: increment(-reward.points_cost), // Updated to points_cost
    });

    return { success: true };
  } catch (err: any) {
    console.error("Redemption Service Error:", err);
    return { success: false, error: err.message };
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
