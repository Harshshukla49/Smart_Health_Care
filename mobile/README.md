# Smart Health Mobile (M1 Scaffold)

This folder contains the M1 mobile bootstrap scaffold using React Native + Expo.

## Included in M1
- Expo app foundation
- Navigation skeleton (auth stack + app tabs)
- Auth session context with secure storage
- Axios API client with backend header contract
- Doctor login, patient login, doctor signup screens
- Dashboard and profile placeholders

## Slice C updates
- Realtime chat and message read/typing states
- Call signaling lifecycle: request/accept/reject/end
- Full camera/mic WebRTC media pipeline in chat screen
- SOS trigger/reset flow

## Setup
1. Copy .env values:
   - EXPO_PUBLIC_API_BASE_URL
   - EXPO_PUBLIC_SOS_API_BASE_URL
   - EXPO_PUBLIC_LOCAL_NETWORK_IP (required on physical phones)

Example for a real device (APK installed on phone):

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:5000
EXPO_PUBLIC_SOS_API_BASE_URL=http://localhost:5001
EXPO_PUBLIC_LOCAL_NETWORK_IP=192.168.1.25
```

Notes:
- On a phone, localhost points to the phone itself, not your PC.
- Keep backend running on your PC and use your PC LAN IP in EXPO_PUBLIC_LOCAL_NETWORK_IP.
- Ensure phone and PC are on the same Wi-Fi network.
2. Install dependencies:

```bash
cd mobile
npm install
```

3. Run app:

```bash
npm start
```

4. For WebRTC camera/mic support, run with a development build (not Expo Go):

```bash
npx expo run:android
```

or

```bash
npx expo run:ios
```

## Android and iOS build from Windows (recommended)
1. Login to Expo account:

```bash
npx eas-cli login
```

2. Check account:

```bash
npx eas-cli whoami
```

3. Configure EAS project if needed:

```bash
npx eas-cli build:configure --platform all
```

4. Build Android preview APK:

```bash
npx eas-cli build -p android --profile preview
```

5. Build iOS preview (cloud build):

```bash
npx eas-cli build -p ios --profile preview
```

6. Production builds:

```bash
npx eas-cli build -p android --profile production
npx eas-cli build -p ios --profile production
```

Notes:
- iOS build from Windows is supported through EAS cloud build.
- iOS distribution requires Apple Developer account setup in Expo/EAS flow.
- Keep commands executed from this folder.

## Contract notes
Headers injected by interceptor match backend expectations:
- Authorization
- X-User-Role
- X-User-Email
- X-Patient-Id
- X-Doctor-Email
- X-Doctor-Phone

## WebRTC permissions and plugin
- Config plugin: @config-plugins/react-native-webrtc
- Runtime package: react-native-webrtc
- iOS permissions: camera and microphone in app.json infoPlist
- Android permissions: CAMERA and RECORD_AUDIO in app.json
