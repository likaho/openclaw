import type { Request, Response } from "express";

export type UpstreamKind = "onboarding" | "channels" | "skills" | "auth";

export type ProxyConfig = {
  onboardingBaseUrl: string;
  identityBaseUrl: string;
};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const buildUrl = (baseUrl: string, path: string, queryString: string): string =>
  `${trimTrailingSlash(baseUrl)}${path}${queryString}`;

export const resolveUpstreamUrl = (
  config: ProxyConfig,
  kind: UpstreamKind,
  subPath: string,
  queryString: string,
): string => {
  if (kind === "auth") {
    return buildUrl(config.identityBaseUrl, `/v1/auth${subPath}`, queryString);
  }
  return buildUrl(config.onboardingBaseUrl, `/v1/${kind}${subPath}`, queryString);
};

const payloadForRequest = (req: Request): BodyInit | undefined => {
  if (req.method === "GET" || req.method === "HEAD") {
    return undefined;
  }
  if (req.body === undefined) {
    return undefined;
  }
  return JSON.stringify(req.body);
};

export const proxyJsonRequest = async (
  req: Request,
  res: Response,
  targetUrl: string,
): Promise<void> => {
  const response = await fetch(targetUrl, {
    method: req.method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: payloadForRequest(req),
  });

  const responseContentType = response.headers.get("content-type") ?? "application/json";
  const responseText = await response.text();
  res.status(response.status);
  res.setHeader("content-type", responseContentType);
  res.send(responseText);
};
