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

  // Load user ID from localStorage on mount
  useEffect(() => {
    const storedUserId = localStorage.getItem(USER_ID_KEY);
    if (storedUserId) {
      setUserId(storedUserId as Id<"users">);
    }
    setIsLoading(false);
  }, []);

  // Fetch user data when userId changes
  const userData = useQuery(
    api.auth.getUserWithOrganization,
    userId ? { userId } : "skip"
  );

  // Clear invalid session if user no longer exists
  useEffect(() => {
    if (userId && userData === null) {
      // User ID in localStorage but user not found in database
      localStorage.removeItem(USER_ID_KEY);
      setUserId(null);
    }
  }, [userId, userData]);

  const signIn = async (email: string, password: string) => {
    const result = await signInMutation({ email, password });
    localStorage.setItem(USER_ID_KEY, result.userId);
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
    localStorage.setItem(USER_ID_KEY, result.userId);
    setUserId(result.userId);
  };

  const signOut = () => {
    localStorage.removeItem(USER_ID_KEY);
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
