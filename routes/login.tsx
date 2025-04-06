import { Handlers, PageProps } from "$fresh/server.ts";
import { getCookies } from "https://deno.land/std@0.224.0/http/cookie.ts";
import {
  redirectAndSetSeshCookies,
  redirectToLocation,
  requestSesh,
  startSesh,
} from "/utils/auth.util.ts";
import { verifyJwt } from "/utils/jwt.util.ts";
import { Partial } from "$fresh/runtime.ts";
import { isLocalhost } from "/utils/helper.util.ts";

type Data = {
  inputName: "code" | "email";
  errMsg: string;
  email?: string;
};

export const handler: Handlers<Data> = {
  GET(req, _ctx) {
    console.info(`Invalid request`, req);
    return redirectToLocation("/");
  },

  async POST(req, ctx) {
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
        return ctx.render({ inputName, errMsg });
      }

      requestSesh(email).catch((e) => {
        inputName = "email";
        errMsg = `failed sending email to ${email}`;
        console.log(`${errMsg}: `, e);
      });

      return ctx.render({ inputName: "code", email, errMsg });
    }

    if (code && email) {
      if (!/^[a-zA-Z0-9]{9}/.test(code)) {
        errMsg = `invalid code`;
      }
      const sesh = await startSesh(email, code);
      if (sesh) return redirectAndSetSeshCookies(sesh, isLocalhost(req));
    }

    return ctx.render({ inputName, email, errMsg });
  },
};

export default function LoginPage({ data }: PageProps<Data>) {
  const { inputName, email, errMsg } = data;

  return (
    <Partial name="action-login">
      {inputName === "code"
        ? (
          <>
            <div class="max-w-72 mb-2">
              <p>
                a code has been sent to{" "}
                {email}, if u have trouble receiving the code
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
                  click here to try again
                </button>
              </form>
            </div>
            <form method="POST" autocomplete="off" id="code-form" class="mt-2">
              <input
                class="focus:outline-1 focus:outline-yellow-300"
                type="text"
                id="enter-code"
                name="code"
                placeholder=" enter code"
                autocomplete="off"
                autoFocus
                defaultValue=""
                required
              />
              <input type="hidden" name="email" value={email} />
              <input
                type="submit"
                value="submit"
                class="px-3 cursor-pointer rounded-sm focus:outline-1 focus:outline-yellow-300"
              />
            </form>
          </>
        )
        : (
          <form method="POST" autocomplete="off" id="email-form" class="mt-2">
            <input
              class="focus:outline-1 focus:outline-yellow-300"
              type="email"
              id="email-address"
              name="email"
              placeholder=" enter email"
              autocomplete="off"
              autoFocus
              defaultValue=""
              required
            />
            <input
              type="submit"
              value="send code"
              class="px-3 bg-yellow-300 cursor-pointer rounded-sm hover:bg-lime-200"
            />
          </form>
        )}

      {errMsg && <div class="text-red-600">{errMsg}</div>}
    </Partial>
  );
}
