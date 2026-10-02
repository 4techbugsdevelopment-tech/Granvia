const { test } = require('node:test');
const assert = require('node:assert/strict');

for (const [path, exports] of [
  ['../dist/prisma', { prisma: {} }],
  ['../dist/services/associateWalletService', { syncAssociateWallet: async () => {} }],
]) {
  const filename = require.resolve(path);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
const { debitEmployerWalletForPayment } = require('../dist/controllers/walletController');

function mockDb(balance) {
  const writes = [];
  return {
    writes,
    employerWallet: {
      findUnique: async () => ({ id: 'wallet', balance, depositBalance: balance, creditBalance: 0 }),
      update: async ({ data }) => {
        writes.push(data);
        return { balance: balance - data.balance.decrement };
      },
    },
    walletTransaction: { create: async ({ data }) => { writes.push(data); return data; } },
  };
}
const input = (amount, reserve = 10000) => ({ employerUserId: 'employer', paymentId: 'payment', amount, minimumRemainingBalance: reserve, purpose: 'Attendance settlement' });

for (const [balance, amount, shortfall] of [[500, 1000, 10500], [10500, 1000, 500], [10999.99, 1000, 0.01]]) {
  test('rejects balance ' + balance + ' and reports exact recharge shortfall', async () => {
    const db = mockDb(balance);
    await assert.rejects(debitEmployerWalletForPayment(db, input(amount)), error => {
      assert.equal(error.status, 422);
      assert.deepEqual(error.payload.wallet_balance_details, {
        currency: 'INR', current_balance: balance, payment_amount: amount,
        projected_remaining_balance: Math.round((balance - amount) * 100) / 100,
        minimum_remaining_balance: 10000, required_balance: 11000, recharge_shortfall: shortfall,
      });
      assert.match(error.message, /Current balance:/);
      assert.match(error.message, /Attendance payment:/);
      assert.match(error.message, /10,000.00/);
      return true;
    });
    assert.equal(db.writes.length, 0);
  });
}

test('allows exactly 10000 remaining and debits only the attendance amount', async () => {
  const db = mockDb(11000);
  const result = await debitEmployerWalletForPayment(db, input(1000));
  assert.equal(result.balance, 10000);
  assert.equal(db.writes.length, 2);
  assert.equal(db.writes[0].balance.decrement, 1000);
  assert.equal(db.writes[1].amount, 1000);
});

test('preserves payments without the attendance reserve requirement', async () => {
  const db = mockDb(1000);
  const result = await debitEmployerWalletForPayment(db, { employerUserId: 'employer', paymentId: 'payment', amount: 1000, purpose: 'Other payment' });
  assert.equal(result.balance, 0);
});
