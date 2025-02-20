import { Handlers, PageProps } from "$fresh/server.ts";
import { getCookies } from "https://deno.land/std@0.224.0/http/cookie.ts";
import { redirectAndDeleteSesh } from "/routes/api/sesh/[slug]/auth.ts";

type Data = {
  isAuthor: boolean;
};

export const handler: Handlers<Data> = {
  async GET(req, ctx) {
    const cookies = getCookies(req.headers);
    if (cookies["x-sloth-session-token"]) {
      const options: RequestInit = {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...cookies,
        },
      };
      const url = new URL("./api/sesh/verify/auth", req.url);
      const result = await fetch(url, options);

      if (result.redirected) {
        return redirectAndDeleteSesh();
      }

      if (result.status === 200) {
        return ctx.render({ isAuthor: true });
      }

      console.info(`invalid session`);
    }
    return ctx.render({ isAuthor: false });
  },
};

export default function Home({ data }: PageProps<Data>) {
  return (
    <div class="px-4 py-8 mx-auto bg-[#86efac]">
      <div class="max-w-screen-md mx-auto flex flex-col items-center justify-center">
        <img
          class="my-6"
          src="/logo.svg"
          width="128"
          height="128"
          alt="the Fresh logo: a sliced lemon dripping with juice"
        />
        <h1 class="text-4xl font-bold">Welcome to Fresh</h1>
        <p class="my-4">
          {data.isAuthor
            ? (
              <span>
                <a class="underline" href="/add/log">log smtg</a> or{" "}
                <a class="underline" href="/add/blurb">blurb smtg</a>
              </span>
            )
            : (
              <span>
                <a href="/login">login</a>
              </span>
            )}
        </p>
      </div>
    </div>
  );
}
