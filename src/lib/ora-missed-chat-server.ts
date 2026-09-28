import { getSql } from "./db.ts";
import {
  ensureMissedChatTables,
  noteAdvisorHeartbeatWith,
  settleMissedChatsWith,
  sweepDisconnectedAdvisorsWith,
} from "./ora-missed-chat-api.ts";

export async function settleMissedChats(opts: { advisorId?: string; requestId?: string } = {}) {
  const sql = await getSql();
  return settleMissedChatsWith(sql, opts);
}

export async function noteAdvisorHeartbeat(advisorId: string) {
  const sql = await getSql();
  return noteAdvisorHeartbeatWith(sql, advisorId);
}

export async function sweepDisconnectedAdvisors(force = false) {
  const sql = await getSql();
  return sweepDisconnectedAdvisorsWith(sql, force);
}

export async function ensureMissedChatSchema() {
  const sql = await getSql();
  await ensureMissedChatTables(sql);
}
