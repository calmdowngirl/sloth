import "https://deno.land/x/dotenv@v3.2.2/load.ts";

export async function emailCode(
  to: string,
  event: string,
  code: string,
): Promise<boolean> {
  const { EMAIL_API, EMAIL_SUBJECT_L, EMAIL_TEXT_L, EVENT_TYPE_0 } = Deno.env
    .toObject();

  const headers = new Headers();
  headers.set("Content-Type", "application/x-www-form-urlencoded");
  headers.set("x-sloth-sesh", "request-a-sesh");

  const body = new URLSearchParams();
  body.set("to", to);

  let subject: string = "", text: string = "";
  switch (event) {
    case EVENT_TYPE_0:
      subject = EMAIL_SUBJECT_L;
      text = `${EMAIL_TEXT_L}${code}`;
      break;
    default:
      console.error(`bad event type: ${event}`);
      return false;
  }
  body.set("subject", subject);
  body.set("text", text);
  body.set("evt", event);

  const options = {
    headers,
    method: "POST",
    body: body.toString(),
  };

  try {
    const response = await fetch(EMAIL_API, options);
    if (!response.ok) {
      console.error("email api error");
      throw new Error("email api error");
    }
    return true;
  } catch (e) {
    console.error(`failed to email code to ${to}: ${JSON.stringify(e)}`);
    return false;
  }
}
