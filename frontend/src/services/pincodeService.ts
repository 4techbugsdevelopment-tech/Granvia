const PINCODE_API_BASE = 'https://api.pincodeapi.in/api/v1';

type PincodeApiOffice = {
  officename?: string;
  district?: string;
  statename?: string;
  city?: string;
  state?: string;
};

type PincodeApiResponse = {
  status?: string;
  data?: PincodeApiOffice[];
  error?: {
    message?: string;
  };
};

export type PincodeLookupResult = {
  city: string;
  state: string;
  district: string;
  officeName: string;
};

export async function lookupIndianPincode(pincode: string, signal?: AbortSignal): Promise<PincodeLookupResult | null> {
  const normalized = pincode.replace(/\D/g, '').slice(0, 6);
  if (normalized.length !== 6) return null;

  const response = await fetch(`${PINCODE_API_BASE}/pincode/${normalized}`, { signal });
  if (!response.ok) {
    throw new Error(`Pincode lookup failed with status ${response.status}`);
  }

  const payload = (await response.json()) as PincodeApiResponse | PincodeApiOffice[];
  const offices = Array.isArray(payload) ? payload : payload.data;
  if (!offices || offices.length === 0) return null;

  const first = offices[0];
  const district = (first.district || first.city || first.officename || '').trim();
  const state = (first.statename || first.state || '').trim();

  return {
    city: district,
    district,
    state,
    officeName: (first.officename || '').trim(),
  };
}
