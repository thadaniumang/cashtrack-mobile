# SMS Ingestion (Android) — Implementation & Expo Guidance

This document explains how to provide an Android native SMS reader module for the CashTrack React Native app and how the JS layer expects to interact with it.

Summary
- The JS wrapper `src/lib/androidSms.ts` looks for a native module registered at `NativeModules.SmsReader` exposing `readInbox()`.
- `readSmsInbox()` in `src/lib/smsIngestion.ts` dynamically imports the helper and returns an array of SMS bodies for ingestion.

Required Android parts
- Runtime permission: `android.permission.READ_SMS` (dangerous). Request at runtime prior to calling the native reader.
- AndroidManifest additions (example):

  <uses-permission android:name="android.permission.RECEIVE_SMS" />
  <uses-permission android:name="android.permission.READ_SMS" />

Native module contract (recommended)
- Class name: `SmsReaderModule`
- JS registration key: `SmsReader` (so `NativeModules.SmsReader` is available)
- Exported method: `readInbox(): Promise<Array<{ id?: string; address?: string; body: string; date?: string }>>`

Example Kotlin (sketch)

```kotlin
class SmsReaderModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName(): String = "SmsReader"

  @ReactMethod
  fun readInbox(promise: Promise) {
    // Ensure READ_SMS permission; if missing, return empty array or reject
    val projection = arrayOf(Telephony.Sms.BODY, Telephony.Sms.ADDRESS, Telephony.Sms.DATE)
    val cursor = context.contentResolver.query(Telephony.Sms.Inbox.CONTENT_URI, projection, null, null, "date DESC")
    val results = Arguments.createArray()
    cursor?.use {
      while (it.moveToNext()) {
        val body = it.getString(it.getColumnIndexOrThrow(Telephony.Sms.BODY))
        val address = it.getString(it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS))
        val date = it.getLong(it.getColumnIndexOrThrow(Telephony.Sms.DATE))
        val obj = Arguments.createMap()
        obj.putString("body", body)
        obj.putString("address", address)
        obj.putString("date", Date(date).toString())
        results.pushMap(obj)
      }
    }
    promise.resolve(results)
  }
}
```

Expo / EAS considerations
- Expo managed apps do not include this native module by default. Options:
  - Use a custom dev client / EAS build and register the native module in your app.
  - Use a community module if one fits the needs (`expo-sms` is for sending SMS, not reading inbox).

Runtime flow in JS
1. Request `READ_SMS` permission using a permissions API (e.g., `react-native-permissions`) before calling ingestion.
2. Call `ingestSmsTransactions()`; it calls `readSmsInbox()` which dynamic-imports `androidSms` and calls `readInbox()`.
3. If native module is absent or permission denied, `readSmsInbox()` returns `[]` — ingestion is safe and no transactions will be created.

Security & privacy
- Reading SMS requires explicit user consent. Only use SMS ingestion when the user opts in.
- Log minimal diagnostics and never upload raw SMS bodies without explicit opt-in and a privacy policy.
