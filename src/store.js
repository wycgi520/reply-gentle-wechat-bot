import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_PROFILE } from "./ai302.js";

export class UserStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, "users.json");
    this.writeQueue = Promise.resolve();
  }

  async getUser(openid) {
    const users = await this.readAll();
    return normalizeUser(users[openid] || {});
  }

  async updateUser(openid, patch) {
    return this.withWrite(async () => {
      const users = await this.readAll();
      const current = normalizeUser(users[openid] || {});
      const next = normalizeUser({
        ...current,
        ...patch,
        profile: {
          ...current.profile,
          ...(patch.profile || {})
        }
      });
      users[openid] = next;
      await this.writeAll(users);
      return next;
    });
  }

  async readAll() {
    try {
      const text = await fs.readFile(this.filePath, "utf8");
      return JSON.parse(text);
    } catch (error) {
      if (error.code === "ENOENT") {
        return {};
      }
      throw error;
    }
  }

  async writeAll(users) {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(users, null, 2), "utf8");
  }

  async withWrite(fn) {
    const next = this.writeQueue.then(fn, fn);
    this.writeQueue = next.catch(() => {});
    return next;
  }
}

export function normalizeUser(user) {
  return {
    profile: {
      ...DEFAULT_PROFILE,
      ...(user.profile || {})
    },
    lastContextInput: user.lastContextInput || null,
    lastSuggestions: Array.isArray(user.lastSuggestions) ? user.lastSuggestions : [],
    updatedAt: user.updatedAt || ""
  };
}

