# Short Weight at Kianjogu Market

> **Spoilers.** This is the full design document, including the solution. Players must not read it before playing.

*Generated from `scenarios/short-weight.json` by `npm run render`. Edit the JSON, not this file.*

| | |
|---|---|
| Location | Market town, Nyeri County |
| Tone | Daylight, small-town and rural; a community that trusts its scales |
| Play time | about 20 minutes |
| Players | 4–6 |
| Variants | 2 (The tampered scale, The ghost members) |
| Content notes | A death under a toppled stack of crates, not described graphically; Farmers being cheated, and debt |

## Public introduction

It's AGM day for the Tumaini Avocado Growers cooperative at Kianjogu Market, in the hills of Nyeri County. Two hundred farmers have packed the market hall to hear the chairwoman, Teresia Wangari Maina, report on prices, a new export contract and complaints that avocados are being 'short-weighed'. At 10:35, during the tea break, Teresia tells the hall she is going to 'check something in the store' and walks out. At 11:05 the store-keeper finds her under a toppled stack of avocado crates. The county doctor says it happened between 10:40 and 11:00, and the stack could not have fallen on its own.

**Victim:** Teresia Wangari Maina, 57, chairwoman of the cooperative for eight years. A widow and coffee-turned-avocado farmer, respected for honesty and feared for her memory.

**Window:** 10:40–11:00 at Produce store.

## Cast (public)

| Character | Age | Occupation | Public bio | Relationship to the victim |
|---|---|---|---|---|
| Peris Nyokabi Gitau | 45 | Farmer and vice-chair | Vice-chair of the cooperative for five years. Keeps the keys to the scale boxes in the weighing shed. | Teresia's deputy and expected successor. |
| Mzee Njoroge Wachira | 66 | Farmer | A founding member. Lost the chair election to Teresia in 2019 and has never let it go. | Shouted at Teresia during this morning's session. |
| Caroline Muthoni | 28 | Cooperative clerk | The cooperative's clerk and minute-taker. Holds the office keys and the ledgers. | Teresia hired her and paid her college fees. |
| Abdi Hassan Farah | 35 | Avocado export broker | Buys from the cooperative for supermarkets in Europe. Grew up in Garissa, studied agribusiness in Nairobi, and knows the price of everything. | Teresia refused to sign his new contract until he paid last season's arrears. |
| Gladys Jebet | 38 | County agricultural extension officer | Posted to Nyeri from Kericho last year. Knows scales, soils and every way a farmer can be cheated. | Had been helping Teresia document the short-weighing complaints. |
| Kamau Gitonga | 24 | Boda boda rider | Carries the cooperative's crates from the farms to the market on his motorbike. | Teresia lent him the deposit for his motorbike. |

**Seat order** (who is played first when there are fewer than 6 players; the culprit is always played): Peris Nyokabi Gitau → Mzee Njoroge Wachira → Gladys Jebet → Abdi Hassan Farah → Caroline Muthoni → Kamau Gitonga. Characters nobody plays become non-player characters, and their statements go on the board at Discovery.

## Places and travel times

| | Produce store | Weighing shed | Market hall (the AGM) | Market stalls | Tea kiosk across the lane | Matatu stage | Cooperative office |
|---|---|---|---|---|---|---|---|
| **Produce store** | 0 | 1 | 2 | 2 | 2 | 4 | 3 |
| **Weighing shed** | 1 | 0 | 3 | 3 | 3 | 3 | 4 |
| **Market hall (the AGM)** | 2 | 3 | 0 | 1 | 4 | 4 | 1 |
| **Market stalls** | 2 | 3 | 1 | 0 | 4 | 3 | 2 |
| **Tea kiosk across the lane** | 2 | 3 | 4 | 4 | 0 | 6 | 5 |
| **Matatu stage** | 4 | 3 | 4 | 3 | 6 | 0 | 5 |
| **Cooperative office** | 3 | 4 | 1 | 2 | 5 | 5 | 0 |

