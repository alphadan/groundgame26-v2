import { db, recordEvent } from "../lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { Voter } from "../types";

const MS_PER_DAY = 86400000;
const SUPPRESSION_WINDOW = 30 * MS_PER_DAY;

/**
 * Service to handle the "Write" logic for voter interactions.
 * This keeps the VoterListPage clean and avoids import errors.
 */
export const logVoterContact = async (
  voter: Voter,
  type: string,
  volunteerUid: string,
) => {
  const now = Date.now();
  const expiry = now + SUPPRESSION_WINDOW;
  const interactionId = `${voter.voter_id}_contact`;

  const docRef = doc(collection(db, "voter_interactions"), interactionId);

  // 1. Database Write
  await setDoc(docRef, {
    voter_id: String(voter.voter_id),
    volunteer_uid: volunteerUid,
    interaction_type: type,
    timestamp: now,
    expires_at: expiry,
    precinct: String(voter.precinct || "unknown"),
  });

  // 2. Analytics
  recordEvent("voter_contact_initiated", {
    type,
    voter_id: voter.voter_id,
    voter_name: voter.full_name,
  });
};
