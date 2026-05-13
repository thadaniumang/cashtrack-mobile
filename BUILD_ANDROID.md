Steps to build a production APK (fast, recommended: EAS)

1) Install EAS CLI

```bash
npm install -g eas-cli
```

2) Login to Expo / EAS

```bash
eas login
```

3) Configure EAS for this project (creates/updates native config if needed)

```bash
# run in cashtrack-native folder
eas build:configure
```

4) Start a production Android APK build

```bash
# builds an installable APK; choose to let EAS manage credentials when prompted
eas build --platform android --profile production
```

5) Download the APK (EAS will show a URL) or run:

```bash
eas build:download --platform android --id <BUILD_ID>
```

6) Install APK on a connected device

```bash
adb install -r path/to/your-app.apk
```

Notes
- Use `buildType: "app-bundle"` in `eas.json` to produce an AAB for Play Store instead of an APK.
- If you prefer a local release build (no EAS), run `expo run:android --variant=release` but ensure Android SDK, keystore, and signing config are set up.
- I can run `eas.json` creation (done) and help with `eas build:configure` suggestions if you want me to add keystore config files to the repo.
