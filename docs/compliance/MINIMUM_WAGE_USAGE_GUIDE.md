# Minimum Wage — Simple Role and Usage Guide

This guide applies after the database migration and application deployment are completed.

## 1. Super Admin adds the government rule

1. Log in through **Admin Panel** using a **Super Admin** account.
2. Open **Minimum Wage** from the left menu.
3. Menu link: `/admin/minimum-wages`.
4. Open **Notifications** and click **Add Notification**.
5. Select the State/UT or Central jurisdiction.
6. Enter the government notice number, authority, dates and official source link.
7. Enter the wage rows: area/zone, work category, occupation, skill, wage unit, Basic, VDA, other mandatory amount and total.
8. Enter the salary component codes that legally count toward the minimum wage.
9. Click **Import for Review**. The rule is not active yet.
10. Check the notice against the official government document.
11. Click **Approve** only when every detail is correct. The rule then becomes available to job checks.

An **Admin Employee** can do the same only when the Super Admin gives that employee's role the **Minimum Wage Compliance** permission. The employee logs in through the same **Admin Panel**.

## 2. Super Admin maps Granvia job roles

1. In **Minimum Wage**, open **Role & Skill Mapping**.
2. Click **Add Mapping**.
3. Select the jurisdiction if the mapping is State-specific.
4. Enter the Granvia Associate Type code, legal work/occupation category and skill category.
5. Add the legal reference.
6. Save as **Approved** only after checking it.

## 3. Employer uses the wage check

1. Log in through the **Employer Portal** using an **Employer** account.
2. Open **Post Job** to create a job, or **Manage Jobs** to edit one.
3. Select the work site, Associate Type, job category, start date and Monthly/Daily payment type.
4. Enter the salary structure.
5. The **Applicable Minimum Wage** box checks the rule automatically.
6. The Employer can view the required wage, offered qualifying wage, government notice and result. The required wage cannot be edited.
7. If the result is **Compliant**, the active job can be saved.
8. If the salary is below the minimum, Granvia shows the shortfall and blocks active publishing.
9. If data is missing, unclear, conflicting or stale, save as **Draft** and ask the Super Admin/compliance team to review it.

## 4. Super Admin approves a job

1. Log in through **Admin Panel**.
2. Open **Manage Jobs** at `/admin/jobs`.
3. Review the job and its minimum-wage result.
4. Click **Approve**.
5. Granvia checks the wage again on the backend.
6. Approval succeeds only when the rule is verified and the offered qualifying wage meets the minimum.

## 5. Review coverage and history

In **Admin Panel → Minimum Wage**:

- **India Coverage** shows data readiness for every State and UT.
- **Notifications** shows draft, approved, rejected and revoked notices.
- **Job Compliance** shows verified, non-compliant and review-required jobs.
- **Audit History** shows who imported, approved, rejected, revoked or checked a record.

## 6. When the government changes a wage

1. Add the new official notice as a new record.
2. Do not edit or delete the old approved notice.
3. Check the new effective date and avoid overlapping rate periods.
4. Approve the new notice after legal review.
5. Review affected active jobs in **Job Compliance**.
6. Inform Employers where salary changes are required.
7. Do not change salaries, contracts, payroll or completed payments automatically.

