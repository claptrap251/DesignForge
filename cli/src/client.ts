import https from "https";
import http from "http";

export interface ClientOptions {
  baseUrl: string;
  token?: string;
  verbose?: boolean;
}

export class DFClient {
  private baseUrl: string;
  private token?: string;
  private verbose: boolean;

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.token = opts.token;
    this.verbose = opts.verbose || false;
  }

  private log(msg: string) {
    if (this.verbose) process.stderr.write(`[dfcli] ${msg}\n`);
  }

  async request(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    retries = 1
  ): Promise<{ status: number; data: unknown }> {
    const url = `${this.baseUrl}${path}`;
    this.log(`${method} ${url}`);

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    let bodyStr: string | undefined;
    if (body) {
      bodyStr = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.rawRequest(method, url, headers, bodyStr);
        return result;
      } catch (err: unknown) {
        if (attempt < retries) {
          this.log(`Request failed, retrying... (${err instanceof Error ? err.message : String(err)})`);
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        throw err;
      }
    }

    throw new Error("Unreachable");
  }

  private rawRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: string
  ): Promise<{ status: number; data: unknown }> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === "https:" ? https : http;

      const req = lib.request(
        {
          hostname: parsed.hostname,
          port: parsed.port,
          path: parsed.pathname + parsed.search,
          method,
          headers,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            let parsed: unknown;
            try {
              parsed = JSON.parse(data);
            } catch {
              parsed = data;
            }
            resolve({ status: res.statusCode || 0, data: parsed });
          });
        }
      );

      req.on("error", reject);
      if (body) req.write(body);
      req.end();
    });
  }

  get isAuthenticated(): boolean {
    return !!this.token;
  }
}
