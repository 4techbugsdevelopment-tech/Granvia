import PortalLoginScreen from '../components/auth/PortalLoginScreen';
export default function OperationsAuth({ onLogin, onBackToLanding }: { onLogin: () => void; onBackToLanding: () => void }) {
  return <PortalLoginScreen onLogin={onLogin} onBackToLanding={onBackToLanding} role="operations" title="Operations Login" subtitle="Hiring, Onboarding & Attendance" />;
}
