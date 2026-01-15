// src/services/badgeService.ts
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { ibadge } from "../types";

const db = getFirestore();

const badgeCol = collection(db, "badges");

export const getAllBadges = async (): Promise<ibadge[]> => {
  const snapshot = await getDocs(badgeCol);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as ibadge[];
};

export const addBadge = (data: Omit<ibadge, "id" | "created_at">) =>
  addDoc(badgeCol, { ...data, created_at: Date.now() });

export const updateBadge = async (id: string, data: Partial<ibadge>) => {
  const badgeRef = doc(db, "badges", id);
  return await updateDoc(badgeRef, { ...data, updated_at: Date.now() });
};

export const deleteBadge = async (id: string) => {
  return await deleteDoc(doc(db, "badges", id));
};

export const awardBadgeToUser = async (user: any, badge: any) => {
  const achievementData = {
    user_id: user.id || user.uid,
    user_name: user.display_name || user.email || "Unknown User",
    user_email: user.email,
    badge_id: badge.id,
    badge_title: badge.title,
    badge_unicode: badge.unicode,
    badge_sponsor: badge.sponsor || "None",
    earned_at: Date.now(),
  };
  return await addDoc(collection(db, "user_badges"), achievementData);
};

export const awardBadgeToUserScalable = async (user: any, badge: ibadge) => {
  try {
    const achievementCol = collection(db, "user_badges");

    // Create the "Flattened" record
    const achievementData = {
      user_id: user.uid,
      user_name: user.displayName || "Unknown User",
      user_email: user.email,

      badge_id: badge.id,
      badge_title: badge.title,
      badge_unicode: badge.unicode,
      badge_sponsor: badge.sponsor || "None",

      earned_at: Date.now(), // Use serverTimestamp() for high-precision global sync
    };

    return await addDoc(achievementCol, achievementData);
  } catch (error) {
    console.error("Scalable award failed:", error);
    throw error;
  }
};

export const subscribeToUserBadges = (
  userId: string,
  callback: (badges: any[]) => void
) => {
  const q = query(
    collection(db, "user_badges"),
    where("user_id", "==", userId)
  );

  return onSnapshot(q, (snapshot) => {
    const badges = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(badges);
  });
};
