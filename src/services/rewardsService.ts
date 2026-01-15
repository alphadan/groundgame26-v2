import {
  getFirestore,
  collection,
  doc,
  runTransaction,
  getDocs,
  addDoc,
  query,
  orderBy,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { ireward, iredemption, RedemptionStatus, RewardStatus } from "../types";

const db = getFirestore();

/**
 * Processes a reward redemption using a Firestore Transaction.
 * This ensures the user has enough points and the reward is in stock
 * before the "purchase" goes through.
 */
export const redeemReward = async (userId: string, reward: ireward) => {
  const userRef = doc(db, "users", userId);
  const rewardRef = doc(db, "rewards", reward.id);
  const redemptionRef = doc(collection(db, "redemptions"));

  try {
    const now = Date.now();
    await runTransaction(db, async (transaction) => {
      // 1. Get user data
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists()) throw "User does not exist!";

      const userData = userDoc.data();
      const currentPoints = userData.points_balance || 0;

      // 2. Check points sufficiency
      if (currentPoints < reward.points_cost) {
        throw "Insufficient points balance.";
      }

      // 3. (Optional) Check stock if you're tracking it
      if (reward.stock_quantity !== undefined && reward.stock_quantity <= 0) {
        throw "Reward is out of stock.";
      }

      // 4. Create the redemption record
      const redemptionData: Omit<iredemption, "id"> = {
        user_id: userId,
        reward_id: reward.id,
        snapshot: {
          title: reward.title,
          points_paid: reward.points_cost,
        },
        status: RedemptionStatus.completed,
        redeemed_at: now,
      };

      transaction.set(redemptionRef, redemptionData);

      // 5. Update user points balance
      transaction.update(userRef, {
        points_balance: currentPoints - reward.points_cost,
      });

      // 6. Update reward stock (if applicable)
      if (reward.stock_quantity !== undefined) {
        transaction.update(rewardRef, {
          stock_quantity: reward.stock_quantity - 1,
        });
      }
    });

    return { success: true };
  } catch (e) {
    console.error("Redemption failed: ", e);
    return { success: false, error: e };
  }
};

export const getAllRewards = async (): Promise<ireward[]> => {
  try {
    const rewardsCol = collection(db, "rewards");
    const q = query(rewardsCol, orderBy("created_at", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ireward[];
  } catch (error) {
    console.error("Error fetching rewards:", error);
    throw error;
  }
};

/**
 * Adds a new reward to the catalog
 */
export const addReward = async (
  rewardData: Omit<ireward, "id" | "created_at" | "updated_at">
) => {
  const now = Date.now();
  try {
    const rewardsCol = collection(db, "rewards");
    return await addDoc(rewardsCol, {
      ...rewardData,
      created_at: now,
      updated_at: now,
    });
  } catch (error) {
    console.error("Error adding reward:", error);
    throw error;
  }
};

export const updateRewardStatus = async (
  rewardId: string,
  newStatus: RewardStatus
) => {
  const now = Date.now();
  const rewardRef = doc(db, "rewards", rewardId);
  return await updateDoc(rewardRef, {
    status: newStatus,
    updated_at: now,
  });
};

export const deleteReward = async (rewardId: string) => {
  const rewardRef = doc(db, "rewards", rewardId);
  return await deleteDoc(rewardRef);
};
