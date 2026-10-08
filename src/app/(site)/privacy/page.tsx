import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/site/prose";

export const metadata: Metadata = { title: "Privacy · Wanlly" };

export default function PrivacyPage() {
  return (
    <ProsePage eyebrow="Privacy" title="Privacy policy" intro="Plain-language summary. This is a beta draft and will be reviewed by a privacy lawyer before Wanlly opens widely.">
      <h2>What we collect</h2>
      <ul>
        <li>Your account: name, email and profile photo from your sign-in (Google, GitHub or email), and your phone number if you verify it.</li>
        <li>Your country, from your network, to set ad rates and the community floor.</li>
        <li>What you create: prompts, files, projects and the replies AI models send back.</li>
        <li>How you use Wanlly: credits earned and spent, ads shown and watched, and security signals such as device and network, to stop abuse.</li>
      </ul>
      <h2>Why we use it</h2>
      <ul>
        <li>To run Wanlly and send your requests to the AI model you choose.</li>
        <li>To pay for it with ads, and to make sure rewards are fair and real.</li>
        <li>To keep accounts safe and stop bots and misuse.</li>
      </ul>
      <h2>Who we share it with</h2>
      <p>
        Only the services that run Wanlly: AI providers (Anthropic for Claude, Google for Gemini), Clerk (sign-in), Neon (database), Cloudflare (hosting and security) and our ad partners. Advertisers never receive your prompts or your work.
      </p>
      <p>
        <strong>Gemini during testing:</strong> while Wanlly uses Google&apos;s free Gemini access for testing, Google may use those prompts and replies to improve its products. We&apos;ll tell you clearly before that applies to you, and you can choose Claude instead.
      </p>
      <h2>What we never do</h2>
      <ul>
        <li>We never train AI on your prompts, files or projects.</li>
        <li>We never sell your personal information.</li>
        <li>We never target ads using sensitive information such as health, religion or politics.</li>
      </ul>
      <h2>Your choices</h2>
      <p>
        You can download or delete your data from Profile and settings at any time, and change your ad choices there. For anything else, <Link href="/contact" className="text-fg underline underline-offset-4">contact us</Link>.
      </p>
    </ProsePage>
  );
}
