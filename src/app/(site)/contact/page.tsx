import type { Metadata } from "next";
import { ContactForm } from "@/components/site/contact-form";
import { Icon } from "@/components/icon";

export const metadata: Metadata = { title: "Contact · Wanlly", description: "Questions, partnerships, press and advertising." };

const WAYS = [
  { icon: "chat" as const, title: "Questions and support", text: "Something not working, or not sure how something works? Send us a note." },
  { icon: "bolt" as const, title: "Advertise to students and creators", text: "Reach verified students and builders in 60+ countries, beside their work, never inside it.", id: "advertise" },
  { icon: "users" as const, title: "Partnerships and press", text: "Universities, communities, hackathons and journalists: we'd love to hear from you." },
];

export default function ContactPage() {
  return (
    <>
      <section className="border-b border-line bg-side">
        <div className="mx-auto flex max-w-[1080px] flex-col gap-3 px-4 py-16 sm:px-6">
          <span className="text-xs font-medium tracking-[0.08em] text-accent uppercase">Contact</span>
          <h1 className="font-display text-[clamp(30px,4.4vw,46px)] leading-[1.05] font-semibold tracking-[-0.035em]">Talk to us.</h1>
          <p className="max-w-[56ch] text-[15px] text-muted">We&apos;re a small team in Nairobi and we read everything.</p>
        </div>
      </section>
      <section className="mx-auto grid max-w-[1080px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="flex flex-col gap-5">
          {WAYS.map((w) => (
            <div key={w.title} id={w.id} className="flex scroll-mt-24 gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                <Icon name={w.icon} size={16} />
              </span>
              <div className="flex flex-col gap-0.5">
                <b className="font-semibold">{w.title}</b>
                <p className="text-sm text-muted">{w.text}</p>
              </div>
            </div>
          ))}
        </div>
        <ContactForm />
      </section>
    </>
  );
}
