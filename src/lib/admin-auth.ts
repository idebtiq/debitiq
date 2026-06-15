import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "debtiq_admin_session";

export { COOKIE_NAME as adminCookieName };

function getAdminUsername() {
  return process.env.ADMIN_USERNAME || "";
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "";
}

function sign(value: string) {
  return createHmac("sha256", getAdminPassword()).update(value).digest("hex");
}

function safeEqual(first: string, second: string) {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);

  return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer);
}

export function validateAdminCredentials(username: string, password: string) {
  const expectedUsername = getAdminUsername();
  const expectedPassword = getAdminPassword();

  if (!expectedUsername || !expectedPassword) return false;
  return safeEqual(username, expectedUsername) && safeEqual(password, expectedPassword);
}

export function createAdminSessionValue(username: string) {
  const issuedAt = String(Date.now());
  const payload = `${username}.${issuedAt}`;

  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSessionValue(value?: string) {
  const expectedUsername = getAdminUsername();
  const expectedPassword = getAdminPassword();

  if (!value || !expectedUsername || !expectedPassword) return false;

  const [username, issuedAt, signature] = value.split(".");
  if (!username || !issuedAt || !signature || username !== expectedUsername) return false;

  const payload = `${username}.${issuedAt}`;
  return safeEqual(signature, sign(payload));
}