Minutes on foot, shortest route. These figures drive both the alibi logic and the fairness check.

## Clues

**Starting clues** (on the board at Discovery)

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-left` | Teresia leaves the AGM | At 10:35, during the tea break, Teresia told the hall she was 'going to check something in the store' and walked out. The meeting resumed at 10:40. | Teresia Wangari Maina at Market hall (the AGM), 10:35 | – |
| `c-found` | Found at 11:05 | At 11:05 the store-keeper found Teresia under a toppled stack of avocado crates. The county doctor says it happened between about 10:40 and 11:00. Marks on the floor show the stack was pushed from the aisle side. It did not fall by itself. | – | – |
| `c-shout` | Tempers at the AGM | At 10:20 Mzee Njoroge shouted across the hall at Teresia: 'Utaona! (*You'll see!*)' Abdi, the broker, left the meeting soon afterwards following a heated exchange with her about arrears. Everyone attending was given a green AGM apron. | – | *red-herring* |

**Search: Produce store**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-notebook` | Teresia's notebook | Teresia's notebook, open on a crate in her handwriting: 'Scale #2 short by 1.5 kg a crate since March, about 1,200 kg a month. Only P. has the key to the scale box. Tell the AGM today.' | – | *motive*, *decisive* |

**Search: Weighing shed**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-weighlog` | The weighing-shed log | The handwritten log for scale #2 ends: 'P. Nyokabi, test weighing, 0 kg, 10:52.' The scale-box padlock is open. There's only one key, and the vice-chair keeps it. | Peris Nyokabi Gitau at Weighing shed, 10:52 | *decisive* |
| `c-weight` | Scale #2 | Scale #2's brass calibration weight is missing from its slot. Gladys tests the scale with a known sack: it reads 1.5 kg light. | – | *decisive* |

**Search: Market hall (the AGM)**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-minutes` | The meeting minutes | Caroline's minutes: '10:40 to 11:00, Mzee Njoroge Wachira has the floor (fertiliser prices).' The secretary's signature runs down every page, 10:30 to 11:05. Next to the vice-chair's name: 'stepped out 10:38, returned 10:59'. | Mzee Njoroge Wachira at Market hall (the AGM), 10:40–11:00; Caroline Muthoni at Market hall (the AGM), 10:30–11:05; Peris Nyokabi Gitau at Market hall (the AGM), 10:59 | *alibi* |

**Search: Market stalls**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-demo` | The county Facebook post | The county's agriculture Facebook page posted photos from Gladys's grading demonstration, timestamped 10:36 to 11:04, with Gladys in every frame. | Gladys Jebet at Market stalls, 10:36–11:04 | *alibi* |

**Search: Tea kiosk across the lane**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-kiosk` | The tea kiosk owner | 'Kamau sat right there from about 10:40 until after eleven, waiting for a job. He had two cups of tea and paid by M-Pesa at 10:47.' | Kamau Gitonga at Tea kiosk across the lane, 10:40–11:02 | *alibi* |

**Search: Matatu stage**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-cess` | The cess receipt and the turn-boy | Abdi's lorry turn-boy: 'He was here loading with us from half past ten until we left, after eleven.' A county cess receipt, stamped at the stage, is timed 10:52. | Abdi Hassan Farah at Matatu stage, 10:30–11:10 | *alibi* |

**Search: Cooperative office** (restricted: Insider only in round 1)

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-arrears` | The arrears file | A file on Abdi Hassan Farah: 'KSh 380,000 unpaid since last season. No new contract until paid.' Pinned to it is a printout of Abdi's SMS at 10:25: 'Mama, I will pay on Friday, please don't embarrass me in front of the AGM.' | – | *red-herring* |

## Private role cards (original variant)

#### Peris Nyokabi Gitau (Culprit)

