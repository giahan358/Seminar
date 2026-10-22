const ACCESS_KEY  = "accessToken";
const REFRESH_KEY = "refreshToken";
const USER_KEY    = "currentUser";

export const getAccessToken  = () => sessionStorage.getItem(ACCESS_KEY);
export const getRefreshToken = () => sessionStorage.getItem(REFRESH_KEY);
export const getCurrentUser  = () => {
  try { return JSON.parse(sessionStorage.getItem(USER_KEY) || "null"); }
  catch { return null; }
};

export const setSession = ({ accessToken, refreshToken, user }) => {
  if (accessToken)  sessionStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken);
  if (user)         sessionStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearSession = () => {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(USER_KEY);
};