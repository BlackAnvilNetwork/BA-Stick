// Prints FB_LIGHTS as scene_shot's lights argument: "x,z,kind[,radius];..."
import { FB_LIGHTS, FB_POIS } from "@bellgrave/config";
const KIND = { fire: 0, lantern: 1, forge: 2, brazier: 3, lava: 4, crystal: 5, torch: 6 } as const;
const all = [...FB_LIGHTS, ...FB_POIS.filter((p) => p.light).map((p) => ({ x: p.x + 0.6, z: p.z + 0.6, kind: p.light!, radius: p.light === "crystal" ? 4 : undefined }))];
process.stdout.write(all.map((l) => [l.x, l.z, KIND[l.kind], ...(l.radius ? [l.radius] : [])].join(",")).join(";"));
