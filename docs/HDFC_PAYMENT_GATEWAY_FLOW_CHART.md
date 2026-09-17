# Granvia HDFC Payment Gateway Flow Chart

```mermaid
flowchart TD
    START([Start])

    START --> EMP_LOGIN[Employer logs in to Granvia]
    EMP_LOGIN --> WALLET_CHECK{Employer deposited wallet balance >= INR 10,000?}

    WALLET_CHECK -- No --> ADD_FUNDS[Employer clicks Add Funds]
    ADD_FUNDS --> ENTER_AMOUNT[Employer enters recharge amount]
    ENTER_AMOUNT --> CREATE_ORDER[Granvia backend creates HDFC payment order]
    CREATE_ORDER --> HDFC_PAY[Employer completes payment on HDFC gateway]
    HDFC_PAY --> HDFC_CALLBACK[HDFC sends return response and server webhook]
    HDFC_CALLBACK --> VERIFY_PAYMENT{Granvia verifies HDFC signature and payment status}

    VERIFY_PAYMENT -- Failed / Pending --> RECHARGE_PENDING[Recharge remains pending or failed; Employer retries or Finance reconciles]
    RECHARGE_PENDING --> ADD_FUNDS

    VERIFY_PAYMENT -- Success --> CREDIT_EMPLOYER[Granvia credits Employer deposited wallet balance]
    CREDIT_EMPLOYER --> WALLET_LEDGER[Granvia records wallet transaction with HDFC reference]
    WALLET_LEDGER --> WALLET_CHECK

    WALLET_CHECK -- Yes --> POST_JOB[Employer submits job]
    POST_JOB --> ADMIN_APPROVAL[Super Admin reviews and approves job]
    ADMIN_APPROVAL --> JOB_ACTIVE[Job becomes active for eligible Associates]

    JOB_ACTIVE --> ASSOC_APPLY[Associate applies and is selected]
    ASSOC_APPLY --> JOINING[Offer, agreement, and joining completed]
    JOINING --> ATTENDANCE[Associate checks in and checks out]
    ATTENDANCE --> APPROVE_ATTENDANCE[Employer or authorised Operations approves attendance]

    APPROVE_ATTENDANCE --> PAYABLE_CALC[Granvia calculates payable amount]
    PAYABLE_CALC --> SETTLEMENT_BALANCE{Employer wallet has sufficient balance?}

    SETTLEMENT_BALANCE -- No --> FUNDING_REQUIRED[Settlement marked funding required]
    FUNDING_REQUIRED --> ADD_FUNDS

    SETTLEMENT_BALANCE -- Yes --> ATOMIC_SETTLEMENT[Atomic settlement in Granvia database]
    ATOMIC_SETTLEMENT --> EMP_DEBIT[Debit Employer wallet]
    ATOMIC_SETTLEMENT --> PAYMENT_ROW[Create payment record]
    ATOMIC_SETTLEMENT --> ASSOC_CREDIT[Credit Associate wallet processing / reserved balance]
    EMP_DEBIT --> SETTLEMENT_DONE[Attendance settlement completed once]
    PAYMENT_ROW --> SETTLEMENT_DONE
    ASSOC_CREDIT --> SETTLEMENT_DONE

    SETTLEMENT_DONE --> WITHDRAW_REQUEST[Associate requests withdrawal]
    WITHDRAW_REQUEST --> BANK_VALIDATE[Granvia validates bank account, IFSC, and available balance]
    BANK_VALIDATE --> RESERVE_BALANCE[Granvia reserves Associate wallet balance]
    RESERVE_BALANCE --> FINANCE_REVIEW[Finance reviews withdrawal request]

    FINANCE_REVIEW -- Reject --> RELEASE_FUNDS[Granvia releases reserved balance back to Associate wallet]
    RELEASE_FUNDS --> ASSOC_NOTIFY_REJECT[Associate notified with rejection reason]
    ASSOC_NOTIFY_REJECT --> END_REJECT([End])

    FINANCE_REVIEW -- Approve --> HDFC_PAYOUT[Granvia sends payout instruction to HDFC]
    HDFC_PAYOUT --> PAYOUT_CALLBACK[HDFC sends payout status / UTR / webhook]
    PAYOUT_CALLBACK --> VERIFY_PAYOUT{Granvia verifies payout status and signature}

    VERIFY_PAYOUT -- Failed / Pending --> PAYOUT_RECON[Withdrawal remains failed, pending, or in reconciliation]
    PAYOUT_RECON --> FINANCE_REVIEW

    VERIFY_PAYOUT -- Success --> COMPLETE_WITHDRAWAL[Granvia marks withdrawal completed]
    COMPLETE_WITHDRAWAL --> DEBIT_RESERVED[Granvia debits reserved Associate wallet balance]
    DEBIT_RESERVED --> STORE_REFERENCE[Granvia stores HDFC payout reference / UTR]
    STORE_REFERENCE --> END_SUCCESS([End])
```

## Short Flow

```text
Employer Add Funds
-> HDFC collects payment
-> Granvia verifies webhook/status
-> Employer deposited wallet is credited
-> Employer posts job
-> Associate works and attendance is approved
-> Granvia debits Employer wallet and credits Associate wallet
-> Associate requests withdrawal
-> Finance approves
-> HDFC processes payout
-> Granvia records payout reference and completes withdrawal
```

