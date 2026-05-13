# Android SMS Native Module Example

This is a minimal Kotlin example for a native module that exposes an inbox reader to the React Native JS layer as `NativeModules.SmsReader`.

```kotlin
package com.cashtrack.sms

import android.provider.Telephony
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SmsReaderModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "SmsReader"

  @ReactMethod
  fun readInbox(promise: Promise) {
    try {
      val projection = arrayOf(
        Telephony.Sms._ID,
        Telephony.Sms.ADDRESS,
        Telephony.Sms.BODY,
        Telephony.Sms.DATE
      )

      val cursor = reactContext.contentResolver.query(
        Telephony.Sms.Inbox.CONTENT_URI,
        projection,
        null,
        null,
        "date DESC"
      )

      val results = Arguments.createArray()
      cursor?.use {
        val idIndex = it.getColumnIndexOrThrow(Telephony.Sms._ID)
        val addressIndex = it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
        val bodyIndex = it.getColumnIndexOrThrow(Telephony.Sms.BODY)
        val dateIndex = it.getColumnIndexOrThrow(Telephony.Sms.DATE)

        while (it.moveToNext()) {
          val row = Arguments.createMap()
          row.putString("id", it.getString(idIndex))
          row.putString("address", it.getString(addressIndex))
          row.putString("body", it.getString(bodyIndex))
          row.putString("date", it.getLong(dateIndex).toString())
          results.pushMap(row)
        }
      }

      promise.resolve(results)
    } catch (error: Throwable) {
      promise.reject("SMS_READ_FAILED", error)
    }
  }
}
```

Permissions the native side should support
- `android.permission.READ_SMS`
- optionally `android.permission.RECEIVE_SMS` if you also listen for broadcasts

JS contract expected by the app
- Module name: `SmsReader`
- Method: `readInbox()`
- Return value: an array of objects with at least a `body` field
