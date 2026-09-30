import { singleton } from "./di";

const list = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

// The UI's environment. Secrets are read when first needed, so a missing one fails the request
// that uses it with a clear message instead of the build.
@singleton()
export class Config {
  readonly publicUiUrl = process.env.PUBLIC_UI_URL ?? "http://localhost:3001";
  readonly kratosPublicUrl = process.env.KRATOS_INTERNAL_URL ?? "http://localhost:4433";
  readonly kratosAdminUrl = process.env.KRATOS_ADMIN_URL ?? "http://localhost:4434";
  readonly hydraAdminUrl = process.env.HYDRA_ADMIN_URL ?? "http://localhost:4445";
  readonly hydraJwksUrl = process.env.HYDRA_JWKS_URL ?? "http://localhost:4444/.well-known/jwks.json";
  readonly jwtIssuer = process.env.JWT_ISSUER ?? "http://localhost:4444/";
  readonly apiAudience = process.env.API_AUDIENCE ?? "bus-api";
  readonly corsAllowedOrigins = list(process.env.CORS_ALLOWED_ORIGINS);
  readonly kafkaBrokers = list(process.env.KAFKA_BROKERS ?? "localhost:19092");
  readonly kafkaTopic = process.env.KAFKA_TOPIC_EVENTS ?? "idp.events";
  readonly kafkaClientId = process.env.KAFKA_CLIENT_ID ?? "idp-ui";
  readonly authzInternalUrl = process.env.AUTHZ_INTERNAL_URL ?? "http://localhost:8091";
  // LOCAL DEV ONLY (docker-compose): never set in the chart.
  readonly devStaticOtp = process.env.DEV_STATIC_OTP;
  readonly devLogLinks = !!process.env.DEV_LOG_EMAIL_LINKS;

  get cookieSecret() { return required("UI_COOKIE_SECRET"); }
  get emailTokenSecret() { return required("EMAIL_TOKEN_SECRET"); }
  get inviteTokenSecret() { return required("INVITE_TOKEN_SECRET"); }

  // Cookies are Secure when the UI is served over https.
  get secureCookies() { return this.publicUiUrl.startsWith("https://"); }

  // Where to send people who open an auth page directly (UI_FALLBACK_URL, e.g. the company
  // site). Only http/https are accepted; anything else counts as unset.
  get fallbackUrl(): string | null {
    try {
      const u = new URL(process.env.UI_FALLBACK_URL ?? "");
      return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
    } catch {
      return null;
    }
  }
}
