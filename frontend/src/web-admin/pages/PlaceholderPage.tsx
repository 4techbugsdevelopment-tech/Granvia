import { motion } from 'framer-motion';
import { Construction } from 'lucide-react';

const PAGE_INFO: Record<string, { title: string; description: string; features: string[] }> = {
  employers: {
    title: 'Employer Management',
    description: 'Manage employer accounts, company profiles, and site information.',
    features: ['Employer List', 'Company/Site Management', 'Employer Verification', 'Block/Unblock Employer'],
  },
  jobs: {
    title: 'Job Management',
    description: 'Post, review, and manage associate job listings across locations.',
    features: ['Job List & Filters', 'Create New Job', 'Approve/Reject Jobs', 'Radius & Location Setup'],
  },
  attendance: {
    title: 'Attendance Management',
    description: 'Monitor associate attendance, in/out logs, and generate reports.',
    features: ['Daily Attendance Logs', 'In-Time/Out-Time Reports', 'Employer Verification', 'Monthly Summary'],
  },
  hiring: {
    title: 'Hiring Workflow',
    description: 'Streamline manpower selection, onboarding and agreement processes.',
    features: ['Applicant Review', 'Select/Reject Manpower', 'Interview Scheduling', 'Agreement & Onboarding'],
  },
  wallet: {
    title: 'Wallet & Payments',
    description: 'Manage the Granvia coin system, transactions, and payment gateway.',
    features: ['Wallet Dashboard', 'Coin System Management', 'Payment Gateway', 'OTP Cash Payments', 'Transaction History'],
  },
  reports: {
    title: 'Reports & Analytics',
    description: 'Detailed reports on area performance, skills, earnings, and commissions.',
    features: ['Area-wise Reports', 'Skill Distribution', 'Earnings Reports', 'Manpower Availability', 'Commission Tracking'],
  },
  settings: {
    title: 'Settings',
    description: 'Configure app settings, security policies, and admin preferences.',
    features: ['Admin Profile', 'Security Settings', 'App Configuration', 'Notification Settings'],
  },
};

export default function PlaceholderPage({ page }: { page: string }) {
  const info = PAGE_INFO[page] || {
    title: 'Module',
    description: 'This module is coming soon.',
    features: [],
  };

  return (
    <motion.div
      className="p-6 flex flex-col items-center justify-center min-h-96"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <motion.div
        className="rounded-3xl p-12 text-center max-w-lg w-full"
        style={{ background: 'white', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
      >
        {/* Animated icon */}
        <motion.div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: 'linear-gradient(135deg, #0f1e3c, #1a2d50)' }}
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <Construction size={36} className="text-white" />
        </motion.div>

        <h2 className="text-2xl font-bold mb-2" style={{ color: '#0f1e3c' }}>{info.title}</h2>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">{info.description}</p>

        {/* Feature preview */}
        <div className="text-left space-y-2 mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Planned Features</p>
          {info.features.map(feature => (
            <motion.div
              key={feature}
              className="flex items-center gap-2.5 text-sm text-gray-600 px-3 py-2 rounded-lg"
              style={{ background: '#f8fafc' }}
              whileHover={{ x: 4 }}
            >
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#8b1a1a' }} />
              {feature}
            </motion.div>
          ))}
        </div>

        <div
          className="text-xs px-4 py-2.5 rounded-xl font-medium"
          style={{ background: 'rgba(139,26,26,0.06)', color: '#8b1a1a' }}
        >
          Module under development – ready for backend integration
        </div>
      </motion.div>
    </motion.div>
  );
}
