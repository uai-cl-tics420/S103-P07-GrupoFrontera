import { createAuthClient } from "better-auth/react";
import { adminClient, twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: "http://localhost:4000", //url servidor bun
    plugins: [
        adminClient(),
        twoFactorClient()
    ] 
});