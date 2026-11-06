import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseChatCommand, parseClientMessage, sanitizeChatText } from "@bellgrave/protocol";

describe("chat text", () => {
  it("rejects blank and control-only strings", () => {
    assert.equal(sanitizeChatText("   "), null);
    assert.equal(sanitizeChatText("\n\t"), null);
    assert.equal(sanitizeChatText(""), null);
  });

  it("collapses space and caps length", () => {
    assert.equal(sanitizeChatText("  hello   there  "), "hello there");
    assert.equal(sanitizeChatText("x".repeat(200))?.length, 140);
  });

  it("routes /p and /party to party, everything else to say", () => {
    assert.deepEqual(parseChatCommand("/p hold the gate"), { channel: "party", text: "hold the gate" });
    assert.deepEqual(parseChatCommand("/party  wait"), { channel: "party", text: "wait" });
    assert.deepEqual(parseChatCommand("/s hello"), { channel: "say", text: "hello" });
    assert.deepEqual(parseChatCommand("hello"), { channel: "say", text: "hello" });
    assert.equal(parseChatCommand("/p"), null);
  });

  it("accepts a chat client message", () => {
    const msg = parseClientMessage({ type: "chat", text: "hello" });
    assert.deepEqual(msg, { type: "chat", text: "hello" });
  });
});
