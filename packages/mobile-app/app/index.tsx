import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect to auth onboarding by default — the root layout
  // will check if user is onboarded and redirect accordingly.
  return <Redirect href="/(auth)/onboarding" />;
}
