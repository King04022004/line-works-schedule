import { Router } from "express";

const users = [
  // NOTE:
  // `id` is used as `/users/{userId}` in LINE WORKS API calls.
  // Keep this as a real LINE WORKS user identifier (login ID / user ID).
  { id: "hr.94319@hrdcorporation", name: "鉢呂元輝", email: "hr.94319@hrdcorporation" },
  { id: "hr.01106@hrdcorporation", name: "丸林勇登", email: "hr.01106@hrdcorporation" },
  { id: "hr.66275@hrdcorporation", name: "宮部啓史", email: "hr.66275@hrdcorporation" },
  { id: "hr.34420@hrdcorporation", name: "山本裕也", email: "hr.34420@hrdcorporation" },
  {
    id: "taniguchi.kyoshiro@hrdcorporation",
    name: "谷口強志郎",
    email: "taniguchi.kyoshiro@hrdcorporation"
  }
];

const groups = [
  { id: "g001", name: "開発部" },
  { id: "g002", name: "営業部" }
];

const groupMembers: Record<string, string[]> = {
  g001: ["hr.94319@hrdcorporation", "hr.01106@hrdcorporation", "taniguchi.kyoshiro@hrdcorporation"],
  g002: ["hr.66275@hrdcorporation", "hr.34420@hrdcorporation"]
};

export const directoryRouter = Router();

directoryRouter.get("/members", (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const items = users
    .filter(
      (u) =>
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
    )
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
