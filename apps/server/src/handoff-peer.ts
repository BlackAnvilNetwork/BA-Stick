/**
 * One OS process hosting one replica. Commands arrive as JSON lines on stdin.
 * Replies are JSON lines on stdout. The parent drives logical time.
 */
import { createInterface } from "node:readline";
import { createReplica, handle, type Command, type Role } from "./handoff-protocol";

function flag(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value) {
    process.stderr.write(`missing ${name}\n`);
    process.exit(1);
  }
  return value;
}

function isRole(value: string): value is Role {
  return value === "leader" || value === "follower";
}

async function main(): Promise<void> {
  const id = flag("--id");
  const role = flag("--role");
  if (!isRole(role)) {
    process.stderr.write("role must be leader or follower\n");
    process.exit(1);
  }
  let replica = createReplica(id, role);
  const send = (body: unknown) => {
    process.stdout.write(`${JSON.stringify(body)}\n`);
  };
  send({ ready: true });
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let command: Command;
    try {
      command = JSON.parse(trimmed) as Command;
    } catch {
      send({ ok: false, reason: "bad-json", messages: [], snapshot: replica });
      continue;
    }
    try {
      const step = handle(replica, command);
      replica = step.replica;
      send({ ok: step.ok, reason: step.reason, messages: step.messages, snapshot: step.replica });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "throw";
      send({ ok: false, reason, messages: [], snapshot: replica });
    }
  }
}

const launched = process.argv.includes("--id");
if (launched) {
  main().catch((err: unknown) => {
    const reason = err instanceof Error ? err.message : "throw";
    process.stderr.write(`${reason}\n`);
    process.exit(1);
  });
}
