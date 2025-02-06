import "https://deno.land/x/dotenv@v3.2.2/load.ts";
import { FreshContext } from "$fresh/server.ts";
import { createJwt, verifyJwt } from "/utils/jwt.ts";
import { Account, getAccId, getAccount, MetaData } from "/utils/account.ts";
import { emailCode } from "/utils/email.ts";

type Session = {
  sessionToken: string;
  refreshToken: string;
};

const { EVENT_TYPE_0, DOMAIN } = Deno.env.toObject();

export const handler = async (
  req: Request,
  ctx: FreshContext,
): Promise<Response> => {
  const data = await req.formData();
  const action = ctx.params.slug;
  const email = data.get("email")?.toString() ?? "nothing";
  const code = data.get("code")?.toString() ?? "nothing";
  const isLocalhost = req.url.startsWith("http://localhost");

  if (!/\S+@\S+\.\S+/.test(email)) {
    console.error(`bad email: ${email}`);
    return new Response("bad", { status: 400 });
  }

  if (action === "req") {
    if (await requestSesh(email)) {
      return redirectToLocation("/login", [{
        k: "email",
        v: email,
      }]);
    }
    return new Response("error", { status: 500 });
  }

  if (action === "start") {
    if (!/^[a-zA-Z0-9]{9}/.test(code)) {
      console.error(`bad code: ${code}`);
      return new Response("bad", { status: 400 });
    }

    const sesh = await startSesh(email, code);
    if (sesh) return redirectAndSetSeshCookies(sesh, isLocalhost);
    return new Response("error", { status: 500 });
  }

  if (action === "verify") {
    const sesh = req.headers.get("x-sloth-session-token");
    const refresh = req.headers.get("x-sloth-refresh-token");

    const db = await Deno.openKv();
    const account = await getAccount(db, email) ?? {} as Account;
    if (!sesh) {
      console.error(`error: missing session token header`);
      return new Response("unauthorised", { status: 401 });
    }

    const result = await verifySesh(sesh, account);
    if (result !== 0 && result < 3) {
      console.error(`error: bad session token ${sesh}`);
      return redirectAndDeleteSesh();
    }

    // get a new sesh
    if (result === 3) {
      if (!refresh) {
        console.error(`error: missing refresh token header`);
        return redirectAndDeleteSesh();
      }

      const result = await verifySesh(refresh, account);
      if (result !== 0) {
        return redirectAndDeleteSesh();
      }

      const newSesh = await startSesh(email);
      if (!newSesh) {
        return new Response("failed to get a new sesh", { status: 500 });
      }
      return redirectAndSetSeshCookies(newSesh, isLocalhost);
    }
  }

  console.error(`bad request data, action: ${action}`);
  return new Response("bad", { status: 400 });
};

async function requestSesh(email: string): Promise<boolean> {
  const code = getRandomString(9);
  const loginToken = await createJwt({ code }, "15 mins");

  try {
    const db = await Deno.openKv();
    const accKey = ["accounts", email];
    const metaKey = ["meta"];

    const account = await getAccount(db, email) ?? {} as Account;
    account.loginToken = loginToken;

    const isAccountNew = !Object.entries(account).length;

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

async function startSesh(
  email: string,
  code?: string,
): Promise<Session | null> {
  const db = await Deno.openKv();
  const key = [`accounts`, email];
  const value = (await db.get<Account>(key)).value;

  if (
    !!code &&
    (!value?.loginToken || (await verifyJwt(value.loginToken))?.code !== code)
  ) {
    return null;
  }

  // store session
  const sessionToken = getRandomString(15, "_#%$?");
  const refreshToken = getRandomString(15, "_#%$?");
  const sessionJwt = await createJwt({ sessionToken }, "1 hr");
  const refreshJwt = await createJwt({ refreshToken }, "3 hr");
  try {
    await db.set(key, { ...value, sessionToken, refreshToken });
  } catch (e) {
    console.error(
      `db failure set key ${JSON.stringify(key)}, value ${
        JSON.stringify(value)
      }: `,
      JSON.stringify(e),
    );
    return null;
  }

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

async function verifySesh(
  token: string,
  account: Account,
): Promise<number> {
  const payload = await verifyJwt(token);
  if (!payload || (!payload.sessionToken && !payload.refreshToken)) {
    console.error(`bad token`);
    return 1;
  }

  if (!!payload.sessionToken && payload.sessionToken !== account.sessionToken) {
    console.error(`bad session token payload`);
    return 2;
  }
  if (!!payload.refreshToken && payload.refeshToken !== account.refreshToken) {
    console.error(`bad refresh token payload`);
    return 2;
  }

  if (!payload.exp || Date.now() / 1000 >= payload.exp) {
    console.error(`token expired`);
    return 3;
  }
  return 0;
}

function redirectAndSetSeshCookies(
  sesh: Session,
  isLocalhost: boolean,
  location: string = "/",
): Response {
  const domain = isLocalhost ? "" : `${DOMAIN};`;
  const headers = new Headers();
  headers.set("Location", location);
  headers.set(
    "Set-Cookie",
    `x-sloth-session-token=${sesh.sessionToken}; ${domain} Path=/; Max-Age=3600`,
  );
  headers.append(
    "Set-Cookie",
    `x-sloth-refresh-token=${sesh.refreshToken}; ${domain} Path=/; Max-Age=3600`,
  );

  return new Response("redirect to home", { status: 302, headers });
}

export function redirectToLocation(
  location = "/login",
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

function redirectAndDeleteSesh(
  location = "/login",
): Response {
  const headers = new Headers();
  headers.set("Location", location);
  headers.set(
    "Set-Cookie",
    "x-sloth-session-token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0",
  );
  headers.set(
    "Set-Cookie",
    "x-sloth-refesh-token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0",
  );
  return new Response("redirect to login", { status: 302, headers });
}
