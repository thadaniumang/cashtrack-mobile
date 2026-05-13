SMS Ingestion — Implementation Notes

Purpose:
- Scaffold for reading Android SMS inbox and ingesting parsed messages as pending system transactions.

What is implemented:
- `readSmsInbox()` — safe JS scaffold that returns `[]` in non-native/test environments.
- `parseSmsForTransaction()` — parses amount from SMS text.
- `matchCardFromSms()` — lightweight fuzzy matcher (token overlap + Levenshtein) with threshold 0.5.
- `ingestSmsTransactions(userId, userCards, smsListOverride?)` — processes SMS messages (or provided override), creates pending transactions via `addTransaction()` when a confident match and amount are found, and returns ingestion results.

How to implement native SMS read (Android) in Expo / React Native:
1. Permissions
   - Android requires `READ_SMS` permission. In an Expo-managed project you must use EAS with a custom Android build (not plain Expo Go) and add the permission to `app.json`/`app.config.js` or `AndroidManifest.xml` in the native project.
2. Native module options
   - Use a small native module to read SMS inbox entries. Options:
     - Implement a custom native module in Android (Kotlin/Java) that exposes a method to query the SMS content provider and return messages.
     - Use a community library (if available and maintained) that supports reading SMS on Android. Verify compatibility with Expo EAS builds.
3. Implementation notes
   - Return only recent unread messages (or messages since last ingest timestamp) to avoid duplicates.
   - Ensure the module returns plain JS strings (UTF-8).
   - Provide a minimal envelope: `{ id, date, sender, body }` — `smsIngestion.ts` currently expects the message body string.
4. Security & Privacy
   - Asking for `READ_SMS` is sensitive; present a clear consent flow to users before requesting the permission.
   - Store only necessary ingestion metadata and avoid transmitting raw SMS content to remote servers unless explicitly consented.

Testing locally
- Use `ingestSmsTransactions(userId, userCards, smsListOverride)` with `smsListOverride` to supply test messages without device SMS access.

Example test invocation (from repo root):
```bash
cd cashtrack-native
node -e "(async()=>{const lib=require('./dist/src/lib/smsIngestion');console.log(await lib.ingestSmsTransactions('user-1',[{id:'1',name:'HDFC Bank'}],['Your HDFC Bank A/C debited INR 123.45']))})();"
```

Notes
- `addTransaction()` is used to create pending transactions; ensure `transactionWriteService` DB hooks are implemented for your environment.
