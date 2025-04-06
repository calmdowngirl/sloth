import { define } from "/utils.ts";
import { FreshContext, page } from "fresh";
import { getCookies } from "https://deno.land/std@0.224.0/http/cookie.ts";
import {
  getDeleteSeshCookiesHeaders,
  startSesh,
  verifySesh,
} from "/utils/auth.util.ts";
import { Partial } from "fresh/runtime";

type Data = {
  isAuthor: boolean;
};

export const handler = define.handlers<Data>({
  async GET(ctx: FreshContext) {
    const req = ctx.req;
    const sesh = getCookies(req.headers)["x-sloth-session-token"];
    const refresh = req.headers.get("x-sloth-refresh-token");

    let isAuthor = false;

    if (sesh) {
      const { result } = await verifySesh(sesh);
      console.log(`verify sesh result: `, result);

      if (result === 0) isAuthor = true;

      if (refresh && result === 3) {
        const { result, payload } = await verifySesh(refresh);
        if (result === 0) {
          const newSesh = await startSesh(undefined, undefined, +payload!.id!);
          if (newSesh) {
            console.log(`session refreshed`);
            isAuthor = true;
          }

          console.info(`refresh sesh failed`);
        }

        console.info(`invalid session`);
      }

      console.info(`invalid session`);
    }

    if (isAuthor) return page({ isAuthor: true });

    return page({ isAuthor: false }, {
      headers: getDeleteSeshCookiesHeaders(),
    });
  },
});

export default define.page<typeof handler>(({ data }) => {
  return (
    <>
      <div class="px-4 py-8 mx-auto fresh-gradient">
        <div class="max-w-screen-md mx-auto flex flex-col items-center justify-center">
          <img
            class="my-6"
            src="/logo.svg"
            width="128"
            height="128"
            alt="the Fresh logo: a sliced lemon dripping with juice"
          />
          <h1 class="text-4xl font-bold">Welcome to Fresh</h1>
          <div class="my-4">
            <Partial name={data.isAuthor ? "action-author" : "action-login"}>
              {data.isAuthor
                ? (
                  <span>
                    <a
                      class="text-black underline visited:text-black g-blue-500 active:bg-blue-600"
                      href="/add/log"
                    >
                      log smtg
                    </a>{" "}
                    or <a class="underline" href="/add/say">say smtg</a>
                  </span>
                )
                : (
                  <form
                    method="POST"
                    f-partial="/login"
                    action="/login"
                  >
                    <button
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
});
