// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE.

import { test } from "node:test";
import assert from "node:assert/strict";
import { SEAM_COUNTRY_ZONES, ZONE_FIELDS, seamCountryCamps, seamCountryNpcs } from "@bellgrave/config";
import { K, type Prop } from "../scripts/bake-props";
import { CAMP_SCATTER_CLEAR, seamCampProps, withSeamCamps } from "../scripts/zone-props/seam-country-camps";

test("every Seam Country camp gets a kit on walkable ground, clear of its giver", () => {
  for (const z of SEAM_COUNTRY_ZONES) {
    const f = ZONE_FIELDS[z]!;
    const props = seamCampProps(z);
    for (const c of seamCountryCamps().filter((c) => c.zoneId === z)) {
      const near = props.filter((p) => Math.hypot(p.x - c.x, p.z - c.z) < 3.5);
      assert.ok(near.length >= 4, `${c.id} has ${near.length} props`);
    }
    for (const p of props) {
      assert.ok(f.walkable(p.x, p.z) && !f.openWater(p.x, p.z), `${z} prop on bad ground at ${p.x},${p.z}`);
      for (const n of seamCountryNpcs().filter((n) => n.zoneId === z)) {
        assert.ok(Math.hypot(n.x - p.x, n.z - p.z) >= 1.2, `${n.id} blocked by a prop`);
      }
    }
  }
});

test("camp clearings are swept of scatter, other props kept", () => {
  const c = seamCountryCamps()[0]!;
  const scatter: Prop = { kind: K.pine, v: 0, x: c.x + 1, z: c.z, y: 0, yaw: 0, s: 1, w: 0, h: 0, d: 0 };
  const far: Prop = { ...scatter, x: c.x + CAMP_SCATTER_CLEAR + 2 };
  const out = withSeamCamps(c.zoneId, [scatter, far]);
  assert.ok(!out.includes(scatter));
  assert.ok(out.includes(far));
  assert.ok(out.length > 1);
});
