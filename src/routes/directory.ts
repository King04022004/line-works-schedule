import { Router } from "express";

const users = [
  { id: "u001", name: "山田 太郎", email: "taro@example.com" },
  { id: "u002", name: "佐藤 花子", email: "hanako@example.com" },
  { id: "u003", name: "鈴木 一郎", email: "ichiro@example.com" },
  { id: "u004", name: "田中 次郎", email: "jiro@example.com" }
];

const groups = [
  { id: "g001", name: "開発部" },
  { id: "g002", name: "営業部" }
];

const groupMembers: Record<string, string[]> = {
  g001: ["u001", "u002", "u003"],
  g002: ["u002", "u004"]
};

export const directoryRouter = Router();

directoryRouter.get("/members", (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const items = users
    .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    .slice(0, limit);
  res.json({ items });
});

directoryRouter.get("/groups", (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const items = groups.filter((g) => !q || g.name.toLowerCase().includes(q)).slice(0, limit);
  res.json({ items });
});

directoryRouter.get("/groups/:groupId/members", (req, res) => {
  const ids = groupMembers[req.params.groupId] ?? [];
  const items = users.filter((u) => ids.includes(u.id));
  res.json({ items });
});
