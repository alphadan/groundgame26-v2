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
  serverTimestamp,
  DocumentData,
  QueryConstraint,
  OrderByDirection,
  WhereFilterOp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

interface UseAdminCRUDOptions {
  collectionName: string;
  defaultOrderBy?: string;
  orderDirection?: OrderByDirection;
}

/**
 * A production-ready CRUD hook for Firestore Admin activities.
 * Standardizes 'id' field for MUI DataGrid compatibility.
 */
export function useAdminCRUD<T extends DocumentData>(
  options: UseAdminCRUDOptions
) {
  const {
    collectionName,
    defaultOrderBy = "created_at",
    orderDirection = "asc",
  } = options;
  const { user } = useAuth();

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to map Firestore docs to our local type with guaranteed ID
  const mapDocs = useCallback((snapshot: any): T[] => {
    return snapshot.docs.map((doc: any) => {
      const docData = doc.data();
      return {
        ...docData,
        id: doc.id, // Mandatory for MUI DataGrid
        uid: docData.uid || doc.id, // Fallback to doc.id if uid isn't in fields
      } as T;
    });
  }, []);

  const fetchAll = useCallback(
    async (filters: Record<string, any> = {}) => {
      setLoading(true);
      setError(null);

      try {
        const constraints: QueryConstraint[] = [];

        // Add dynamic filters
        Object.entries(filters).forEach(([field, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            constraints.push(where(field, "==", value));
          }
        });

        // Add sorting
        constraints.push(orderBy(defaultOrderBy, orderDirection));

        const q = query(collection(db, collectionName), ...constraints);
        const snapshot = await getDocs(q);
        setData(mapDocs(snapshot));
      } catch (err: any) {
        console.error(`[useAdminCRUD] Error fetching ${collectionName}:`, err);
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    },
    [collectionName, defaultOrderBy, orderDirection, mapDocs]
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

  const create = useCallback(
    async (item: Omit<T, "id" | "uid"> & { uid?: string }) => {
      setError(null);
      try {
        // If a UID is provided (like when creating a User), use it as the doc ID
        const docId = item.uid || doc(collection(db, collectionName)).id;
        const docRef = doc(db, collectionName, docId);

        const payload = {
          ...item,
          uid: docId,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
          created_by: user?.uid || "system",
        };

        await setDoc(docRef, payload);
        await fetchAll();
        return docId;
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [collectionName, user?.uid, fetchAll]
  );

  const update = useCallback(
    async (id: string, updates: Partial<T>) => {
      setError(null);
      try {
        const docRef = doc(db, collectionName, id);
        await updateDoc(docRef, {
          ...updates,
          updated_at: serverTimestamp(),
          updated_by: user?.uid || "system",
        });
        await fetchAll();
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [collectionName, user?.uid, fetchAll]
  );

  const remove = useCallback(
    async (id: string) => {
      setError(null);
      try {
        await deleteDoc(doc(db, collectionName, id));
        await fetchAll();
      } catch (err: any) {
        setError(err.message);
        throw err;
      }
    },
    [collectionName, fetchAll]
  );

  // Initial Load
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    data,
    loading,
    error,
    fetchAll,
    search,
    create,
    update,
    remove,
  };
}