- **Goal:** Don't be the top vote. You may lie about anything, including your whereabouts.
- **What really happened:** Since March you have used scale #2 to short-weigh members' avocados by 1.5 kg a crate, and sold the difference to a broker. Teresia worked it out. At 10:41 you followed her into the store and begged her not to tell the AGM. When she refused, you pushed the crate stack onto her. You went to the weighing shed, refitted the brass weight, logged a 'test weighing' to explain why you were there, and slipped back into the hall at 10:59.
- **Cover story:** "At 10:38 I went to the market stalls for airtime and some sukuma (*kale, the everyday greens*), and came back to the hall at about 11:00."
- **Danger:** You signed the weighing log. Someone at the kiosk may have seen the store's side door. Teresia kept notes on everything.
- **Lesser secret you can confess (it's true):** You have been selling some of your own avocados to a broker on the side, breaking the cooperative's collective-sale rule.
- **Knows (in their own words):** "At 10:30 Teresia told me she was going to 'check the weights in the store myself' after the tea break."

#### Mzee Njoroge Wachira (Secret-keeper)

- **Goal:** Find who did it. Keep the farm sale secret.
- **Secret:** You are quietly negotiating to sell your farm to a developer, and your children don't know.
- **Knows (in their own words):** "I took the floor at 10:40 and spoke until 11:00 about the price of fertiliser. Caroline wrote it all down."

#### Caroline Muthoni (Insider)

- **Goal:** Find the truth for Teresia. Keep the CV business quiet.
- **Secret:** You use the cooperative's office computer to run a side business typing CVs.
- **Knows (in their own words):** "I took the minutes in the hall from 10:30 to 11:05 without leaving my seat."

#### Abdi Hassan Farah (Secret-keeper)

- **Goal:** Find who did it. Keep the licence review quiet before the contract is signed.
- **Secret:** Your export licence is under review after a shipment was rejected in Rotterdam.
- **Knows (in their own words):** "From 10:30 until after 11:00 I was at the matatu stage, loading crates onto my lorry. I paid the county cess at 10:52."

#### Gladys Jebet (Detective)

- **Goal:** Solve it. Don't reveal your transfer request yet.
- **Secret:** You have applied for a transfer back to Kericho, and might leave before the investigation you started is finished.
- **Knows (in their own words):** "I ran an avocado-grading demonstration for about twenty farmers at the market stalls, from 10:35 to 11:05."

#### Kamau Gitonga (Witness)

- **Goal:** Find who did it. Keep the missed repayments quiet.
- **Secret:** You have missed three repayments on that loan and have been avoiding her.
- **Knows (in their own words):** "From about 10:40 I sat at the tea kiosk across the lane, waiting for a delivery job. At about 10:47 I saw someone come out of the store's side door and walk towards the weighing shed."
- **Recall (witness ability):** I remember one more detail: whoever it was wore one of the cooperative's green AGM aprons, and walked fast with their head down.

## True timeline (original variant)

| From | To | Who | Where | Note |
|---|---|---|---|---|
| 09:00 | 10:20 | Abdi Hassan Farah | Market hall (the AGM) |  |
| 09:00 | 11:30 | Caroline Muthoni | Market hall (the AGM) |  |
| 09:00 | 10:30 | Gladys Jebet | Market hall (the AGM) |  |
| 09:00 | 11:30 | Mzee Njoroge Wachira | Market hall (the AGM) |  |
| 09:00 | 10:38 | Peris Nyokabi Gitau | Market hall (the AGM) |  |
| 09:00 | 10:35 | Teresia Wangari Maina | Market hall (the AGM) |  |
| 09:30 | 10:30 | Kamau Gitonga | Matatu stage |  |
| 10:30 | 11:10 | Abdi Hassan Farah | Matatu stage |  |
| 10:35 | 11:05 | Gladys Jebet | Market stalls |  |
| 10:38 | 11:30 | Teresia Wangari Maina | Produce store | Checks the crates against the weighing tickets |
| 10:40 | 11:05 | Kamau Gitonga | Tea kiosk across the lane |  |
| 10:41 | 10:47 | Peris Nyokabi Gitau | Produce store | Argues with Teresia and pushes the crate stack onto her |
| 10:48 | 10:56 | Peris Nyokabi Gitau | Weighing shed | Puts the calibration weight back in her bag; logs a fake weighing |
| 10:59 | 11:30 | Peris Nyokabi Gitau | Market hall (the AGM) |  |

## Variant A: The tampered scale

**Roles:** Peris Nyokabi Gitau: Culprit · Mzee Njoroge Wachira: Secret-keeper · Caroline Muthoni: Insider · Abdi Hassan Farah: Secret-keeper · Gladys Jebet: Detective · Kamau Gitonga: Witness

#### Solution

- **Culprit:** Peris Nyokabi Gitau
- **Motive:** Peris had been short-weighing members' avocados on scale #2 and selling the difference. Teresia's notebook proved it and she was about to tell the AGM.
- **Method:** Peris followed Teresia into the store, argued with her, and pushed the crate stack onto her. Then she went to the weighing shed, refitted the calibration weight and logged a fake 'test weighing'.
- **Summary:** Peris Nyokabi Gitau did it. Everyone else is placed away from the store for the whole window. Peris says she was at the market stalls, but she signed the weighing log at 10:52. The weighing shed is one minute from the store, and the scale she alone holds the key to reads 1.5 kg light.
- **Decisive clues:** `c-weighlog`, `c-notebook`, `c-weight`

#### Solution path

1. The minutes clear Njoroge and Caroline, the county photos clear Gladys, the cess receipt and turn-boy clear Abdi, and the kiosk owner clears Kamau.
2. Peris left the hall at 10:38 and returned at 10:59, right across the window. She says she went to the market stalls.
3. But the weighing-shed log has her own entry at 10:52, one minute from the store, and the scale-box padlock is open.
4. Teresia's notebook ('Only P. has the key') and the scale reading 1.5 kg light give the motive.

#### Red herrings

- **Mzee Njoroge Wachira.** *Why they look guilty:* He shouted 'Utaona!' at Teresia twenty minutes before she died. *The real explanation:* An old rival's bluster. The minutes show him holding the floor in the hall for the whole window. (`c-shout`, `c-minutes`)
- **Abdi Hassan Farah.** *Why they look guilty:* He owes the cooperative KSh 380,000, Teresia was blocking his contract, and he left the meeting angry. *The real explanation:* He was pleading for time, not plotting. His turn-boy and the cess receipt put him at the matatu stage for the whole window. (`c-arrears`, `c-cess`)

#### Fair-play audit (computed by `scripts/check-scenarios.js` logic)

| Character | Board evidence | Clues that place them elsewhere |
|---|---|---|
| Peris Nyokabi Gitau | **Not cleared** | `c-minutes`, `c-weighlog` |
| Mzee Njoroge Wachira | Cleared | `c-minutes` |
| Caroline Muthoni | Cleared | `c-minutes` |
| Abdi Hassan Farah | Cleared | `c-cess` |
| Gladys Jebet | Cleared | `c-demo` |
| Kamau Gitonga | Cleared | `c-kiosk` |

Cover story ("At 10:38 I went to the market stalls for airtime and some sukuma (*kale, the everyday greens*), and came back to the hall at about 11:00.") is contradicted by `c-weighlog`.
Searchable clues: 8, against 8 searches at the minimum player count.

## Variant B: The ghost members

Same trail, different motive: Teresia had discovered forty 'ghost members' Peris had registered to inflate the cooperative's numbers for a county grant.

**What changes:** clue `c-notebook` changes; clue `c-weight` changes.

**Changed clues**

| ID | Clue | Where | Text | Establishes |
|---|---|---|---|---|
| `c-notebook` | Teresia's notebook | Produce store | Teresia's notebook, open on a crate in her handwriting: 'Members' register: 41 names nobody has ever met, all signed up by P. in January, just before the county grant application. The grant pays per member. Tell the AGM today.' | – |
| `c-weight` | Scale #2 | Weighing shed | The scale-box padlock is open and the box has been searched. A pile of membership cards held with a rubber band is stuffed behind the scale, all filled in with the same pen in the same handwriting. | – |

**Culprit's card:** In January you registered forty-one 'ghost members' so the cooperative's county grant, which pays per member, would come in larger, and you kept the difference. Teresia found the names. At 10:41 you followed her into the store and begged her not to tell the AGM. When she refused, you pushed the crate stack onto her. You hid the fake membership cards behind scale #2 in the weighing shed, logged a 'test weighing', and slipped back into the hall at 10:59. Cover story: "At 10:38 I went to the market stalls for airtime and some sukuma (*kale, the everyday greens*), and came back to the hall at about 11:00."

**Roles:** Peris Nyokabi Gitau: Culprit · Mzee Njoroge Wachira: Secret-keeper · Caroline Muthoni: Insider · Abdi Hassan Farah: Secret-keeper · Gladys Jebet: Detective · Kamau Gitonga: Witness

#### Solution

- **Culprit:** Peris Nyokabi Gitau
- **Motive:** Peris had registered forty-one ghost members to inflate a per-member county grant, and Teresia was about to expose it.
- **Method:** She pushed the crate stack onto Teresia in the store, then hid the fake membership cards in the weighing shed.
- **Summary:** Peris Nyokabi Gitau did it. The alibi trail is the same: her own 10:52 entry in the weighing log breaks her market-stall story, and the fake cards behind scale #2 match Teresia's notebook.
- **Decisive clues:** `c-weighlog`, `c-notebook`, `c-weight`

#### Solution path

1. The minutes, county photos, cess receipt and kiosk owner clear everyone except Peris.
2. Peris claims she was at the market stalls, but she signed the weighing log at 10:52, a minute from the store.
3. The fake membership cards stuffed behind scale #2, in one hand, match Teresia's note about 41 ghost members signed up by P.

#### Red herrings

- **Mzee Njoroge Wachira.** *Why they look guilty:* He shouted 'Utaona!' at Teresia twenty minutes before she died. *The real explanation:* An old rival's bluster. The minutes show him holding the floor in the hall for the whole window. (`c-shout`, `c-minutes`)
- **Abdi Hassan Farah.** *Why they look guilty:* He owes the cooperative KSh 380,000, Teresia was blocking his contract, and he left the meeting angry. *The real explanation:* He was pleading for time, not plotting. His turn-boy and the cess receipt put him at the matatu stage for the whole window. (`c-arrears`, `c-cess`)

#### Fair-play audit (computed by `scripts/check-scenarios.js` logic)

| Character | Board evidence | Clues that place them elsewhere |
|---|---|---|
| Peris Nyokabi Gitau | **Not cleared** | `c-minutes`, `c-weighlog` |
| Mzee Njoroge Wachira | Cleared | `c-minutes` |
| Caroline Muthoni | Cleared | `c-minutes` |
| Abdi Hassan Farah | Cleared | `c-cess` |
| Gladys Jebet | Cleared | `c-demo` |
| Kamau Gitonga | Cleared | `c-kiosk` |

Cover story ("At 10:38 I went to the market stalls for airtime and some sukuma (*kale, the everyday greens*), and came back to the hall at about 11:00.") is contradicted by `c-weighlog`.
Searchable clues: 8, against 8 searches at the minimum player count.

## Details needing local review

- [ ] Kianjogu Market and the Tumaini Avocado Growers cooperative are fictional; Nyeri County's avocado and coffee farming is real. Check the cooperative details (AGM in the market hall, a weighing shed, the county extension officer, cess receipts).
- [ ] Kikuyu names and the Kiswahili interjection 'Utaona!' need a native-speaker check for naturalness.
- [ ] Abdi is a Somali Kenyan export broker. Check that he reads as a full character, not a stereotype of the 'outsider trader'.
