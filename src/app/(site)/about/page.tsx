import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/site/prose";

export const metadata: Metadata = { title: "About · Wanlly", description: "Why Wanlly exists, and how it stays free." };

export default function AboutPage() {
  return (
    <ProsePage eyebrow="About" title="Good ideas shouldn't wait for a credit card." intro="Wanlly gives students and creators everywhere the same frontier AI the best-funded teams use, paid for by sponsors instead of subscriptions.">
      <h2>Why we started</h2>
      <p>
        The best AI tools cost $20 a month or more. For a student in Nairobi, Lagos, Dhaka or São Paulo, that&apos;s a week of food. So the people with some of the most interesting ideas build with the weakest tools, or not at all. Wanlly started in Nairobi to change that.
      </p>
      <h2>How it works</h2>
      <p>
        Brands want to reach curious, ambitious people. When you choose to watch a short video, they pay for it, and that money buys your AI time. One video a day unlocks a floor of credits that&apos;s the same in every country. Extra videos, short surveys and sponsor trials add more.
      </p>
      <h2>What we promise</h2>
      <ul>
        <li><strong>Your work stays yours.</strong> We never train AI on your prompts, files or projects.</li>
        <li><strong>Sponsors see nothing.</strong> Ads sit beside your work, never inside an answer, and advertisers never see what you write.</li>
        <li><strong>No card, ever, for the free product.</strong> You never pay to use Wanlly.</li>
        <li><strong>Fair everywhere.</strong> Where you live never decides whether you can build.</li>
      </ul>
      <h2>Who&apos;s behind it</h2>
      <p>
        Wanlly is built in Nairobi, with Claude as a coding partner. We&apos;re small, early and building in public. If you want to help, sponsor, or just say hello, <Link href="/contact" className="text-fg underline underline-offset-4">get in touch</Link>.
      </p>
      <p>
        <Link href="/beta" className="mt-4 inline-flex rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-bg no-underline">Join the beta</Link>
      </p>
    </ProsePage>
  );
}
