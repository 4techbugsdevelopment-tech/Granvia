import PortalLoginScreen from '../components/auth/PortalLoginScreen';
export default function FinanceAuth({ onLogin, onBackToLanding }: { onLogin: () => void; onBackToLanding: () => void }) {
  return <PortalLoginScreen onLogin={onLogin} onBackToLanding={onBackToLanding} role="finance" title="Finance Login" subtitle="Withdrawals & Payout Reconciliation" />;
}
