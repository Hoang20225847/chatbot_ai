import { fetchWrapper } from "../helpers";

const GET_CURRENT_USER_PATH = "/api/auth/current_user";
const POST_LOGIN_PATH = "/api/auth/login";
const POST_SIGNUP_PATH = "/api/auth/signup";
const DELETE_LOGOUT_PATH = "/api/auth/logout";

export const getCurrentUserApi = async () => {
  return await fetchWrapper(GET_CURRENT_USER_PATH);
};

export const loginApi = async (email: string, password: string) => {
  return await fetchWrapper(POST_LOGIN_PATH, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
};

export const signupApi = async (email: string, password: string) => {
  return await fetchWrapper(POST_SIGNUP_PATH, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
};

export const logoutApi = async () => {
  return await fetchWrapper(DELETE_LOGOUT_PATH, {
    method: "DELETE",
  });
};
