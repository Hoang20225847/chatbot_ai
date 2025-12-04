export const fetchWrapper = async (url: string, options?: RequestInit) => {
  const response = await fetch(
    url,
    options
      ? {
          ...options,
          headers: {
            ...options.headers,
            "Content-Type": "application/json",
          },
        }
      : undefined
  );
  if (!response.ok) {
    const error = await response.text();
    throw error;
  }
  // status 204 response has no body and will throw an error from json()
  return response.json().catch(() => null);
};
