/**
 * Test-only: post a rooted epoch whose challenge delay has passed.
 * The caller supplies the bond total. This does not pick one for production.
 */
import {
  CHALLENGE_DELAY_MS,
  noteCertifiedBatch,
  postCertifiedBatch,
  resetRootAnchorForTests,
  setChallengeClockForTests,
  setPostedSlashableBonds,
  type CertifiedBatch,
} from "./root-anchor";

export async function allowEpochSettlementForTests(bondsWei: bigint): Promise<void> {
  resetRootAnchorForTests();
  let now = 1_700_000_000_000;
  setChallengeClockForTests(() => now);
  const root = new Uint8Array(32);
  root[31] = 1;
  const batch: CertifiedBatch = {
    height: 1,
    nextRoot: root,
    certificate: new Uint8Array([1]),
  };
  noteCertifiedBatch(batch);
  const posted = await postCertifiedBatch(batch, {
    env: { LOK_CHAIN_ID: "31337" },
    poster: async () => true,
  });
  if (!posted) throw new Error("epoch fixture anchor was not posted");
  now += CHALLENGE_DELAY_MS;
  setPostedSlashableBonds(bondsWei);
}
