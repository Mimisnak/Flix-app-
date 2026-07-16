// signUp() creates a session immediately, which independently fires a
// SIGNED_IN auth event — that races against RegisterScreen's own sequential
// create_user_profile() RPC call. If AppNavigator's SIGNED_IN handler
// queries the users table before that RPC has inserted the profile row, it
// finds nothing and shows a "account not found" alert moments before
// RegisterScreen's own real success alert. Set true right before signUp(),
// false once the register flow has signed back out; AppNavigator's
// SIGNED_IN handler skips its own query entirely while this is true.
export const registrationGuard = { inProgress: false };
