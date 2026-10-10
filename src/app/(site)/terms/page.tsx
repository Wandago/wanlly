import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/site/prose";

export const metadata: Metadata = { title: "Terms · Wanlly" };

export default function TermsPage() {
  return (
    <ProsePage eyebrow="Terms" title="Terms of use" intro="Plain-language summary for the beta. A full version, reviewed by a lawyer, comes before Wanlly opens widely.">
      <h2>Who can use Wanlly</h2>
      <p>You must be 18 or older during the beta, and one person may have one account.</p>
      <h2>Credits</h2>
      <ul>
        <li>Credits are earned by watching sponsor ads and similar offers. They have no cash value and can&apos;t be sold, transferred or exchanged.</li>
        <li>Rewards follow what each ad actually pays, so they can change. Credits from fake or invalid views are removed.</li>
      </ul>
      <h2>Fair use</h2>
      <ul>
        <li>No bots, scripts, fake accounts or attempts to get around limits.</li>
        <li>No reselling access to Wanlly or using it as an API for other apps.</li>
        <li>Follow the usage policies of the AI provider you use, and the law. No harmful or illegal content.</li>
      </ul>
      <h2>Your work</h2>
      <p>You own what you create. We only use it to run Wanlly for you, and we never train AI on it. AI can make mistakes, so check anything important.</p>
      <h2>Accounts</h2>
      <p>We may slow down, pause or close accounts that break these terms. A person reviews every pause, and you can appeal by <Link href="/contact" className="text-fg underline underline-offset-4">contacting us</Link>.</p>
    </ProsePage>
  );
}
