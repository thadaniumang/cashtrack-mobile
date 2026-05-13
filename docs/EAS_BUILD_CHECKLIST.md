# EAS Build Checklist for SMS Ingestion

Use this checklist before building a custom dev client or APK/AAB for SMS reading.

1. Set environment variables
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

2. Enable the native SMS path
- Ensure the Android native module is registered as `SmsReader`.
- Confirm the JS wrapper `src/lib/androidSms.ts` resolves the module on Android.

3. Add Android permissions
- `android.permission.READ_SMS`
- optionally `android.permission.RECEIVE_SMS`

4. Use a custom build
- Expo Go will not include the SMS native module.
- Build a custom dev client or EAS APK/AAB that includes the native code.

5. Validate permissions flow
- Confirm the app requests `READ_SMS` only after explicit user consent.
- Verify the app handles deny/deny-permanently by falling back safely.

6. Smoke test the pipeline
- Call `requestReadSmsPermission()` from a UI action.
- Trigger `ingestSmsTransactions()` with a test SMS override.
- Confirm duplicate SMS messages are skipped by the JS deduper and by the DB-level `smsHash` pre-insert check.

7. Release hygiene
- Do not commit real env secrets.
- Keep raw SMS data out of logs unless explicitly needed for debugging.
