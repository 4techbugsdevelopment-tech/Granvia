import { UserRole } from '../../lib/apiTypes';
import { useAuth } from '../../hooks/useAuth';

export default function RoleGuard({ allowedRoles, children, fallback = null }: { allowedRoles: UserRole[]; children: React.ReactNode; fallback?: React.ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return <>{fallback}</>;
  if (!profile || !allowedRoles.includes(profile.role)) return <>{fallback}</>;
  return <>{children}</>;
}
