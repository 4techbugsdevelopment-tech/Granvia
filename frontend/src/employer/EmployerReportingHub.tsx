import { useState } from 'react';
import EmployerReportsPage from './EmployerReportsPage';
import FinancialReports from '../components/reports/FinancialReports';
export default function EmployerReportingHub({ company, onSelectCompany }: { company?: { id: string; company_name?: string } | null; onSelectCompany: () => void }) {
  const [financial, setFinancial] = useState(() => !!new URLSearchParams(window.location.search).get('financial_report') || !company);
  const navigate = (next: boolean) => { const url = new URL(window.location.href); url.search = ''; window.history.replaceState({}, '', url); setFinancial(next); };
  return <><div className="px-4 md:px-6 pt-4 flex gap-3"><button className="text-sm underline" onClick={() => navigate(false)}>Hiring / documents / attendance</button><button className="text-sm underline" onClick={() => navigate(true)}>Payments / wallet statement</button></div>{financial ? <FinancialReports role="employer" company={company ?? undefined} initialKind={company ? 'payments' : 'wallet-statement'}/> : company ? <EmployerReportsPage company={company}/> : <div className="p-6"><p>Select or create a company to view operational reports.</p><button className="mt-3 text-sm underline" onClick={onSelectCompany}>Manage companies</button></div>}</>;
}
