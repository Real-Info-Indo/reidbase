import { createClient, OAuthStrategy } from "@wix/sdk";
import { members } from "@wix/members";
import { orders } from "@wix/pricing-plans";

const WIX_CLIENT_ID = "b334574a-41db-47ee-833c-36d7e15c806e";

export const wixClient = createClient({
  modules: { members, orders },
  auth: OAuthStrategy({
    clientId: WIX_CLIENT_ID,
  }),
});
