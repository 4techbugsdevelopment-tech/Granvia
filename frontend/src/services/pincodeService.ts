const PINCODE_API_BASE = 'https://api.pincodeapi.in/api/v1';

type PincodeApiOffice = {
  officename?: string;
  office_name?: string;
  district?: string;
  statename?: string;
  city?: string;
  state?: string;
};

type PincodeApiResponse = {
  status?: string;
  success?: boolean;
  data?: PincodeApiOffice[] | {
    post_offices?: PincodeApiOffice[];
  };
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
  const offices = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.data)
      ? payload.data
      : payload.data?.post_offices;
  if (!offices || offices.length === 0) return null;

  const first = offices[0];
  const officeName = (first.office_name || first.officename || '').trim();
  const district = (first.district || first.city || officeName).trim();
  const state = (first.statename || first.state || '').trim();

  if (!district || !state) return null;

  return {
    city: district,
    district,
    state,
    officeName,
  };
}
