import { describe, expect, it } from "vitest";
import { signArtifact, verifySignature } from "./signature.js";

describe("signature verification", () => {
  it("validates correct signatures", () => {
    const key = "test-key";
    const base = {
      tenantId: "tenant-a",
      skillId: "skill-x",
      version: "1.0.0",
      runtime: "node",
      capabilityProfile: "http-readonly",
      artifactDigest: "sha256:abc",
      sbomDigest: "sha256:def",
    } as const;
    const signature = signArtifact(base, key);

    expect(
      verifySignature(
        {
          ...base,
          signature,
        },
        key,
      ),
    ).toBe(true);
  });

  it("rejects invalid signatures", () => {
    expect(
      verifySignature(
        {
          tenantId: "tenant-a",
          skillId: "skill-x",
          version: "1.0.0",
          runtime: "node",
          capabilityProfile: "http-readonly",
          artifactDigest: "sha256:abc",
          signature: "bad-signature",
        },
        "test-key",
      ),
    ).toBe(false);
  });
});
