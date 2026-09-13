ALTER TABLE employer_wallets ADD deposit_balance DECIMAL(12, 2) NOT NULL CONSTRAINT employer_wallets_deposit_balance_default DEFAULT 0;
ALTER TABLE employer_wallets ADD credit_balance DECIMAL(12, 2) NOT NULL CONSTRAINT employer_wallets_credit_balance_default DEFAULT 0;
ALTER TABLE employer_wallets ADD total_recharged DECIMAL(12, 2) NOT NULL CONSTRAINT employer_wallets_total_recharged_default DEFAULT 0;
ALTER TABLE employer_wallets ADD total_credited DECIMAL(12, 2) NOT NULL CONSTRAINT employer_wallets_total_credited_default DEFAULT 0;
ALTER TABLE employer_wallets ADD total_debited DECIMAL(12, 2) NOT NULL CONSTRAINT employer_wallets_total_debited_default DEFAULT 0;

UPDATE employer_wallets
SET deposit_balance = balance,
    total_recharged = balance
WHERE balance > 0;

ALTER TABLE wallet_transactions ADD source NVARCHAR(50) NULL;
ALTER TABLE wallet_transactions ADD reference_type NVARCHAR(50) NULL;
ALTER TABLE wallet_transactions ADD reference_id NVARCHAR(36) NULL;
ALTER TABLE wallet_transactions ADD job_id NVARCHAR(36) NULL;
ALTER TABLE wallet_transactions ADD guard_user_id NVARCHAR(36) NULL;
ALTER TABLE wallet_transactions ADD balance_after DECIMAL(12, 2) NULL;
ALTER TABLE wallet_transactions ADD metadata NVARCHAR(MAX) NULL;

CREATE INDEX wallet_transactions_reference_type_reference_id_idx ON wallet_transactions(reference_type, reference_id);
