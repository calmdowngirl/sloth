import { JWTPayload, jwtVerify, SignJWT } from "npm:jose@5.9.6";
import "jsr:@std/dotenv/load";

const { SECRET } = Deno.env.toObject();
const secret = new TextEncoder().encode(SECRET);

export async function createJwt(
  payload: JWTPayload,
  exp: string,
): Promise<string> {
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret);

  return jwt;
}

export async function verifyJwt(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    console.error("Invalid JWT:", error);
    return null;
  }
}
