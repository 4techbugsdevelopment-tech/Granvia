import { useState } from 'react';
import { listEmployerApplications, listMyApplications } from '../services/applicationService';

export default function ReleaseAttachments({ application, role }: { application: any; role: 'employer' | 'associate' }) {
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);
  const files = application.release_attachments ?? [];
  if (!files.length) return null;
  const open = async (index: number) => {
    const preview = window.open('', '_blank');
    if (preview) preview.opener = null;
    setOpening(true);
    setError('');
    try {
      // Refresh the signed URL at click time, including after a long-open session.
      const apps = role === 'employer' ? await listEmployerApplications(undefined, application.job_id) : await listMyApplications();
      const file = apps.find((app: any) => app.id === application.id)?.release_attachments?.[index];
      if (!file?.download_url) throw new Error('Document is unavailable. Please refresh and try again.');
      if (preview) preview.location.href = file.download_url;
      else window.location.assign(file.download_url);
    } catch (err: any) {
      preview?.close();
      setError(err.message || 'Unable to open document.');
    } finally { setOpening(false); }
  };
  return <div className="space-y-2">{files.map((file: any, index: number) => <button type="button" key={index} disabled={opening} onClick={() => void open(index)} className="block break-all text-left text-sm font-semibold text-blue-700 underline disabled:opacity-50">View {file.name}</button>)}{error && <p role="alert" className="text-xs text-red-600">{error}</p>}</div>;
}
