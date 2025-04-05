import "https://deno.land/x/dotenv@v3.2.2/load.ts";
import { FreshContext } from "fresh";
import { isLocalhost } from "/utils/helper.util.ts";
import {
  redirectAndDeleteSesh,
  redirectAndSetSeshCookies,
  redirectToLocation,
  requestSesh,
  setSeshCookies,
  startSesh,
  verifySesh,
} from "/utils/auth.util.ts";

export const handler = async (
  ctx: FreshContext,
): Promise<Response> => {
  const req = ctx.req;
  let data: FormData;
  try {
    data = await req.formData();
  } catch (_e) {
    console.log(`Invalid form data`);
    return redirectToLocation("/");
  }

  if (req.method !== "POST") {
    return new Response("bad", { status: 400 });
  }

  const action = ctx.params.slug;
  const email = data.get("email")?.toString() ?? "nothing";
  const code = data.get("code")?.toString() ?? "nothing";

  const requiresEmail = action === "req" || action === "start";
  if (requiresEmail && !/\S+@\S+\.\S+/.test(email)) {
    console.error(`bad email: ${email}`);
    return new Response("bad", { status: 400 });
  }

  if (action === "req") {
    if (await requestSesh(email)) {
      const headers = new Headers();
      headers.set("Content-Type", "application/x-www-form-urlencoded");
      headers.set("x-sloth-sesh", "req-sesh-enter-code");
      const options = {
        headers,
        method: "POST",
      };
      const location = new URL(`/login?email=${email}`, req.url);

      return await fetch(location, options);
    }

    return new Response("error", { status: 500 });
  }

  if (action === "start") {
    if (!/^[a-zA-Z0-9]{9}/.test(code)) {
      console.error(`bad code: ${code}`);
      return new Response("bad", { status: 400 });
    }

    const sesh = await startSesh(email, code);
    if (sesh) return redirectAndSetSeshCookies(sesh, isLocalhost(req));
    return new Response("error", { status: 500 });
  }

  if (action === "verify") {
    const sesh = req.headers.get("x-sloth-session-token");
    const refresh = req.headers.get("x-sloth-refresh-token");

    if (!sesh) {
      console.error(`error: missing session token header`);
      return redirectAndDeleteSesh();
    }

    const { result, payload: _ } = await verifySesh(sesh);

    if (result === 0) return new Response("ok", { status: 200 });

    if (result < 3) {
      console.error(`error: bad session token ${sesh}`);
      return redirectAndDeleteSesh();
    }

    // get a new sesh
    if (result === 3) {
      if (!refresh) {
        console.error(`error: missing refresh token header`);
        return redirectAndDeleteSesh();
      }

      const { result, payload } = await verifySesh(refresh);
      if (result !== 0) {
        return redirectAndDeleteSesh();
      }

      const newSesh = await startSesh(undefined, undefined, +payload!.id!);
      if (!newSesh) {
        return new Response("failed to get a new sesh", { status: 500 });
      }

      // 200 ok
      return setSeshCookies(newSesh, isLocalhost(req));
    }
  }

  console.error(`bad request data, action: ${action}`);
  return new Response("bad", { status: 400 });
};
