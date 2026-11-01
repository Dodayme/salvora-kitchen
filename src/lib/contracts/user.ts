export type UserView = { id: string; name: string; email: string; role: "BUYER" | "ADMIN" };

// Whitelist output. Never serialize an ORM user/session record directly.
export function userView(user: UserView): UserView {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
