import { Handlers, PageProps } from "$fresh/server.ts";
import { getCookies } from "https://deno.land/std@0.224.0/http/cookie.ts";
import {
  getDeleteSeshCookiesHeaders,
  getSeshCookiesHeaders,
  startSesh,
  verifySesh,
} from "/utils/auth.util.ts";
import { Partial } from "$fresh/runtime.ts";
import { isLocalhost } from "/utils/helper.util.ts";

type Data = {
  isAuthor: boolean;
};

export const handler: Handlers<Data> = {
  async GET(req, ctx) {
    const sesh = getCookies(req.headers)["x-sloth-session-token"];
    const refresh = req.headers.get("x-sloth-refresh-token");

    if (sesh) {
      const { result } = await verifySesh(sesh);
      console.log(`verify sesh result: `, result);

      if (result === 0) return ctx.render({ isAuthor: true });

      if (refresh && result === 3) {
        const { result, payload } = await verifySesh(refresh);
        if (result === 0) {
          const newSesh = await startSesh(undefined, undefined, +payload!.id!);
          if (newSesh) {
            console.log(`session refreshed`);
            return ctx.render({ isAuthor: true }, {
              headers: getSeshCookiesHeaders(newSesh, isLocalhost(req)),
            });
          }

          console.info(`refresh sesh failed`);
        }
      }
      console.info(`invalid session`);
    }

    return ctx.render({ isAuthor: false }, {
      headers: getDeleteSeshCookiesHeaders(),
    });
  },
};

export default function Home({ data }: PageProps<Data>) {
  return (
    <>
      <div class="px-4 py-8 mx-auto bg-[#86efac]">
        <div class="max-w-screen-md mx-auto flex flex-col items-center justify-center">
          <img
            class="my-6"
            src="/sloth_512_0.png"
            width="128"
            height="128"
            alt="the Fresh logo: a sliced lemon dripping with juice"
          />
          <h1 class="text-4xl font-bold">welcome ᥫ᭡ slo~life ᥫ᭡</h1>
          <div class="my-4">
            <Partial name={data.isAuthor ? "action-author" : "action-login"}>
              {data.isAuthor
                ? (
                  <span>
                    <a class="underline" href="/add/log">log smtg</a> or{" "}
                    <a class="underline" href="/add/say">say smtg</a>
                  </span>
                )
                : (
                  <form
                    class="mt-2"
                    method="POST"
                    f-partial="/login"
                    action="/login"
                  >
                    <button
                      class="px-3 bg-lime-300 cursor-pointer rounded-lg border border-lime-500 hover:bg-yellow-300"
                      type="submit"
                      name="login"
                    >
                      Login
                    </button>
                  </form>
                )}
            </Partial>
          </div>
        </div>
      </div>

      <div class="px-4 py-8 mx-auto bg-[#fff]">
        {/* <div>todo</div> */}
      </div>
    </>
  );
}
