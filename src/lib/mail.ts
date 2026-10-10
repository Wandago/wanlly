import "server-only";

/*
 * Email sent from Wanlly's own mailbox (the one at HostAfrica), over SMTP. Cloudflare Workers can
 * open the connection directly, so no mail service or extra account is needed.
 *
 * Settings (Cloudflare): SMTP_USER (the full mailbox address, e.g. hello@wanlly.africa),
 * SMTP_PASS (that mailbox's password), and optionally SMTP_HOST (default mail.wanlly.africa),
 * SMTP_PORT (465, the default, or 587) and MAIL_FROM_NAME (default "Wanlly").
 */

export const mailReady = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);

type Socket = {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  startTls(): Socket;
  close(): Promise<void>;
};

const b64 = (s: string) => {
  let bin = "";
  for (const byte of new TextEncoder().encode(s)) bin += String.fromCharCode(byte);
  return btoa(bin);
};
/** A header value, encoded when it isn't plain ASCII. */
const header = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const clean = (s: string) => s.replace(/[\r\n]/g, " ").trim();

/** One SMTP conversation: send a line, wait for the reply, check its code. */
function session(socket: Socket) {
  let reader = socket.readable.getReader();
  let writer = socket.writable.getWriter();
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let buffer = "";
  const reply = async (): Promise<string> => {
    const timeout = new Promise<never>((_, no) => setTimeout(() => no(new Error("The mail server didn't answer")), 15_000));
    // A reply ends with a line whose code is followed by a space ("250 OK"); "250-" lines continue it.
    while (!/(^|\r\n)\d{3} [^\r\n]*\r\n$/.test(buffer)) {
      const { value, done } = await Promise.race([reader.read(), timeout]);
      if (done) throw new Error("The mail server closed the connection");
      buffer += dec.decode(value, { stream: true });
    }
    const out = buffer;
    buffer = "";
    return out;
  };
  const expect = async (code: string, line?: string) => {
    if (line !== undefined) await writer.write(enc.encode(`${line}\r\n`));
    const r = await reply();
    if (!r.split("\r\n").some((l) => l.startsWith(`${code} `))) throw new Error(`Mail server said: ${r.trim().slice(0, 200)}`);
    return r;
  };
  const upgrade = () => {
    reader.releaseLock();
    writer.releaseLock();
    socket = socket.startTls();
    reader = socket.readable.getReader();
    writer = socket.writable.getWriter();
  };
  return { expect, upgrade, close: () => socket.close().catch(() => {}) };
}

export async function sendMail({ to, subject, text, html, replyTo }: { to: string; subject: string; text: string; html?: string; replyTo?: string }) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) throw new Error("Email isn't set up");
  const host = process.env.SMTP_HOST || "mail.wanlly.africa";
  const port = Number(process.env.SMTP_PORT) || 465;
  const implicit = port === 465;
  // Only Workers have this module; the .catch tells the bundler to leave it for Wrangler.
  const sockets = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "cloudflare:sockets").catch(() => null)) as {
    connect: (a: { hostname: string; port: number }, o: { secureTransport: "on" | "starttls"; allowHalfOpen: boolean }) => Socket;
  } | null;
  if (!sockets) throw new Error("Email can only be sent from the live site");
  const { connect } = sockets;
  const s = session(connect({ hostname: host, port }, { secureTransport: implicit ? "on" : "starttls", allowHalfOpen: false }));
  const domain = user.split("@")[1] ?? "wanlly.africa";
  try {
    await s.expect("220");
    await s.expect("250", `EHLO ${domain}`);
    if (!implicit) {
      await s.expect("220", "STARTTLS");
      s.upgrade();
      await s.expect("250", `EHLO ${domain}`);
    }
    await s.expect("235", `AUTH PLAIN ${b64(`\0${user}\0${pass}`)}`);
    await s.expect("250", `MAIL FROM:<${user}>`);
    await s.expect("250", `RCPT TO:<${clean(to)}>`);
    await s.expect("354", "DATA");
    const name = process.env.MAIL_FROM_NAME || "Wanlly";
    // Bodies are base64, so no line can start with "." or run too long.
    const part = (type: string, body: string) => [`Content-Type: ${type}; charset=UTF-8`, "Content-Transfer-Encoding: base64", "", b64(body.replace(/\r?\n/g, "\r\n")).replace(/.{76}/g, "$&\r\n")].join("\r\n");
    const boundary = `wanlly-${crypto.randomUUID()}`;
    // With HTML, both versions go together and the email app shows the best one it can.
    const content = html
      ? [`Content-Type: multipart/alternative; boundary="${boundary}"`, "", `--${boundary}`, part("text/plain", text), `--${boundary}`, part("text/html", html), `--${boundary}--`].join("\r\n")
      : part("text/plain", text);
    const message = [
      `From: ${header(name)} <${user}>`,
      `To: <${clean(to)}>`,
      `Reply-To: <${clean(replyTo ?? user)}>`,
      `Subject: ${header(clean(subject))}`,
      `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
      `Message-ID: <${crypto.randomUUID()}@${domain}>`,
      "MIME-Version: 1.0",
      content,
      ".",
    ].join("\r\n");
    await s.expect("250", message);
    await s.expect("221", "QUIT").catch(() => {});
  } finally {
    await s.close();
  }
}
