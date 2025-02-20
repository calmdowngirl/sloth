export type Account = {
  id: number;
  email: string;
  createdAt: number;
  loginToken?: string;
  sessionToken?: string;
  refreshToken?: string;
  displayName?: string;
};

export type MetaData = {
  latestAccId: number;
};

export async function getAccId(db: Deno.Kv): Promise<number | never> {
  try {
    return (await db.get<MetaData>([`meta`]))?.value?.latestAccId as number + 1;
  } catch (e) {
    throw new Error(`db get failure in fn getAccId: ${JSON.stringify(e)}`);
  }
}

export async function hasNoAccountsYet(db: Deno.Kv): Promise<boolean | never> {
  try {
    const entries = db.list({ prefix: ["accounts"] });
    return !(await entries.next()).value;
  } catch (e) {
    throw new Error(
      `db get failure in fn hasNoAccountsYet: ${JSON.stringify(e)}`,
    );
  }
}

export async function getAccountByEmail(
  db: Deno.Kv,
  email: string,
): Promise<Account | null | never> {
  try {
    return (await db.get<Account>([`accounts`, email])).value;
  } catch (e) {
    throw new Error(
      `db get failure in fn getAccountByEmail: ${JSON.stringify(e)}`,
    );
  }
}

export async function getAccountById(
  db: Deno.Kv,
  id: number,
): Promise<Account | null | never> {
  try {
    const email = (await db.get<string>([`accountsById`, id])).value;
    if (!email) return null;
    return (await getAccountByEmail(db, email));
  } catch (e) {
    throw new Error(
      `db get failure in fn getAccountById: ${JSON.stringify(e)}`,
    );
  }
}
