import crypto from "node:crypto";
import type { SkillArtifact } from "./types.js";

export const payloadToSign = (artifact: {
  tenantId: string;
  skillId: string;
  version: string;
  runtime: string;
  capabilityProfile: string;
  artifactDigest: string;
}): string =>
  [
    artifact.tenantId,
    artifact.skillId,
    artifact.version,
    artifact.runtime,
    artifact.capabilityProfile,
    artifact.artifactDigest,
  ].join(":");

export const signArtifact = (
  artifact: Omit<SkillArtifact, "signature" | "admitted" | "admittedReason" | "createdAt">,
  key: string,
): string =>
  crypto
    .createHmac("sha256", key)
    .update(
      payloadToSign({
        tenantId: artifact.tenantId,
        skillId: artifact.skillId,
        version: artifact.version,
        runtime: artifact.runtime,
        capabilityProfile: artifact.capabilityProfile,
        artifactDigest: artifact.artifactDigest,
      }),
    )
    .digest("hex");

export const verifySignature = (
  artifact: Omit<SkillArtifact, "admitted" | "admittedReason" | "createdAt">,
  key: string,
): boolean => {
  const expected = signArtifact(
    {
      tenantId: artifact.tenantId,
      skillId: artifact.skillId,
      version: artifact.version,
      runtime: artifact.runtime,
      capabilityProfile: artifact.capabilityProfile,
      artifactDigest: artifact.artifactDigest,
      sbomDigest: artifact.sbomDigest,
    },
    key,
  );
  return artifact.signature === expected;
};
