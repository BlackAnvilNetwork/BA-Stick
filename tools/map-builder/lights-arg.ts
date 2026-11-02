// Prints FB_LIGHTS as scene_shot's lights argument: "x,z,kind[,radius];..."
import { FB_LIGHTS } from "@bellgrave/config";
const KIND = { fire: 0, lantern: 1, forge: 2, brazier: 3, lava: 4, crystal: 5, torch: 6 } as const;
process.stdout.write(FB_LIGHTS.map((l) => [l.x, l.z, KIND[l.kind], ...(l.radius ? [l.radius] : [])].join(",")).join(";"));
