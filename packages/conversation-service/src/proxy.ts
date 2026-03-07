import { randomUUID } from "node:crypto";
import { isProviderAllowedForTenant, resolveProviderKeyRef } from "./policy.js";
import type { ConversationStore } from "./store.js";
import type { ConversationServiceConfig, ProviderProxyResponse } from "./types.js";

type ProxyProviderInput = {
  tenantId: string;
  provider: string;
  model?: string;
  prompt?: string;
  correlationId?: string;
};

type ProxyProviderResult =
  | { ok: true; response: ProviderProxyResponse }
  | { ok: false; status: 400 | 403; error: string };

export const proxyProviderRequest = (
  config: ConversationServiceConfig,
  store: ConversationStore,
  input: ProxyProviderInput,
): ProxyProviderResult => {
  if (!input.model || !input.prompt) {
    return { ok: false, status: 400, error: "invalid_provider_payload" };
  }

  if (!isProviderAllowedForTenant(config, input.tenantId, input.provider)) {
    store.appendAuditEvent({
      tenantId: input.tenantId,
      eventType: "provider.proxy.denied",
      actor: "provider-proxy",
      payload: {
        provider: input.provider,
        model: input.model,
        reason: "provider_not_allowed",
      },
    });
    return { ok: false, status: 403, error: "provider_not_allowed" };
  }

  const keyRef = resolveProviderKeyRef(config, input.tenantId, input.provider);
  if (!keyRef) {
    store.appendAuditEvent({
      tenantId: input.tenantId,
      eventType: "provider.proxy.denied",
      actor: "provider-proxy",
      payload: {
        provider: input.provider,
        model: input.model,
        reason: "provider_key_ref_not_configured",
      },
    });
    return { ok: false, status: 403, error: "provider_key_ref_not_configured" };
  }

  const requestId = randomUUID();
  const createdAt = new Date().toISOString();
  const completion = `[simulated:${input.provider}/${input.model}] ${input.prompt.slice(0, 96)}`;

  store.appendAuditEvent({
    tenantId: input.tenantId,
    eventType: "provider.proxy.invoked",
    actor: "provider-proxy",
    payload: {
      requestId,
      provider: input.provider,
      model: input.model,
      keyRef,
      correlationId: input.correlationId,
    },
    createdAt,
  });

  return {
    ok: true,
    response: {
      requestId,
      tenantId: input.tenantId,
      provider: input.provider,
      model: input.model,
      completion,
      keyRef,
      createdAt,
    },
  };
};
