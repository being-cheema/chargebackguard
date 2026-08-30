async function executeTransaction(orderId: string, amount: number, notesReason: string) {
  const payload = {
    amount: amount,
    currency: 'INR',
    email: `buyer_${notesReason.toLowerCase()}@razorpay.com`,
    contact: '9876543210',
    order_id: orderId,
    method: 'netbanking',
    bank: 'CNRB',
  };

  const formBody = Object.entries(payload)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
    .join('&');

  const res = await fetch('https://api.razorpay.com/v1/payments/create/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent': 'Mozilla/5.0 RazorpayCheckout',
      'X-Razorpay-Device-Id': 'device_test_12345',
    },
    body: formBody,
  });

  const html = await res.text();
  const paymentIdMatch = html.match(/payment_id = "pay_([a-zA-Z0-9]+)"/) || html.match(/name="payment_id" value="([a-zA-Z0-9]+)"/);
  const actionMatch = html.match(/action="(https:\/\/api\.razorpay\.com\/v1\/gateway\/mocksharp\/payment[^"]+)"/);
  const callbackUrlMatch = html.match(/name="callback_url" value="([^"]+)"/);

  if (!paymentIdMatch) {
    console.error(`Failed to initiate for ${orderId}`);
    return null;
  }

  const rawPaymentId = paymentIdMatch[1];
  const fullPaymentId = rawPaymentId.startsWith('pay_') ? rawPaymentId : `pay_${rawPaymentId}`;

  if (actionMatch && callbackUrlMatch) {
    const gatewayUrl = actionMatch[1].replace(/&amp;/g, '&');
    const callbackUrl = callbackUrlMatch[1];

    const mockAuthPayload = {
      action: 'authorize',
      amount: String(amount),
      method: 'netbanking',
      payment_id: rawPaymentId,
      callback_url: callbackUrl,
      recurring: '0',
    };

    const mockFormBody = Object.entries(mockAuthPayload)
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
      .join('&');

    await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 RazorpayMockBank',
      },
      body: mockFormBody,
    });
  }

  return {
    payment_id: fullPaymentId,
    order_id: orderId,
    amount: amount,
    reason: notesReason,
    created_at: Math.floor(Date.now() / 1000),
  };
}

async function main() {
  const orders = [
    { orderId: 'order_TVz18CcIMZ7yNB', amount: 450000, reason: 'RZP01' },
    { orderId: 'order_TVz4hP2bv9tEey', amount: 720000, reason: 'RZP04' },
    { orderId: 'order_TVz6UkRWivemcL', amount: 1250000, reason: '1064' },
    { orderId: 'order_TVz89Ff1QzMvaF', amount: 310000, reason: 'RZP05' },
    { orderId: 'order_TVzACsTP4CPLHI', amount: 580000, reason: '13.2' },
    { orderId: 'order_TVzCw6DsGeBYkN', amount: 99900, reason: 'RZP06' },
    { orderId: 'order_TVzIBGWYoXmZzb', amount: 1800000, reason: '1061' },
    { orderId: 'order_TVzJSOFURdoZOg', amount: 640000, reason: '1062' },
  ];

  console.log('Executing transactions across all 8 orders...');
  const results = [];
  for (const ord of orders) {
    const res = await executeTransaction(ord.orderId, ord.amount, ord.reason);
    if (res) {
      results.push(res);
      console.log(`✅ Order ${ord.orderId} -> Payment ${res.payment_id} (₹${ord.amount / 100})`);
    }
  }

  console.log('\nAll Real Generated Payments:');
  console.log(JSON.stringify(results, null, 2));
}

main();
