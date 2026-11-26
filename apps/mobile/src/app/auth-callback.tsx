import { Redirect } from "expo-router";

// Google sign-in returns here; sign-in.tsx has already exchanged the code, so just go home.
export default function AuthCallback() {
  return <Redirect href="/" />;
}
