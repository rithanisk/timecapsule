import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  type AuthUser,
  type LoginInput,
  type RegisterInput,
  useGetMe,
  useLogin,
  useLogout,
  useRegister,
  getGetMeQueryKey,
} from "@workspace/api-client-react";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (data: LoginInput) => Promise<AuthUser>;
  register: (data: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const meQuery = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const logoutMutation = useLogout();

  const login = useCallback(
    (data: LoginInput) =>
      new Promise<AuthUser>((resolve, reject) => {
        loginMutation.mutate(
          { data },
          {
            onSuccess: (user) => {
              queryClient.setQueryData(getGetMeQueryKey(), user);
              resolve(user);
            },
            onError: reject,
          },
        );
      }),
    [loginMutation, queryClient],
  );

  const register = useCallback(
    (data: RegisterInput) =>
      new Promise<AuthUser>((resolve, reject) => {
        registerMutation.mutate(
          { data },
          {
            onSuccess: (user) => {
              queryClient.setQueryData(getGetMeQueryKey(), user);
              resolve(user);
            },
            onError: reject,
          },
        );
      }),
    [registerMutation, queryClient],
  );

  const logout = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        logoutMutation.mutate(
          undefined as void,
          {
            onSuccess: () => {
              queryClient.setQueryData(getGetMeQueryKey(), null);
              queryClient.removeQueries({ queryKey: getGetMeQueryKey() });
              resolve();
            },
            onError: reject,
          },
        );
      }),
    [logoutMutation, queryClient],
  );

  const user = meQuery.data && typeof meQuery.data.id === 'string' && typeof meQuery.data.displayName === 'string'
    ? meQuery.data
    : null;
  const isLoading = meQuery.isLoading;

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
