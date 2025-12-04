import { useEffect, useState, SyntheticEvent } from "react";

import { useLogin, useSignup } from "../../store/auth";

const useAuthForm = (loginView: boolean) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordValidationError, setPasswordValidationError] = useState("");
  const { login, error: loginError, clearError: clearLoginError } = useLogin();
  const {
    signup,
    error: signupError,
    clearError: clearSignupError,
  } = useSignup();

  const error = loginError || signupError || passwordValidationError;

  const clearError = () => {
    setPasswordValidationError("");
    clearLoginError();
    clearSignupError();
  };

  useEffect(() => {
    clearError();
  }, [loginView]);

  const isValidPassword = () => {
    if (password.length < 8) {
      setPasswordValidationError(
        "Password must be at least 8 characters long."
      );
      return false;
    }
    if (password !== confirmPassword) {
      setPasswordValidationError("Passwords do not match.");
      return false;
    }
    return true;
  };

  const handleContinue = (e: SyntheticEvent) => {
    e.preventDefault();
    clearError();
    if (loginView) {
      login(email, password);
    } else if (isValidPassword()) {
      signup(email, password);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    handleContinue,
    error,
    clearError,
  };
};

export default useAuthForm;
