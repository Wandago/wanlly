# 1. Pitch and title

## The pitch

**Mtaa Mysteries** is a browser game for 4–6 friends. It takes about 20 minutes, and a death has just happened somewhere in Kenya: an apartment-block harambee in South C, a blackout at a heritage hotel in Mombasa's Old Town, a university reunion on Lake Victoria. Every player becomes someone who was there. One of you did it.

Everyone gets a private card with a goal, a secret and what they saw. The culprit's card says what really happened and offers a cover story. Over two short investigation rounds you search the scene, share (or sit on) what you find, and test each other's stories against the clock: *the kiosk is six minutes from the stairwell, so where were you at 21:19?* Then comes a secret, simultaneous vote.

The hook is one rule: **only the culprit may lie.** Everyone else can dodge, deflect and keep secrets, and every innocent character has a secret worth keeping. So the table is full of people acting guilty for good reasons, and one person who actually is. Every case is checked by machine to make sure attentive players can solve it from the evidence alone.

It plays like the social deduction games people already love. Here, though, the deduction rests on alibis, timelines and travel times rather than luck. The world it shows is specific: chama debts, askari logbooks, M-Pesa receipts, matatu stages, taarab played unplugged during a power cut.

## Title options

| Title | Why it works | Risk |
|---|---|---|
| **Mtaa Mysteries** | *Mtaa* (neighbourhood, "the hood") is warm, local and instantly Kenyan, and pairs naturally with "mysteries". | Could read as Nairobi-only, though the cases range far beyond it. |
| Nani Alifanya? ("Who did it?") | A question every player is asking. Kiswahili first. | Harder to search for and say for non-Swahili speakers; not as warm. |
| Alibi ya Saa Tatu ("The 9 o'clock alibi") | Names the core mechanic: times and alibis. | Long; tied to one time of day. |
| Ushahidi ("Evidence") | Strong and simple. | Already the name of a well-known Kenyan crisis-mapping platform. Avoid. |
| The Last Matatu | Evocative. | Promises a transport setting that only some cases have. |
| Kesi ("The case") | Short and punchy, everyday Sheng/Kiswahili. | Very generic; hard to own as a brand. |

**Chosen: Mtaa Mysteries.** It is the friendliest to say, the easiest to spell, and it sets the tone: neighbourly, curious, a little gossipy. Each scenario keeps its own place name in its title (Mwangaza Court, Bahari House, Kianjogu Market), so the series doesn't feel Nairobi-only.

*Before launch:* run trademark and app-store searches for all shortlisted names, and ask Kenyan players across regions how "mtaa" lands outside Nairobi (see `10-quality-checklist.md`).

## What makes it different

- **Solvable by design.** Every scenario is data, and `npm run check:scenarios` proves for each variant that the evidence clears every innocent and only them. No case relies on a random power or a reveal that only comes at the end.
- **Secrets aren't guilt.** Innocent players are rewarded for keeping their secret, so suspicion is cheap and evidence matters.
- **Built for text.** Phases are short and structured, so groups without voice chat play on equal terms.
- **Specific, not generic.** Six regions and six social worlds, with Kiswahili and Sheng used lightly and glossed for anyone who needs it.
