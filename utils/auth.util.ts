import { JWTPayload } from "npm:jose@5.9.6";
import {
  Account,
  getAccId,
  getAccountByEmail,
  getAccountById,
  MetaData,
} from "./account.util.ts";
import { emailCode } from "./email.util.ts";
import { createJwt, verifyJwt } from "./jwt.util.ts";

export type Session = {
  sessionToken: string;
  refreshToken: string;
};

const { EVENT_TYPE_0, DOMAIN } = Deno.env.toObject();

export async function requestSesh(email: string): Promise<boolean> {
  const code = getRandomString(9);
  const loginToken = await createJwt({ code }, "15 mins");

  try {
    const db = await Deno.openKv();
    const accKey = ["accounts", email];
    const metaKey = ["meta"];

    const account = await getAccountByEmail(db, email) ?? {} as Account;
    const isAccountNew = !Object.entries(account).length;

    account.loginToken = loginToken;

    // `null` versionstamps mean 'no value'
    await db.atomic().check({ key: metaKey, versionstamp: null }).set(
      metaKey,
      { latestAccId: -1 },
    ).commit();

    const metaData = (await db.get<MetaData>(metaKey)).value!;

    // increment numeric acc id
    if (isAccountNew) {
      account.id = await getAccId(db);
      account.email = email;
      account.createdAt = Date.now();

      const accSecondaryKey = ["accountsById", account.id];

      await db.atomic()
        .set(accKey, account)
        // Set the secondary key's value to be the primary key
        .set(accSecondaryKey, email)
        .set(metaKey, {
          ...metaData,
          latestAccId: (metaData.latestAccId ?? -1) + 1,
        })
        .commit();
    } else {
      await db.set(accKey, account);
    }

    db.close();
  } catch (e) {
    console.error(`db error, failed to set key ${email}:`, JSON.stringify(e));
    return false;
  }

  return await emailCode(email, EVENT_TYPE_0, code);
}

export async function startSesh(
  email?: string,
  code?: string,
  id?: number,
): Promise<Session | null> {
  if (!email && id == null) return null;

  const db = await Deno.openKv();
  let value;
  try {
    if (!email) {
      value = await getAccountById(db, id!);
      email = value?.email;
    } else {
      value = await getAccountByEmail(db, email);
      id = value?.id;
    }
  } catch (e) {
    console.log(`error: `, e);
    db.close();
    return null;
  }

  if (
    !!code &&
    (!value?.loginToken ||
      (await verifyJwt(value.loginToken))?.code !== code)
  ) {
    return null;
  }

  if (!value || !email || id == null) {
    console.log(`not found: email or id`);
    return null;
  }

  // store session
  const sessionToken = getRandomString(15, "_#%$?");
  const refreshToken = getRandomString(15, "_#%$?");
  const sessionJwt = await createJwt({ sessionToken, id }, "1 hr");
  const refreshJwt = await createJwt({ refreshToken, id }, "3 hr");
  const key = [`accounts`, email];
  try {
    await db.set(key, { ...value, sessionToken, refreshToken });
  } catch (e) {
    console.error(
      `db failure set key ${JSON.stringify(key)}, value ${
        JSON.stringify(value)
      }: `,
      JSON.stringify(e),
    );
    db.close();
    return null;
  }

  db.close();
  return { sessionToken: sessionJwt, refreshToken: refreshJwt };
}

function getRandomString(len: number = 9, extraChars: string = ""): string {
  const chs =
    `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz${extraChars}`;
  let str = "";
  for (let i = 0; i < len; i++) {
    str += chs.charAt(Math.floor(Math.random() * chs.length));
  }
  return str;
}

