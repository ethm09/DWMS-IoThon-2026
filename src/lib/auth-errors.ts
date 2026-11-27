/** Public guidance for known account-sync failures, without exposing backend errors. */
export function accountSyncErrorMessage(error: unknown): string {
  const data = error && typeof error === "object" && "data" in error
    ? error.data
    : null;
  const code = data && typeof data === "object" && "code" in data
    ? data.code
    : null;
  if (code === "EMAIL_NOT_VERIFIED") {
    return "Verify your sign-in email address, then sign in again to link your existing DWMS account.";
  }
  if (code === "AMBIGUOUS_IDENTITY") {
    return "Your email matches more than one DWMS account. Ask the platform administrator to resolve the account link before trying again.";
  }
  return "Your identity was signed in, but the monitoring account could not be registered. Please try again or contact the platform administrator.";
}
