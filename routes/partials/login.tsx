import { Handlers, PageProps } from "$fresh/server.ts";
import { getCookies } from "https://deno.land/std@0.224.0/http/cookie.ts";
import { redirectToLocation } from "/routes/api/sesh/[slug]/auth.ts";
import { verifyJwt } from "/utils/jwt.ts";
import { Partial } from "$fresh/runtime.ts";

type Data = {
  email: string;
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

    const url = new URL(req.url);
    const email = url.searchParams.get("email") || "";
    return ctx.render({ email });
  },
};

export default function LoginPage({ data }: PageProps<Data>) {
  const { email } = data;
  const values = email
    ? {
      action: "/api/sesh/start/auth",
      inputName: "code",
      placeholder: "Code",
      submit: "Submit",
    }
    : {
      action: "/api/sesh/req/auth",
      inputName: "email",
      placeholder: "Email adress",
      submit: "Login",
    };

  return (
    <Partial name="action-login">
      <form action={values.action} method="POST">
        {/* either email or code */}
        <input
          type="text"
          name={values.inputName}
          placeholder={values.placeholder}
          defaultValue=""
          required
        />
        {email && <input type="hidden" name="email" value={email} />}
        <input type="submit" value={values.submit} />
      </form>
    </Partial>
  );
}
