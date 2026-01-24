import { db } from "../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

/**
 * Updates the user's preference in Firestore.
 * A background Cloud Function should watch this path to
 * actually sync the FCM token with the Topic.
 */
export const updateTopicPreference = async (
  uid: string,
  topicId: string,
  isSubscribed: boolean,
) => {
  const userRef = doc(db, "users", uid);
  return updateDoc(userRef, {
    [`notification_preferences.${topicId}`]: isSubscribed,
    [`notification_preferences.last_updated`]: new Date().toISOString(),
  });
};
