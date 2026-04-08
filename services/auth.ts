import {
  confirmResetPassword,
  resetPassword,
  signIn,
  signOut,
  signUp,
} from "aws-amplify/auth";

export const handleSignIn = async (email: string, password: string) => {
  return signIn({
    username: email,
    password,
  });
};

export const handleSignUp = async (email: string, password: string, firstName?: string, lastName?: string) => {
  return signUp({
    username: email,
    password,
    options: {
      userAttributes: {
        email,
        ...(firstName ? { given_name: firstName } : {}),
        ...(lastName ? { family_name: lastName } : {}),
      },
    },
  });
};

export const handleResetPassword = async (email: string) => {
  return resetPassword({ username: email });
};

export const handleConfirmResetPassword = async (
  email: string,
  confirmationCode: string,
  newPassword: string
) => {
  return confirmResetPassword({
    username: email,
    confirmationCode,
    newPassword,
  });
};

export const handleSignOut = async () => {
  return signOut();
};
