// src/context/FirestoreReadyProvider.tsx
import React, { useEffect } from "react";
import { getAuth } from "firebase/auth";

const FirestoreReadyProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      user
        .getIdToken()
        .then(() => {
          console.log(
            "Global token attached — Firestore ready for all queries"
          );
        })
        .catch((err) => {
          console.error("Global token attach failed:", err);
        });
    }
  }, []);

  return <>{children}</>;
};

export default FirestoreReadyProvider;
