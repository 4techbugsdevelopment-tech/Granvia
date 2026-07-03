import { useAuth } from '../../hooks/useAuth';

export default function ProtectedRoute({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return <>{fallback}</>;
  if (!profile) return <>{fallback}</>;
  return <>{children}</>;
}
