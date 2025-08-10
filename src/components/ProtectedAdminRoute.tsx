import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Props { children: React.ReactNode }

export const ProtectedAdminRoute: React.FC<Props> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setTimeout(async () => {
        const { data, error } = await supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" });
        setIsAdmin(Boolean(data) && !error);
        setLoading(false);
      }, 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setTimeout(async () => {
        const { data, error } = await supabase.rpc("has_role", { _user_id: session.user.id, _role: "admin" });
        setIsAdmin(Boolean(data) && !error);
        setLoading(false);
      }, 0);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/auth" replace state={{ from: location }} />;
  return <>{children}</>;
};
