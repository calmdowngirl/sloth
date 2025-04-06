import { HttpError } from "https://jsr.io/@fresh/core/2.0.0-alpha.29/src/error.ts";
import { PageProps } from "fresh";

export default function ErrorPage(props: PageProps) {
  const error = props.error; // Contains the thrown Error or HTTPError
  if (error instanceof HttpError) {
    const status = error.status; // HTTP status code

    // Render a 404 not found page
    if (status === 404) {
      return (
        <div class="px-4 py-8 mx-auto fresh-gradient">
          <div class="max-w-screen-md mx-auto flex flex-col items-center justify-center">
            <img
              class="my-6"
              src="/logo.svg"
              width="128"
              height="128"
              alt="the Fresh logo: a sliced lemon dripping with juice"
            />
            <h1>404 - Page not found</h1>
          </div>
        </div>
      );
    }
  }

  return <h1>Oh no...</h1>;
}
