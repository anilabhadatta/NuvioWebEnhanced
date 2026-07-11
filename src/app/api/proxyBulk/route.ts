import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import https from "https";

export const runtime = "nodejs";

const agent = new https.Agent({
  ciphers:
    "TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256",
  honorCipherOrder: true,
  minVersion: "TLSv1.2",
});

const forbiddenHeaders = new Set([
  "host",
  "connection",
  "origin",
  "content-length",
  "sec-fetch-dest",
  "sec-fetch-mode",
  "sec-fetch-site",
  "sec-fetch-user",
  "sec-ch-ua",
  "sec-ch-ua-mobile",
  "sec-ch-ua-platform",
  "accept-encoding",
]);

interface BulkRequest {
  id: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface BulkResponse {
  id: string;
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  setCookies: string[];
  error?: string;
}

async function executeOne(req: BulkRequest): Promise<BulkResponse> {
  const { id, url, method = "GET", headers = {}, body } = req;
  const reqMethod = method.toUpperCase();

  const headersToSend: Record<string, string> = {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
  };

  Object.entries(headers).forEach(([k, v]) => {
    const key = k.toLowerCase();
    if (!forbiddenHeaders.has(key)) {
      headersToSend[key] = v;
    }
  });

  try {
    const response = await axios({
      url,
      method: reqMethod as any,
      headers: headersToSend,
      data: body || undefined,
      httpsAgent: agent,
      validateStatus: () => true,
      responseType: "text",
    });

    const responseHeaders: Record<string, string> = {};
    Object.entries(response.headers).forEach(([k, v]) => {
      if (v !== undefined) {
        responseHeaders[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : String(v);
      }
    });

    const setCookies: string[] = [];
    const rawCookies = response.headers["set-cookie"];
    if (rawCookies) {
      if (Array.isArray(rawCookies)) setCookies.push(...rawCookies);
      else setCookies.push(rawCookies);
    }

    return {
      id,
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      statusText: response.statusText || "",
      url,
      headers: responseHeaders,
      body: response.data || "",
      setCookies,
    };
  } catch (err: any) {
    return {
      id,
      ok: false,
      status: 0,
      statusText: "Network Error",
      url,
      headers: {},
      body: "",
      setCookies: [],
      error: String(err),
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { requests } = await req.json();

    if (!Array.isArray(requests) || requests.length === 0) {
      return NextResponse.json({ error: "Missing or empty requests array" }, { status: 400 });
    }

    // Execute all requests in parallel
    const responses = await Promise.all(requests.map((r: BulkRequest) => executeOne(r)));

    return NextResponse.json(
      { responses },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Bulk proxy failed", detail: String(err) },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
