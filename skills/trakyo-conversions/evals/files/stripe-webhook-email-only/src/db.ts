/** Minimal data layer (Postgres via knex in the real app). */
export interface User {
  id: string;
  email: string;
  name: string | null;
  paid_session_id: string | null;
  created_at: Date;
}

export const db = {
  users: {
    async upsert(input: { email: string; name: string | null }): Promise<User> {
      // INSERT ... ON CONFLICT (email) DO UPDATE SET name = COALESCE(EXCLUDED.name, users.name)
      return { id: "usr_1", email: input.email, name: input.name, paid_session_id: null, created_at: new Date() };
    },
    async findByEmail(email: string): Promise<User | null> {
      return null;
    },
    async markPaid(email: string, sessionId: string): Promise<void> {
      // UPDATE users SET paid_session_id = $2 WHERE email = $1
    },
  },
};
