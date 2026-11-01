import type { Prisma } from "../generated/prisma/client";
import type { UserView } from "../lib/contracts/user";
import { issueNewBuyerVoucher } from "./vouchers";

export type LoginHook = (transaction: Prisma.TransactionClient, user: UserView) => Promise<void>;

// Registration establishes the first session too. Read current eligibility from
// the transaction, not the potentially stale user object resolved before login.
export const afterAuthenticatedLogin: LoginHook = async (tx, user) => {
  await issueNewBuyerVoucher(tx, user.id);
};
