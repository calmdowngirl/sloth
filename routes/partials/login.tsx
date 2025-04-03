import { Handlers, PageProps } from "$fresh/server.ts";
import { getCookies } from "https://deno.land/std@0.224.0/http/cookie.ts";
import {
  redirectAndSetSeshCookies,
  redirectToLocation,
  requestSesh,
  startSesh,
} from "/routes/api/sesh/[slug]/auth.ts";
import { verifyJwt } from "/utils/jwt.ts";
import { Partial } from "$fresh/runtime.ts";
import { isLocalhost } from "/utils/helper.ts";

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
      }

      if (await requestSesh(email)) {
        inputName = "code";
      } else {
        errMsg = `failed sending email to ${email}`;
      }
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
  const values = inputName === "code"
    ? {
      inputName,
      placeholder: "Code",
      submit: "Submit",
    }
    : {
      inputName,
      placeholder: "Email adress",
      submit: "Login",
    };

  return (
    <Partial name="action-login">
      {errMsg && <div>{errMsg}</div>}
      <form method="POST">
        <input
          type="text"
          name={values.inputName}
          placeholder={values.placeholder}
          defaultValue=""
          required
        />
        {inputName === "code" && (
          <input type="hidden" name="email" value={email} />
        )}
        <input type="submit" value={values.submit} />
      </form>
    </Partial>
  );
}
