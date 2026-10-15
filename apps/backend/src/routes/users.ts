import { Router } from "express";
import { getJobs } from "../jobs/jobStore.js";
import { quotaFor } from "../users.js";

/** Guest-code self-service: quota + print history (issue #18). */
export function createUsersRouter(): Router {
  const router = Router();

  router.use("/users/me", (req, res, next) => {
    if (!req.header("x-user-id")?.trim()) {
      return res.status(401).json({ error: "Guest code required (x-user-id)" });
    }
    next();
  });

  router.get("/users/me/quota", async (req, res) => {
    const userId = req.header("x-user-id")!.trim();
    return res.json(await quotaFor(userId));
  });

  router.get("/users/me/history", async (req, res) => {
    const userId = req.header("x-user-id")!.trim();
    const jobs = (await getJobs().list())
      .filter((j) => j.userId === userId)
      .map((j) => {
        const { accessToken: _t, fileUrl: _f, userId: _u, ...safe } = j;
        void _t;
        void _f;
        void _u;
        return safe;
      });
    return res.json({ userId, jobs });
  });

  return router;
}
