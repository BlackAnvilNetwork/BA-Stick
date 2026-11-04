import { BuilderClient } from "./client";
async function main() {
const c = new BuilderClient(process.env.WS ?? "ws://localhost:8797", "Fernwright");
await c.connect();
console.log("in", c.zone, c.snapshot.you.characterId);
c.cast("map_enter");
await new Promise((r) => setTimeout(r, 800));
c.cast("map_raise", "g:0,10,6,1");
await new Promise((r) => setTimeout(r, 800));
console.log(c.logs.slice(-5), "patched", c.patched);
c.close();

}
void main();