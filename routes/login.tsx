import { FreshContext } from "fresh";
import { getCookies } from "https://deno.land/std@0.224.0/http/cookie.ts";
import {
  redirectAndSetSeshCookies,
  redirectToLocation,
  requestSesh,
  startSesh,
} from "/utils/auth.util.ts";
import { verifyJwt } from "/utils/jwt.util.ts";
import { Partial } from "fresh/runtime";
import { isLocalhost } from "/utils/helper.util.ts";

type Data = {
  inputName: "code" | "email";
  errMsg: string;
  email?: string;
};

export const handler = {
  GET(ctx: FreshContext) {
    const req = ctx.req;
    console.info(`Invalid request`, req);
    return redirectToLocation("/");
  },

  async POST(ctx: FreshContext) {
    const req = ctx.req;
    const sesh = getCookies(req.headers)["x-sloth-session-token"];
    if (sesh) {
      const pl = await verifyJwt(sesh);
      if (pl && pl.exp && Date.now() / 1000 < pl.exp) {
        console.info(`already has a valid sesh, redirecting to home`);
        return redirectToLocation("/");
      }
    }

    const form = await req.formData();
    const email = form.get("email")?.toString();
    const code = form.get("code")?.toString();

    let inputName: "code" | "email" = "email";
    let errMsg = "";

    if (!code && email) {
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        errMsg = "invalid email";
        return ctx.render(LoginPage({ inputName, errMsg }));
      }

      requestSesh(email).catch((e) => {
        inputName = "email";
        errMsg = `failed sending email to ${email}`;
        console.log(`${errMsg}: `, e);
      });

      return ctx.render(LoginPage({ inputName: "code", email, errMsg }));
    }

    if (code && email) {
      inputName = "code";
      if (!/^[a-zA-Z0-9]{9}/.test(code)) {
        errMsg = `invalid code`;
        return ctx.render(LoginPage({ inputName, email, errMsg }));
      }
      const sesh = await startSesh(email, code);
      if (sesh) return redirectAndSetSeshCookies(sesh, isLocalhost(req));
      errMsg = `invalid code`;
    }

    return ctx.render(LoginPage({ inputName, email, errMsg }));
  },
};

export default function LoginPage(data: Data) {
  const { inputName, email, errMsg } = data;

  return (
    <Partial name="action-login">
      {inputName === "code"
        ? (
          <>
            <div class="max-w-72 mb-2">
              <p>
                a code has been sent to{" "}
                {email}, if u have trouble receiving the code, try again
              </p>
              <form
                method="POST"
                f-partial="/login"
                action="/login"
              >
                <button
                  class="underline text-blue-500"
                  type="submit"
                  name="login"
                >
                  Login
                </button>
              </form>
            </div>
            <form method="POST" autocomplete="off" id="code-form" class="mt-2">
              <input
                class="focus:outline-1 focus:outline-lime-500"
                type="text"
                id="enter-code"
                name="code"
                placeholder=" enter code"
                autocomplete="off"
                aria-autocomplete="none"
                autoFocus
                defaultValue=""
                required
              />
              <input type="hidden" name="email" value={email} />
              <input
                type="submit"
                value="submit"
                class="px-3 bg-lime-300 cursor-pointer rounded-sm focus:outline-1 focus:outline-lime-500"
              />
            </form>
          </>
        )
        : (
          <form method="POST" autocomplete="off" id="email-form" class="mt-2">
            <input
              class="focus:outline-1 focus:outline-lime-300"
              type="email"
              id="enter-email-address"
              name="email"
              placeholder=" enter email"
              autocomplete="off"
              aria-autocomplete="none"
              autoFocus
              defaultValue=""
              required
            />
            <input
              type="submit"
              value="send code"
              class="px-3 bg-lime-300 cursor-pointer rounded-sm hover:bg-yellow-300"
            />
          </form>
        )}

      {errMsg && <div class="text-red-600">{errMsg}</div>}
    </Partial>
  );
}
