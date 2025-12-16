// src/hooks/useCloudFunctions.ts
import {
  getFunctions,
  httpsCallable,
  HttpsCallableResult,
} from "firebase/functions";
import { httpsCallableFromURL } from "firebase/functions"; // if you ever need specific URL

type CallableData = Record<string, any>;

export const useCloudFunctions = () => {
  const functions = getFunctions();

  const callFunction = async <T = any>(
    name: string,
    data?: CallableData
  ): Promise<HttpsCallableResult<T>> => {
    try {
      // ← Add the generic here
      const fn = httpsCallable<unknown, T>(functions, name);
      const result = await fn(data);
      return result as HttpsCallableResult<T>;
    } catch (error: any) {
      console.error(`Error calling ${name}:`, error);
      throw error;
    }
  };

  return { callFunction };
};
