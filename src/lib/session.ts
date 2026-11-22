// Seshn: JWT-g httpOnly cookie-d hadgalna (middleware-d ch ajillana)
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "dms_session";
const MAX_AGE_SEC = 60 * 60 * 8; // 8 tsag

export type SessionPayload = { userId: string; username: string };

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET .env-д дор хаяж 32 тэмдэгттэй байх ёстой");
  return new TextEncoder().encode(secret);
}

export async function encryptSession(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(key());
}

export async function decryptSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return { userId: String(payload.userId), username: String(payload.username) };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SEC,
};
