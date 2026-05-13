import { parseSmsForTransaction, matchCardFromSms } from './src/lib/smsIngestion.ts';

const sms = "Spent Rs. 1500 on HDFC Credit Card 1385";
console.log("=== Testing SMS ===");
console.log("SMS:", sms);

const parsed = parseSmsForTransaction(sms);
console.log("\n=== Parser Output ===");
console.log("Amount:", parsed.amount);
console.log("Account Hint:", parsed.accountHint);
console.log("Diagnostics:", parsed.parserDiagnostics);

// Simulate user cards - we need to know what cards they have
// For now, simulate an HDFC card
const userCards = [
  { id: 'card-1', name: 'HDFC Credit Card 1385', aliases: ['HDFC', 'HDFC CC'] }
];

console.log("\n=== Simulating Card Matching ===");
console.log("User Cards:", userCards.map(c => c.name));

// The ingestion logic would use the full message as accountHint if parser didn't extract one
let accountHint = parsed.accountHint || sms;
console.log("Account Hint for Matcher:", accountHint);

const match = matchCardFromSms(accountHint, userCards, sms);
console.log("\n=== Match Result ===");
console.log("Matched Card ID:", match.cardId);
console.log("Confidence:", match.confidence);
console.log("Reason:", match.reason);
