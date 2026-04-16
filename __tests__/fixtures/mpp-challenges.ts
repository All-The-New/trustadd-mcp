// Sample WWW-Authenticate: Payment headers from MPP spec (IETF draft-ryan-httpauth-payment-00)
// Note: request is base64url-encoded JSON; use Buffer to decode in tests.

export const SINGLE_TEMPO_CHARGE = {
  header: `Payment id="abc123", realm="api.example.com", method="tempo", intent="charge", request="eyJhbW91bnQiOiIwLjAxIiwiY3VycmVuY3kiOiIweDIwYzAwMDAwMDAwMDAwMDAwMDAwMDAwMGI5NTM3ZDExYzYwZThiNTAiLCJyZWNpcGllbnQiOiIweDEyMzRhYmNkMTIzNGFiY2QxMjM0YWJjZDEyMzRhYmNkMTIzNGFiY2QifQ"`,
  expected: {
    id: "abc123",
    realm: "api.example.com",
    method: "tempo",
    intent: "charge",
    request: {
      amount: "0.01",
      currency: "0x20c000000000000000000000b9537d11c60e8b50",
      recipient: "0x1234abcd1234abcd1234abcd1234abcd1234abcd",
    },
  },
};

export const MULTI_METHOD = {
  headers: [
    `Payment id="tmp1", realm="api.example.com", method="tempo", intent="charge", request="eyJhbW91bnQiOiIwLjAxIn0"`,
    `Payment id="str1", realm="api.example.com", method="stripe", intent="charge", request="eyJhbW91bnQiOiIwLjAxIn0"`,
  ],
  expectedMethods: ["tempo", "stripe"],
};

export const MALFORMED_HEADER = {
  header: `Payment id="x`,
  expected: null,
};

export const NON_PAYMENT_AUTH = {
  header: `Bearer realm="api.example.com"`,
  expected: null,
};
