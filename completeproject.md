This comprehensive functional blueprint details the operational flow, information pathways, and role-specific features for the **Granvia** platform. As requested, the term "Guard" has been replaced with **Service Partner** or **Manpower**, and the document emphasizes the **Manual Admin Verification** process currently in place.

---

### **1. Service Partner (Manpower) Module**
*Mobile-first application focused on operational flexibility and financial independence.*

| Section | Feature | Action / Form | Information Passing & Flow |
| :--- | :--- | :--- | :--- |
| **Onboarding** | **KYC & Verification** | **Form:** Identity Upload.<br>**Fields:** Name, Address, Aadhaar Number, Police Verification (Doc Upload), Bank Details. | **Flow:** User uploads files → **Admin Approval Desk** (Web). Status is set to "Pending" in the app until Admin review. |
| **Onboarding** | **Aadhaar "Prime Key"** | **Action:** Trigger OTP Verification. | **Flow:** Aadhaar API sends OTP to registered mobile → User enters OTP → Verification status updates to "Aadhaar Verified". |
| **Marketplace** | **Radius-Based Search** | **Form:** Range Slider.<br>**Action:** Select radius (Walking to 15km+). | **Flow:** Range data + User GPS coordinates → Google Maps API → Filters and displays nearby jobs matching the radius. |
| **Marketplace** | **Job Application** | **Action:** "Flip" Job Card to view details → Click "Apply". | **Flow:** Application notification sent to **Employer** and **Super Admin**. Profile details (Skills, Verification Status) travel to Employer's Applicant List. |
| **Scheduling** | **My Availability** | **Form:** Availability Calendar.<br>**Fields:** Date Range (e.g., 1st–15th), Shift Slots (7-7 slots). | **Flow:** User selects "Available" slots → Data populates the **Admin/Employer Search Map**, making the partner visible as "Ready to Hire". |
| **Operations** | **Daily Attendance** | **Action:** "In-Time" & "Out-Time" Log. | **Flow:** App captures timestamp + Geofence check → Notifies **Employer** for verification → Log travels to **Admin Billing Engine**. |
| **Finance** | **Wallet & Settlement** | **Actions:** View Credits, P2P Transfer, Withdraw. | **Flow:** 1 Credit = 1 INR. **P2P Transfer:** User enters recipient ID → Credits move instantly between internal wallets. |

---

### **2. Employer (Client) Module**
*Web and Mobile interface for workforce management and site oversight.*

| Section | Feature | Action / Form | Information Passing & Flow |
| :--- | :--- | :--- | :--- |
| **Setup** | **Site/Company Creation** | **Form:** Site Profile.<br>**Fields:** Site name, Address, Location Pins. | **Flow:** Site data travels to the database to define the radius for Service Partner job searches. |
| **Hiring** | **Job Posting** | **Form:** Post Job.<br>**Fields:** Manpower count, Category (4hr/8hr/12hr), Skills (Language, Experience). | **Flow:** Requirements travel to the Marketplace and are matched against Service Partner profiles. |
| **Hiring** | **Candidate Selection** | **Action:** Review Applicant Profile → Select/Reject → Schedule Interview. | **Flow:** Selection triggers notification to Service Partner. **Action:** "Call" or "Video VC" initiates a real-time interaction via the app. |
| **Operations** | **Attendance Verification** | **Action:** Accept/Reject "In/Out" Logs. | **Flow:** Acceptance of EOD logs triggers **Wallet Deduction**. Information moves to **Admin Settlement Reports**. |
| **Finance** | **Wallet Management** | **Action:** Load Credits via Payment Gateway. | **Flow:** Employer maintains a minimum credit balance (e.g., 1 day of pay) to guarantee payment to the Service Partner. |

---

### **3. Super Admin & Sub Admin Module**
*Web Dashboard for system governance and manual operational control.*

| Section | Feature | Action / Form | Information Passing & Flow |
| :--- | :--- | :--- | :--- |
| **Verification** | **Document Approval Desk** | **Form:** Verification Queue.<br>**Action:** Review uploaded Aadhaar/Police/Bank docs [3.4.1]. | **Flow:** Admin views Partner's raw uploads → Marks as "Approved" or "Rejected" (with reason) → Notification travels back to Service Partner App, updating their "Prime Key" status. |
| **Management** | **Master CRUD Operations** | **Action:** Add/Edit/Block Users, Sites, and Job Posts. | **Flow:** Changes are global. Blocking a user (Employer or Partner) instantly revokes access to the Marketplace and Wallet [3.4.2]. |
| **Management** | **Manual Onboarding** | **Form:** Direct Data Entry. | **Flow:** Admin inputs Service Partner data manually for those without smartphones → Partner is added to the "Available" database. |
| **Sub Admin** | **Localized Control** | **Action:** Manage own Staff and assigned Service Partners. | **Flow:** Sub Admin data is filtered to their specific branch or company, ensuring they only see information relevant to their assigned scope [3.5]. |
| **Analytics** | **Intelligence Reports** | **Dashboard View:** Real-time stats. | **Flow:** Aggregates data from Wallet (Revenue/Commission), Attendance (Active Manpower), and Marketplace (Job Demand) to show area-wise availability. |

---

### **4. Detailed Process Flow: The Life of a Job**
1.  **Job Initiation:** Employer posts a job for **8 hours** at a specific site.
2.  **Matching:** The system calculates the **hourly wage** based on parameters and pushes the job to Service Partners within a **5km radius**.
3.  **Application:** A Service Partner flips the Job Card, reviews the shift time (e.g., 7 AM – 3 PM), and applies.
4.  **Verification (Admin Role):** If the Partner is new, the **Admin** reviews their uploaded Police Verification and approves the profile.
5.  **Selection:** The Employer reviews the now "Verified" profile, schedules a quick **Video Call** to check communication, and accepts the hire.
6.  **Operation:** At 7 AM, the Partner clicks "In-Time." App verifies their location.
7.  **Settlement:** At 3 PM, the Partner clicks "Out-Time." Employer verifies. The system calculates **Daily EOD Settlement**, deducts credits from the Employer's wallet, and moves them to the Partner's "In Process" wallet.
8.  **Completion:** 24 hours later, the Partner can withdraw credits to their bank or transfer them to another user via **P2P Transfer**.