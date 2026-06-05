// Diagnostic helper: trace SMS matching for your exact SMS
import { parseSmsForTransaction, matchCardFromSms } from './src/lib/smsIngestion';

const testSms = "Spent Rs. 1500 on HDFC Credit Card 1385";

// Simulate what your cards might be
const scenarios = [
  {
    name: "No cards configured",
    cards: [],
  },
  {
    name: "HDFC card with exact last4 match",
    cards: [{ id: 'card-1', name: 'HDFC Credit Card 1385', aliases: ['HDFC'] }],
  },
  {
    name: "HDFC card without last4",
    cards: [{ id: 'card-1', name: 'HDFC Bank', aliases: [] }],
  },
  {
    name: "Generic credit card (no issuer match)",
    cards: [{ id: 'card-1', name: 'My Credit Card', aliases: [] }],
  },
  {
    name: "Single card fallback",
    cards: [{ id: 'card-1', name: 'Some Random Card', aliases: [] }],
  },
  {
    name: "Multiple cards with no HDFC match",
    cards: [
      { id: 'card-1', name: 'ICICI Card', aliases: [] },
      { id: 'card-2', name: 'Axis Bank', aliases: [] },
    ],
  },
];

console.log("SMS: " + testSms);
console.log("\nParsing SMS...");
const parsed = parseSmsForTransaction(testSms);
console.log("Amount:", parsed.amount);
console.log("Diagnostics:", parsed.parserDiagnostics);

scenarios.forEach((scenario) => {
  console.log(`\n--- Scenario: ${scenario.name} ---`);
  console.log(`Cards: ${scenario.cards.length > 0 ? scenario.cards.map((c) => c.name).join(", ") : "None"}`);

  // Simulate the ingestion logic
  let accountHint = parsed.accountHint;
  if (!accountHint) {
    const smsNorm = parsed.rawMessage.toLowerCase();
    for (const card of scenario.cards) {
      const namesToTry = [card.name].concat(card.aliases || []);
      if (namesToTry.some((n) => n && smsNorm.includes(n.toLowerCase()))) {
        accountHint = card.name;
        break;
      }
    }
  }
  if (!accountHint) {
    accountHint = parsed.rawMessage;
  }

  console.log(`Account Hint: "${accountHint}"`);

  const match = matchCardFromSms(accountHint, scenario.cards, parsed.rawMessage);
  console.log(`Match Result:`, match);

  // Check if SMS would be created
  let finalCardId = match.cardId;
  if (!finalCardId || match.confidence < 0.55) {
    if (scenario.cards.length === 1) {
      finalCardId = scenario.cards[0].id;
      console.log(`✓ Fallback to single card: ${finalCardId}`);
    } else if (!finalCardId) {
      console.log(`✗ No card matched and not eligible for fallback (${scenario.cards.length} cards)`);
    }
  }

  if (finalCardId && parsed.amount !== null) {
    console.log(`✓ SMS WOULD BE CREATED on card ${finalCardId}`);
  } else {
    console.log(`✗ SMS WOULD BE REJECTED`);
    if (!finalCardId) console.log(`  Reason: No card ID`);
    if (parsed.amount === null) console.log(`  Reason: No amount`);
  }
});
