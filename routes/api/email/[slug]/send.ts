import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";
import "https://deno.land/x/dotenv@v3.2.2/load.ts";
import { FreshContext } from "$fresh/server.ts";

export const handler = async (
  req: Request,
  ctx: FreshContext,
): Promise<Response> => {
  const action = ctx.params.slug;
  const to = (await req.formData()).get("to")?.toString();
  console.log(to);
  if (to) await sendEmail(to);
  return new Response("ok");
};

async function sendEmail(toEmail: string) {
  const client = new SmtpClient();
  const { FROM_EMAIL, FROM_EMAIL_PWD } = Deno.env.toObject();
  const connectConfig = {
    hostname: "smtp.gmail.com",
    port: 465,
    username: FROM_EMAIL,
    password: FROM_EMAIL_PWD,
  };
  await client.connectTLS(connectConfig);

  await client.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: "testing",
    content: "send",
  });

  await client.close();
}
