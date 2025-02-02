import "https://deno.land/x/dotenv@v3.2.2/load.ts";
import { FreshContext } from "$fresh/server.ts";
import { createJwt, verifyJwt } from "/utils/jwt.ts";
import { Account, getAccId, getAccount, MetaData } from "/utils/account.ts";
import { emailCode } from "/utils/email.ts";

type Session = {
  sessionToken: string;
  refreshToken: string;
};

const { EVENT_TYPE_0 } = Deno.env.toObject();

export const handler = async (
  req: Request,
  ctx: FreshContext,
): Promise<Response> => {
  const data = await req.formData();
  const action = ctx.params.slug;
  const email = data.get("email")?.toString() ?? "nothing";
  const code = data.get("code")?.toString() ?? "nothing";

  if (!/\S+@\S+\.\S+/.test(email)) {
    console.error(`bad email: ${email}`);
    return new Response("bad", { status: 400 });
  }

  if (action === "req") {
    if (await requestSesh(email)) {
      return new Response("ok", { status: 200 });
    }
    return new Response("error", { status: 500 });
  }

  if (!/^[a-zA-Z0-9]{9}/.test(code)) {
    console.error(`bad code: ${code}`);
    return new Response("bad", { status: 400 });
  }

  if (action === "start") {
    const sesh = await startSesh(email, code);
    if (sesh) {
      const headers = new Headers();
      headers.set("Location", "sloth-life.deno.dev");
      headers.set(
        "Set-Cookie",
        `session-token=${sesh.sessionToken}; Domain=sloth-life.deno.dev; Path=/; Max-Age=3600`,
      );
      headers.set(
        "Set-Cookie",
        `refresh-token=${sesh.refreshToken}; Domain=sloth-life.deno.dev; Path=/; Max-Age=3600`,
      );
      return new Response("redirect", { status: 302, headers });
    }
    return new Response("error", { status: 500 });
  }

  // todo
  // if (action === "re") {}

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
      await db.atomic()
        .set(accKey, account)
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
  code: string,
): Promise<Session | null> {
  const db = await Deno.openKv();
  const key = [`accounts`, email];
  const value = (await db.get<Account>(key)).value;
  if (
    !value?.loginToken || (await verifyJwt(value.loginToken))?.code !== code
  ) {
    return null;
  }

  // store session
  const session = getRandomString(62, "_#%$?");
  const refresh = getRandomString(62, "_#%$?");
  const sessionToken = await createJwt({ session }, "1 hr");
  const refreshToken = await createJwt({ refresh }, "3 hr");
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

  return { sessionToken, refreshToken };
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
