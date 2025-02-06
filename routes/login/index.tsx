import { Handlers, PageProps } from "$fresh/server.ts";
import { redirectToLocation } from "/routes/api/sesh/[slug]/auth.ts";
import { verifyJwt } from "/utils/jwt.ts";

type Data = {
  email: string;
};

export const handler: Handlers<Data> = {
  async GET(req, ctx) {
    const url = new URL(req.url);
    const sesh = req.headers.get("cookie")?.split(";")?.[0]?.split("=")?.[1];
    if (sesh) {
      const pl = await verifyJwt(sesh);
      if (pl && pl.exp && Date.now() / 1000 < pl.exp) {
        console.info(`already has a valid sesh, redirecting to home`);
        return redirectToLocation("/");
      }
    }
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
    <>
      <form action={values.action} method={"POST"}>
        {/* either email or code */}
        <input
          type="text"
          name={values.inputName}
          placeholder={values.placeholder}
        />
        {email && <input type="hidden" name="email" value={email} />}
        <input type="submit" value={values.submit} />
      </form>
    </>
  );
}
