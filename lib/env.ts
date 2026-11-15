const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

export const env = {
  apiBaseUrl: (apiBaseUrl || 'http://localhost:5000/api/v1').replace(/\/$/, ''),
} as const;
