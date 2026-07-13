// Type definitions used by admin and mobile screens not yet migrated to the API backend.
// The storage object returns empty arrays/stubs — all real data now comes from the API services.

export type VerificationStatus = 'Pending' | 'Verified' | 'Rejected';
export type AccountStatus = 'Pending' | 'Active' | 'Blocked';

export type Guard = {
  id: string;
  fullName: string;
  mobile: string;
  email: string;
  password: string;
  gender: string;
  dob: string;
  address: string;
  city: string;
  state: string;
  currentLocation: string;
  latitude: string;
  longitude: string;
  skills: string[];
  languages: string[];
  experience: string;
  aadhaarStatus: VerificationStatus;
  policeVerification: VerificationStatus;
  bankDetails: object | null;
  status: 'Active' | 'Blocked';
  avatar: string | null;
  createdAt: string;
};

export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  city: string;
  state: string;
  salary: number;
  salaryType: string;
  shiftType: string;
  dutyHours: string;
  openings: number;
  status: 'Active' | 'Inactive' | 'Closed';
  requirements: string[];
  description: string;
  postedDate: string;
};

export type Application = {
  id: string;
  guardId: string;
  jobId: string;
  status: 'Pending' | 'Shortlisted' | 'Selected' | 'Rejected';
  appliedDate: string;
  notes: string;
};

export type Attendance = {
  id: string;
  guardId: string;
  jobId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: 'Present' | 'Absent' | 'Late';
  hoursWorked: number;
};

export type Employer = {
  id: string;
  companyName: string;
  contactPersonName: string;
  email: string;
  mobile: string;
  city: string;
  state: string;
  pincode: string;
  isAadhaarVerified: boolean;
  aadhaarVerificationStatus: string;
  aadhaarLastFour: string;
  accountStatus: AccountStatus;
  createdAt: string;
};

export type EmployerCompany = {
  id: string;
  employerId: string;
  companyName: string;
  businessType: string;
  registrationType: string;
  gstNumber: string;
  panNumber: string;
  companyEmail: string;
  companyPhone: string;
  registeredAddress: string;
  city: string;
  state: string;
  pincode: string;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  createdAt: string;
};

export type EmployerDocument = {
  id: string;
  employerId: string;
  companyId: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  verificationStatus: VerificationStatus;
  uploadedAt: string;
};

export type CompanySite = {
  id: string;
  companyId: string;
  siteName: string;
  siteType: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactPerson: string;
  contactMobile: string;
  status: 'Active' | 'Inactive';
};

// Stub storage object — returns empty data. Screens still using this should be migrated to the API services.
export const storage = {
  generateId: () => Math.random().toString(36).slice(2, 11),

  getGuards: (): Guard[] => [],
  addGuard: (_guard: Guard) => {},
  updateGuard: (_id: string, _updates: Partial<Guard>) => {},

  getJobs: (): Job[] => [],
  addJob: (_job: Job) => {},
  updateJob: (_id: string, _updates: Partial<Job>) => {},

  getApplications: (): Application[] => [],
  addApplication: (_app: Application) => {},
  updateApplication: (_id: string, _updates: Partial<Application>) => {},

  getAttendance: (): Attendance[] => [],
  addAttendance: (_att: Attendance) => {},
  updateAttendance: (_id: string, _updates: Partial<Attendance>) => {},

  getEmployers: (): Employer[] => [],
  addEmployer: (_emp: Employer) => {},
  updateEmployer: (_id: string, _updates: Partial<Employer>) => {},
};
