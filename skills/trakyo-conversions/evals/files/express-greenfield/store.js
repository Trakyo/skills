// In-memory store; swapped for Postgres in production with the same interface.
const usersById = new Map();
const ordersById = new Map();
let seq = 1;

const users = {
  create({ email, name }) {
    const user = { id: `usr_${seq++}`, email, name, createdAt: new Date() };
    usersById.set(user.id, user);
    return user;
  },
  get(id) {
    return usersById.get(id) || null;
  },
  update(id, patch) {
    const u = usersById.get(id);
    if (!u) return null;
    Object.assign(u, patch);
    return u;
  },
};

const orders = {
  create({ userId, plan, amountCents, currency }) {
    const order = { id: `ord_${seq++}`, userId, plan, amountCents, currency, status: "pending", createdAt: new Date() };
    ordersById.set(order.id, order);
    return order;
  },
  markPaid(id, { paidAt, providerRef }) {
    const o = ordersById.get(id);
    if (!o) return null;
    Object.assign(o, { status: "paid", paidAt, providerRef });
    return o;
  },
};

module.exports = { users, orders };
