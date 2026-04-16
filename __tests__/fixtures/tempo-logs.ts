// __tests__/fixtures/tempo-logs.ts
// Realistic log entries returned by eth_getLogs on Tempo pathUSD contract.

// Transfer(address indexed from, address indexed to, uint256 value)
// topic0 = keccak("Transfer(address,address,uint256)")
//        = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
export const TEMPO_TRANSFER_LOG = {
  address: "0x20c0000000000000000000000000000000000000",
  topics: [
    "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    "0x0000000000000000000000001111111111111111111111111111111111111111", // from (padded)
    "0x0000000000000000000000002222222222222222222222222222222222222222", // to (padded)
  ],
  data: "0x00000000000000000000000000000000000000000000000000000000000f4240", // 1_000_000 = 1 pathUSD (6 decimals)
  blockNumber: "0x1234",
  blockHash: "0xabc",
  transactionHash: "0xdeadbeef",
  transactionIndex: "0x0",
  logIndex: "0x0",
  removed: false,
};

// TransferWithMemo(address indexed from, address indexed to, uint256 value, bytes32 indexed memo)
// topic0 = placeholder hash (to be confirmed against Tempo spec during impl; use fixture for tests)
export const TEMPO_TRANSFER_WITH_MEMO_LOG = {
  address: "0x20c0000000000000000000000000000000000000",
  topics: [
    "0x" + "a".repeat(64), // placeholder event sig
    "0x0000000000000000000000001111111111111111111111111111111111111111",
    "0x0000000000000000000000002222222222222222222222222222222222222222",
    "0x6d656d6f31323300000000000000000000000000000000000000000000000000", // memo "memo123"
  ],
  data: "0x00000000000000000000000000000000000000000000000000000000001e8480", // 2_000_000 = 2 pathUSD
  blockNumber: "0x1235",
  blockHash: "0xdef",
  transactionHash: "0xfeedface",
  transactionIndex: "0x1",
  logIndex: "0x0",
  removed: false,
};

export const EXPECTED_TRANSFER = {
  from: "0x1111111111111111111111111111111111111111",
  to: "0x2222222222222222222222222222222222222222",
  amount: "1.0", // 1 pathUSD
  amountRaw: "1000000",
  txHash: "0xdeadbeef",
  blockNumber: 0x1234,
};
