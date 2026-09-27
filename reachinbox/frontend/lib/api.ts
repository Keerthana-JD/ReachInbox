import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Every request carries the logged-in user's email in a header so the
// backend can scope data to that user (a simple stand-in for full sessions).
export function apiClient(userEmail: string) {
  return axios.create({
    baseURL: API_URL,
    headers: { "x-user-email": userEmail },
  });
}

export { API_URL };
