// Sub Admin login — same design as the Super Admin / Employer portals.
import PortalLoginScreen from '../components/auth/PortalLoginScreen';

export default function SubAdminAuth({ onLogin, onBackToLanding }: { onLogin: () => void; onBackToLanding: () => void }) {
  return (
    <PortalLoginScreen
      onLogin={onLogin}
      onBackToLanding={onBackToLanding}
      role="sub_admin"
      title="Sub Admin Login"
      subtitle="Regional Company & Staff Management"
    />
  );
}
