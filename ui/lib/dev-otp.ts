import { Config } from "./config";
import { inject, singleton } from "./di";
import { KratosAdmin } from "./identity";

// LOCAL DEV ONLY: with DEV_STATIC_OTP set, that code is swapped for the real one Kratos
// queued (Kratos can't use a fixed code).
@singleton()
export class DevOtp {
  constructor(
    @inject(Config) private readonly config: Config,
    @inject(KratosAdmin) private readonly admin: KratosAdmin,
  ) {}

  async resolve(code: string): Promise<string> {
    if (!this.config.devStaticOtp || code !== this.config.devStaticOtp) return code;
    try {
      const m = (await this.admin.courierMessages()).find((x) => /^(verification|recovery)_code/.test(x.template_type));
      if (!m) return code;
      return ((await this.admin.courierMessage(m.id)).body ?? "").match(/\b\d{6}\b/)?.[0] ?? code;
    } catch {
      return code;
    }
  }
}
