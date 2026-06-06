import { createContext, useContext } from "react";
import { AuthUser } from "@workspace/api-client-react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  canAccessModule: (module: string) => boolean;
  canEditModule: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
      staleTime: 1000 * 60 * 5, // cache is fresh for 5 min — prevents background refetch from clearing user right after login
    },
  });

  const canAccessModule = (module: string): boolean => {
    if (!user) return false;
    if (user.role === "admin" || user.role === "manager") return true;
    if (user.modules == null) return true;
    return (user.modules as Array<{ module: string; canEdit: boolean }>).some((m) => m.module === module);
  };

  const canEditModule = (module: string): boolean => {
    if (!user) return false;
    if (user.role === "admin" || user.role === "manager") return true;
    if (user.modules == null) return true;
    return (user.modules as Array<{ module: string; canEdit: boolean }>).some((m) => m.module === module && m.canEdit);
  };

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        isAuthenticated: !!user,
        canAccessModule,
        canEditModule,
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

export { getGetMeQueryKey };