type VerifyJwtResult = {
  result: number;
  payload?: JWTPayload | null;
};
export async function verifySesh(token: string): Promise<VerifyJwtResult> {
  const payload = await verifyJwt(token);
  if (
    !payload || payload.id == null ||
    (!payload.sessionToken && !payload.refreshToken)
  ) {
    console.error(`bad token`);
    return { result: 1 };
  }

  const db = await Deno.openKv();
  let account: Account;
  try {
    account = await getAccountById(db, +payload.id) ??
      {} as Account;
  } catch (e) {
    console.log(`error: `, e);
    db.close();
    return { result: 4 };
  }

  if (!!payload.sessionToken && payload.sessionToken !== account.sessionToken) {
    console.error(`bad session token payload`, account, payload);
    return { result: 2 };
  }
  if (!!payload.refreshToken && payload.refeshToken !== account.refreshToken) {
    console.error(`bad refresh token payload`);
    return { result: 2 };
  }

  if (!payload.exp || Date.now() / 1000 >= payload.exp) {
    console.error(`token expired`);
    return { result: 3 };
  }
  return { result: 0, payload };
}

export function redirectAndSetSeshCookies(
  sesh: Session,
  isLocalhost: boolean,
  location: string = "/",
): Response {
  const domain = isLocalhost ? "" : `${DOMAIN};`;
  const headers = new Headers();
  headers.set("Location", location);
  headers.set(
    "Set-Cookie",
    `x-sloth-session-token=${sesh.sessionToken}; ${domain} Path=/; Max-Age=3600; HttpOnly`,
  );
  headers.append(
    "Set-Cookie",
    `x-sloth-refresh-token=${sesh.refreshToken}; ${domain} Path=/; Max-Age=${
      3600 * 3
    }; HttpOnly`,
  );

  return new Response("redirect to home", { status: 302, headers });
}

export function setSeshCookies(
  sesh: Session,
  isLocalhost: boolean,
): Response {
  const domain = isLocalhost ? "" : `${DOMAIN};`;
  const headers = new Headers();
  headers.set(
    "Set-Cookie",
    `x-sloth-session-token=${sesh.sessionToken}; ${domain} Path=/; Max-Age=3600; HttpOnly`,
  );
  headers.append(
    "Set-Cookie",
    `x-sloth-refresh-token=${sesh.refreshToken}; ${domain} Path=/; Max-Age=${
      3600 * 3
    }; HttpOnly`,
  );
  return new Response("ok", { status: 200, headers });
}

export function getSeshCookiesHeaders(
  sesh: Session,
  isLocalhost: boolean,
): Headers {
  const domain = isLocalhost ? "" : `${DOMAIN};`;
  const headers = new Headers();
  headers.set(
    "Set-Cookie",
    `x-sloth-session-token=${sesh.sessionToken}; ${domain} Path=/; Max-Age=3600; HttpOnly`,
  );
  headers.append(
    "Set-Cookie",
    `x-sloth-refresh-token=${sesh.refreshToken}; ${domain} Path=/; Max-Age=${
      3600 * 3
    }; HttpOnly`,
  );
  return headers;
}

export function redirectToLocation(
  location = "/",
  queryParams: { k: string; v: string }[] = [],
): Response {
  const q = new URLSearchParams();
  queryParams.forEach((p) => q.set(p.k, p.v));
  const headers = new Headers();
  headers.set(
    "Location",
    `${location}${queryParams.length ? "?" + q.toString() : ""}`,
  );

  return new Response("redirect", { status: 302, headers });
}

export function redirectAndDeleteSesh(
  location = "/",
): Response {
  const headers = new Headers();
  headers.set("Location", location);
  headers.set(
    "Set-Cookie",
    "x-sloth-session-token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly",
  );
  headers.set(
    "Set-Cookie",
    "x-sloth-refesh-token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly",
  );
  return new Response("redirect to login", { status: 302, headers });
}

export function getDeleteSeshCookiesHeaders(location = "/"): Headers {
  const headers = new Headers();
  headers.set("Location", location);
  headers.set(
    "Set-Cookie",
    "x-sloth-session-token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly",
  );
  headers.set(
    "Set-Cookie",
    "x-sloth-refesh-token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly",
  );
  return headers;
}
