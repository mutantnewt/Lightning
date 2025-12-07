import { useState, useEffect, createContext, useContext, ReactNode } from "react";

const AUTH_STORAGE_KEY = "literary-light-auth";

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Simple in-memory user storage for demo purposes
const USERS_STORAGE_KEY = "literary-light-users";

interface StoredUser {
  id: string;
  email: string;
  name: string;
  password: string; // In a real app, this would be hashed
  createdAt: string;
}

function getStoredUsers(): StoredUser[] {
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveUser(user: StoredUser) {
  const users = getStoredUsers();
  users.push(user);
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function findUser(email: string, password: string): StoredUser | null {
  const users = getStoredUsers();
  return users.find((u) => u.email === email && u.password === password) || null;
}

function emailExists(email: string): boolean {
  const users = getStoredUsers();
  return users.some((u) => u.email === email);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Load user from localStorage on mount
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const userData = JSON.parse(stored) as User;
        setUser(userData);
      }
    } catch (error) {
      console.error("Error loading auth state:", error);
    }
  }, []);

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    // Validate inputs
    if (!email || !password) {
      return { success: false, error: "Email and password are required" };
    }

    // Find user
    const storedUser = findUser(email, password);
    if (!storedUser) {
      return { success: false, error: "Invalid email or password" };
    }

    // Create user session
    const userData: User = {
      id: storedUser.id,
      email: storedUser.email,
      name: storedUser.name,
      createdAt: storedUser.createdAt,
    };

    setUser(userData);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));

    return { success: true };
  };

  const signUp = async (
    email: string,
    password: string,
    name: string
  ): Promise<{ success: boolean; error?: string }> => {
    // Validate inputs
    if (!email || !password || !name) {
      return { success: false, error: "All fields are required" };
    }

    if (password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters" };
    }

    // Check if email already exists
    if (emailExists(email)) {
      return { success: false, error: "Email already registered" };
    }

    // Create new user
    const newUser: StoredUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      email,
      password, // In a real app, this would be hashed
      name,
      createdAt: new Date().toISOString(),
    };

    saveUser(newUser);

    // Sign in the new user
    const userData: User = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      createdAt: newUser.createdAt,
    };

    setUser(userData);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));

    return { success: true };
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
