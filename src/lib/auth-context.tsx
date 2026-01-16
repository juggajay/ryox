"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Storage } from "./storage";

interface User {
  _id: Id<"users">;
  email: string;
  name: string;
  role: "owner" | "worker";
  organizationId: Id<"organizations">;
  workerId?: Id<"workers">;
  onboardingCompletedAt?: number;
}

interface Organization {
  _id: Id<"organizations">;
  name: string;
  abn: string;
}

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: {
    email: string;
    password: string;
    name: string;
    organizationName: string;
    abn: string;
  }) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_ID_KEY = "carptrack_user_id";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const signInMutation = useMutation(api.auth.signIn);
  const signUpMutation = useMutation(api.auth.signUp);

  // Load user ID from storage on mount (supports native + web)
  useEffect(() => {
    const loadStoredUser = async () => {
      try {
        const storedUserId = await Storage.get(USER_ID_KEY);
        console.log("[AUTH] Loading from storage:", storedUserId);
        if (storedUserId) {
          setUserId(storedUserId as Id<"users">);
        }
      } catch (error) {
        console.error("[AUTH] Error loading from storage:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadStoredUser();
  }, []);

  // Fetch user data when userId changes
  const userData = useQuery(
    api.auth.getUserWithOrganization,
    userId ? { userId } : "skip"
  );

  // Clear invalid session if user no longer exists
  useEffect(() => {
    console.log("[AUTH] Session check - userId:", userId, "userData:", userData);
    if (userId && userData === null) {
      // User ID in storage but user not found in database
      console.log("[AUTH] CLEARING SESSION - user not found in database");
      Storage.remove(USER_ID_KEY);
      setUserId(null);
    }
  }, [userId, userData]);

  const signIn = async (email: string, password: string) => {
    const result = await signInMutation({ email, password });
    console.log("[AUTH] Sign in success, storing userId:", result.userId);
    await Storage.set(USER_ID_KEY, result.userId);
    setUserId(result.userId);
  };

  const signUp = async (data: {
    email: string;
    password: string;
    name: string;
    organizationName: string;
    abn: string;
  }) => {
    const result = await signUpMutation(data);
    await Storage.set(USER_ID_KEY, result.userId);
    setUserId(result.userId);
  };

  const signOut = async () => {
    await Storage.remove(USER_ID_KEY);
    setUserId(null);
  };

  const value: AuthContextType = {
    user: userData?.user as User | null,
    organization: userData?.organization as Organization | null,
    isLoading: isLoading || (userId !== null && userData === undefined),
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
