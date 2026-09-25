import { randomUUID } from "node:crypto";
import { Kafka, Partitioners, type Producer } from "kafkajs";

// Every user event goes to one Kafka topic, published by the UI backend:
//   { id, event, occurred_at, source, data }   key = data.identity_id
export const EVENTS = [
  "USER_REGISTERED",
  "USER_LOGGED_IN",
  "USER_FORGOT_PASSWORD", // code requested (data.code: send it by email)
  "USER_RESET_PASSWORD", // new password saved
  "USER_MOBILE_VERIFICATION_REQUEST", // OTP issued (data.code: send it by SMS)
  "USER_MOBILE_VERIFICATION_SUCCESS",
  "USER_EMAIL_VERIFICATION_REQUEST", // link issued (data.verification_url: send it by email)
  "USER_EMAIL_VERIFICATION_SUCCESS",
] as const;
export type EventName = (typeof EVENTS)[number];

export const TOPIC = process.env.KAFKA_TOPIC_EVENTS ?? "idp.events";

const g = globalThis as unknown as { __producer?: Promise<Producer> };

function producer(): Promise<Producer> {
  if (!g.__producer) {
    const kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID ?? "idp-ui",
      brokers: (process.env.KAFKA_BROKERS ?? "localhost:19092").split(","),
      connectionTimeout: 3000,
      requestTimeout: 5000,
      retry: { retries: 5 },
    });
    const p = kafka.producer({ idempotent: true, maxInFlightRequests: 1, createPartitioner: Partitioners.DefaultPartitioner });
    g.__producer = p.connect().then(() => p).catch((e) => {
      g.__producer = undefined; // try again on the next publish
      throw e;
    });
  }
  return g.__producer;
}

export async function publishEvent(event: EventName, data: Record<string, unknown>): Promise<void> {
  const key = String(data.identity_id ?? data.recipient ?? "");
  const value = JSON.stringify({ id: randomUUID(), event, occurred_at: new Date().toISOString(), source: "idp-ui", data });
  try {
    await (await producer()).send({ topic: TOPIC, acks: -1, messages: [{ key, value, headers: { event } }] });
  } catch (e) {
    g.__producer = undefined; // drop a possibly broken connection
    throw e;
  }
}
