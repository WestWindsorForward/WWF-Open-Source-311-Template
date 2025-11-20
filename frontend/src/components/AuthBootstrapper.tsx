import { useEffect } from "react";

import { fetchCurrentUser } from "../api/auth";
import { useAuthStore } from "../store/auth";

interface Props {
  children: React.ReactNode;
}

export function AuthBootstrapper({ children }: Props) {
  const hydrate = useAuthStore((state) => state.hydrate);
  const tokens = useAuthStore((state) => state.tokens);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clearSession = useAuthStore((state) => state.clearSession);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!tokens || user) return;
    fetchCurrentUser()
      .then(setUser)
      .catch(() => clearSession());
  }, [tokens, user, setUser, clearSession]);

  return <>{children}</>;
}
