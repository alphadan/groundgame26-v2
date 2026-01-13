// src/hooks/useAdminCRUD.ts
import { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  DocumentData,
  QueryConstraint,
  OrderByDirection,
  WhereFilterOp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export function useAdminCRUD<T extends DocumentData>(options: {
  collectionName: string;
  defaultOrderBy?: string;
  orderDirection?: OrderByDirection;
}) {
  const {
    collectionName,
    defaultOrderBy = "updated_at",
    orderDirection = "desc",
  } = options;
  const { user } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Normalizes Firestore Timestamps to Unix Numbers
  const normalize = (val: any): number => {
    if (!val) return Date.now();
    if (typeof val === "number") return val;
    if (val.seconds) return val.seconds * 1000; // Handle Firestore Timestamp object
    return new Date(val).getTime() || Date.now();
  };

  const mapDocs = useCallback((snapshot: any): T[] => {
    return snapshot.docs.map((doc: any) => {
      const docData = doc.data();
      return {
        ...docData,
        id: doc.id,
        uid: docData.uid || doc.id,
        // Ensure consistency for IndexedDB
        created_at: normalize(docData.created_at),
        updated_at: normalize(docData.updated_at),
      } as T;
    });
  }, []);

  const fetchAll = useCallback(
    async (filters: Record<string, any> = {}) => {
      setLoading(true);
      try {
        const constraints: QueryConstraint[] = [];
        Object.entries(filters).forEach(([field, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            constraints.push(where(field, "==", value));
          }
        });
        constraints.push(orderBy(defaultOrderBy, orderDirection));
        const q = query(collection(db, collectionName), ...constraints);
        const snapshot = await getDocs(q);
        setData(mapDocs(snapshot));
      } catch (err: any) {
        console.error(`[useAdminCRUD] Error:`, err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [collectionName, defaultOrderBy, orderDirection, mapDocs]
  );

  const create = useCallback(
    async (item: any) => {
      const docId =
        item.id || item.uid || doc(collection(db, collectionName)).id;
      const now = Date.now(); // Use Unix Number
      const payload = {
        ...item,
        id: docId,
        created_at: now,
        updated_at: now,
        created_by: user?.uid || "system",
      };
      await setDoc(doc(db, collectionName, docId), payload);
      await fetchAll();
      return docId;
    },
    [collectionName, user?.uid, fetchAll]
  );

  const update = useCallback(
    async (id: string, updates: any) => {
      await updateDoc(doc(db, collectionName, id), {
        ...updates,
        updated_at: Date.now(), // Use Unix Number
      });
      await fetchAll();
    },
    [collectionName, fetchAll]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteDoc(doc(db, collectionName, id));
      await fetchAll();
    },
    [collectionName, fetchAll]
  );

  const search = useCallback(
    async (field: string, op: WhereFilterOp, value: any) => {
      if (!value) return fetchAll();

      setLoading(true);
      setError(null);
      try {
        const q = query(
          collection(db, collectionName),
          where(field, op, value)
        );
        const snapshot = await getDocs(q);
        setData(mapDocs(snapshot));
      } catch (err: any) {
        console.error(`[useAdminCRUD] Search failed:`, err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [collectionName, fetchAll, mapDocs]
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { data, loading, error, fetchAll, search, create, update, remove };
}
