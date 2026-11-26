# English Coach: mobile app

React Native (Expo SDK 58, Expo Router) client for the same FastAPI backend and Supabase sign-in as `apps/web`. Screens follow the Figma design.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the same Supabase URL and public key as the web app. Set `EXPO_PUBLIC_API_URL`:
   - phone on the same Wi-Fi: `http://<your-PC-LAN-IP>:8000`, and start the API with `--host 0.0.0.0`
   - Android emulator: `http://10.0.2.2:8000`
3. Google sign-in: in Supabase > Authentication > URL Configuration, add `englishcoach://auth-callback` to Redirect URLs. In Expo Go the link is `exp://<ip>:8081/--/auth-callback` instead; add that too while developing.
4. `npx expo start`, then open the app in Expo Go or a development build.

## How it talks to the API

- `src/lib/api.ts` sends the Supabase access token as `Authorization: Bearer`, like the web app.
- Recordings: the API accepts only 16 kHz mono 16-bit WAV. `src/lib/audio.ts` streams raw microphone PCM (`expo-audio` `useAudioStream`) and `src/lib/wav.ts` writes that WAV. Check: `node src/lib/wav.check.ts <dir>`.
- AI voice: base64 MP3 from the API is played; on plans without it, the phone's own voice (`expo-speech`) reads the text.
- Payments: Razorpay Standard Checkout in a web view, verified by `/v1/payments/verify`, as on the web.

## Checks

```
npx tsc --noEmit
npx expo lint
```
