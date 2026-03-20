import { Router } from "express";

const users = [
  { id: "u001", name: "鉢呂元輝", email: "hr.94319@hrdcorporation" },
  { id: "u002", name: "丸林勇登", email: "hr.01106@hrdcorporation" },
  { id: "u003", name: "宮部啓史", email: "hr.66275@hrdcorporation" },
  { id: "u004", name: "山本裕也", email: "hr.34420@hrdcorporation" },
  { id: "u005", name: "谷口強志郎", email: "taniguchi.kyoshiro@hrdcorporation" }
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
