import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

const isProd = typeof window != "undefined" && !window.location.hostname.includes("localhost");

export const authClient = createAuthClient({
    baseURL: isProd ? "https://panoramapp.onrender.com" : "http://localhost:4000",
    plugins: [
        adminClient(),
    ]
});