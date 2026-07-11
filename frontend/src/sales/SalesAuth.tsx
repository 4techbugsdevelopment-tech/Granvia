// Sales Executive login — same design as the Super Admin / Employer portals.
import PortalLoginScreen from '../components/auth/PortalLoginScreen';

export default function SalesAuth({ onLogin, onBackToLanding }: { onLogin: () => void; onBackToLanding: () => void }) {
  return (
    <PortalLoginScreen
      onLogin={onLogin}
      onBackToLanding={onBackToLanding}
      role="sales_executive"
      title="Sales Executive Login"
      subtitle="Client Management & Job Posting"
      initialEmail={import.meta.env.VITE_DEMO_SALES_EMAIL || ''}
      initialPassword={import.meta.env.VITE_DEMO_SALES_PASSWORD || ''}
    />
  );
}
