# The Treasurer of Mwangaza Court

> **Spoilers.** This is the full design document, including the solution. Players must not read it before playing.

*Generated from `scenarios/mwangaza-court.json` by `npm run render`. Edit the JSON, not this file.*

| | |
|---|---|
| Location | South C, Nairobi |
| Tone | Warm neighbourhood drama with a sharp edge |
| Play time | about 20 minutes |
| Players | 4–6 |
| Variants | 2 (The chairman's cable, The caretaker's keys) |
| Content notes | A fatal fall in a stairwell, not described graphically; Debt and money worries in a savings group |

## Public introduction

It's Saturday night on the rooftop of Mwangaza Court, a six-storey block in South C. The residents' committee is holding a harambee (*community fundraiser*) for a new borehole pump, with pilau, a borrowed sound system and a Facebook live stream for residents who couldn't make it. At 21:10 the treasurer, Grace Achieng' Otieno, slipped downstairs to fetch her receipt book. At 21:35 her nephew found her at the foot of the back stairwell, between the fourth and fifth floors. Grace was alive at 21:15 and had fallen by 21:25. Someone at this harambee knows exactly how she got there.

**Victim:** Grace Achieng' Otieno, 48, primary school teacher and the committee's treasurer for six years. Precise, generous, and known for keeping every receipt.

**Window:** 21:15–21:25 at Back stairwell, 4th–5th floor landing.

## Cast (public)

| Character | Age | Occupation | Public bio | Relationship to the victim |
|---|---|---|---|---|
| Brian Kiprono | 34 | IT support technician | Committee chairman. Organised tonight's sound system and the Facebook live stream. | Has worked with Grace on the committee for three years. |
| Wambui Kamau | 29 | Nurse | Committee secretary and tonight's MC. Listens to true-crime podcasts on night shifts. | Grace was her mentor when she first moved into the block. |
| Kevin Otieno | 26 | Recent graduate, job-hunting | Staying with his aunt in 4B while he looks for work. | Grace's nephew. Neighbours heard them argue loudly this afternoon. |
| Faith Njeri Mwangi | 41 | Salon owner | Runs Njeri's Touch, the salon on the ground floor. The life of every party. | Grace had been chasing her for overdue chama (*savings group*) contributions. |
| Daniel Mutua | 45 | Caretaker | The landlord's caretaker. Has a key to every door in the block. | Grace had complained to the landlord about missed water-tanker deliveries. |
| Joseph Ekai | 40 | Night askari (security guard) | The block's night guard for five years. Keeps a careful logbook. | Grace brought him a flask of tea most evenings. |

**Seat order** (who is played first when there are fewer than 6 players; the culprit is always played): Brian Kiprono → Wambui Kamau → Kevin Otieno → Faith Njeri Mwangi → Daniel Mutua → Joseph Ekai. Characters nobody plays become non-player characters, and their statements go on the board at Discovery.

## Places and travel times

| | Rooftop (the harambee) | Back stairwell, 4th–5th floor landing | Flat 4B (Grace's flat) | Gate and askari booth | Parking yard | Mama Pendo's kiosk, across the road |
|---|---|---|---|---|---|---|
| **Rooftop (the harambee)** | 0 | 1 | 2 | 4 | 5 | 7 |
| **Back stairwell, 4th–5th floor landing** | 1 | 0 | 1 | 3 | 4 | 6 |
| **Flat 4B (Grace's flat)** | 2 | 1 | 0 | 4 | 5 | 7 |
| **Gate and askari booth** | 4 | 3 | 4 | 0 | 1 | 3 |
| **Parking yard** | 5 | 4 | 5 | 1 | 0 | 4 |
| **Mama Pendo's kiosk, across the road** | 7 | 6 | 7 | 3 | 4 | 0 |

Minutes on foot, shortest route. These figures drive both the alibi logic and the fairness check.

## Clues

**Starting clues** (on the board at Discovery)

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-msg` | Grace's last message, 21:15 | Sent to the family WhatsApp group at 21:15: 'Nimefika kwa nyumba, nachukua receipt book, narudi juu sasa hivi. (*I've got home, I'm grabbing the receipt book, I'm heading back up right now.*)' | Grace Achieng' Otieno at Flat 4B (Grace's flat), 21:15 | – |
| `c-found` | Found at 21:35 | Kevin found Grace at 21:35 on the landing between the fourth and fifth floors and shouted for help. Wambui, a nurse, reached her at 21:37 and says she had fallen some minutes earlier. The back-stairwell lights have been broken for weeks. The lift and the main stairs are at the front of the building. | Kevin Otieno at Back stairwell, 4th–5th floor landing, 21:35; Wambui Kamau at Back stairwell, 4th–5th floor landing, 21:37 | – |
| `c-5a` | The neighbour in 5A | Mrs Wairimu in 5A heard a cry and a clatter in the back stairwell and checked her phone: 21:19. She assumed it was children and did not open her door. | – | – |

**Search: Rooftop (the harambee)**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-live` | The Facebook live stream, 21:05–21:30 | The committee's live stream ran from Brian's phone on a tripod. From 21:05 to 21:30, Wambui is on the mic counting pledges and Faith is dancing by the speakers, both on camera the whole time. At 21:13 Brian walks out of frame towards the back-stairwell door and does not appear again before the stream ends. | Wambui Kamau at Rooftop (the harambee), 21:05–21:30; Faith Njeri Mwangi at Rooftop (the harambee), 21:05–21:30; Brian Kiprono at Rooftop (the harambee), 21:13 | *alibi* |

**Search: Back stairwell, 4th–5th floor landing**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-receipt` | Receipt book on the landing | Grace's receipt book lies open on the landing. Tucked inside is a list headed 'Defaulters, 3 months+', with Faith Njeri's name at the top: KSh 40,000. The book's last page, where Grace copied the committee's M-Pesa paybill totals, has been torn out. | – | *red-herring* |
| `c-cig` | Cigarette ends on the stairs | Three cigarette ends on the fourth-floor step, cold and stale. Somebody has been smoking here regularly, out of sight of the flats. | – | *red-herring* |

**Search: Flat 4B (Grace's flat)** (restricted: Insider only in round 1)

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-ledger` | Grace's ledger and sticky note | The committee ledger is open on Grace's table. A sticky note in her handwriting: 'Borehole fund KSh 186,000 moved 14 Feb from committee paybill to a personal line ending …4471. That is B's line. Confront B before the AGM.' | – | *motive*, *decisive* |
| `c-purse` | Grace's purse | An envelope in Grace's purse is labelled 'Kevin: rent help? NO.' and is KSh 2,000 short. A crushed cigarette packet sits on top of the kitchen bin. | – | *red-herring* |

**Search: Gate and askari booth**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-logbook` | The askari's logbook | In Joseph's handwriting: '21:10 all quiet. 21:14 tent lorry (Kitengela Hires), caretaker loading poles. 21:21 car alarm, checked parking with torch. NO ONE in yard, all cars locked. 21:24 back at gate. 21:26 lorry left, caretaker signed. 21:31 Kevin in from kiosk.' | Joseph Ekai at Gate and askari booth, 21:10–21:20; Joseph Ekai at Parking yard, 21:21–21:23; nobody (except Joseph Ekai) at Parking yard, 21:21–21:23; Joseph Ekai at Gate and askari booth, 21:24–21:30; Daniel Mutua at Gate and askari booth, 21:14–21:26; Kevin Otieno at Gate and askari booth, 21:31 | *alibi*, *decisive* |

**Search: Parking yard**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-car` | Brian's car | Brian's Toyota Fielder, with the committee sticker on the windscreen. The doors are locked. On the back seat, in plain view, is a coiled orange extension cable. | – | *decisive* |

**Search: Mama Pendo's kiosk, across the road**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-kiosk` | Mama Pendo's statement | 'Kevin was here from just after nine, watching the match replay. He paid me KSh 150 by M-Pesa at 21:17 for cigarettes and left after the second half kicked off, around 21:28. He even cleared the KSh 2,000 he owed me, this afternoon.' | Kevin Otieno at Mama Pendo's kiosk, across the road, 21:08–21:28 | *alibi* |

## Private role cards (original variant)

#### Brian Kiprono (Culprit)

- **Goal:** Don't be the top vote. You may lie about anything, including your whereabouts.
- **What really happened:** At 21:13 you followed Grace into the back stairwell to beg her not to raise the KSh 186,000 at the AGM. When she came out of 4B with the receipt book, you argued on the dark landing and you pushed her. You tore out the page with the M-Pesa totals, went down the back stairs to the parking yard (arriving at 21:24), and came back up the front stairs at 21:36.
- **Cover story:** "I went down to my car at 21:12 to fetch an extension cable for the speakers, sorted out the cable mess in the parking yard, and came back up about 21:35."
- **Danger:** Joseph sometimes checks the parking yard. The live stream may show which door you left by. And you never did bring the cable up.
- **Lesser secret you can confess (it's true):** You are three months behind on your own monthly contribution and have been hoping nobody checks.
- **Knows (in their own words):** "At 20:30 I borrowed Daniel's spare key to the back-stairwell store to bring up extra plastic chairs. It's still in my jacket pocket."

#### Wambui Kamau (Detective)

- **Goal:** Make sure the right person is named. Keep your move abroad quiet until you choose to share it.
- **Secret:** You have accepted a nursing job in the UK and fly in six weeks. You haven't told the committee you are leaving your post.
- **Knows (in their own words):** "I was on the mic from about 21:05 until 21:36, running the pledge count, and Faith was dancing by the speakers the whole time. I reached Grace at 21:37, and I could tell she had fallen some minutes earlier."

#### Kevin Otieno (Secret-keeper)

- **Goal:** Find your aunt's killer. Keep the money and the smoking out of it if you can.
- **Secret:** You smoke, which Grace banned in her flat. This afternoon she found your cigarettes, and found out you took KSh 2,000 from her purse to clear your kiosk debt. That was the argument.
- **Knows (in their own words):** "I was at Mama Pendo's kiosk across the road from just after 21:05 until about 21:28, watching the match replay on her TV. I walked back in through the gate at 21:31 and found Aunt Grace at 21:35."

#### Faith Njeri Mwangi (Secret-keeper)

- **Goal:** Don't let your debt become the story. Help find who did it.
- **Secret:** You owe the chama KSh 40,000 and took a loan from a shylock (*informal moneylender*) to cover salon rent. You have been terrified Grace would name you tonight.
- **Knows (in their own words):** "Grace texted me at 19:40: 'Tonight I'm only announcing totals, not names. Pole, tutaongea kesho. (*Sorry, we'll talk tomorrow.*)' She was never going to shame me in public."

#### Daniel Mutua (Insider)

- **Goal:** Find out what happened. Keep the tanker tips quiet.
- **Secret:** You take small 'tips' from the water-tanker driver for logging deliveries early. Grace's complaint was close to the truth.
- **Knows (in their own words):** "From 21:14 to 21:26 I was at the gate, helping the tent-hire driver load the rented tent poles onto his lorry. I signed his delivery note at 21:19."

#### Joseph Ekai (Witness)

- **Goal:** Help find the truth without losing your job.
- **Secret:** Some nights you leave the gate for an hour to visit your girlfriend in the next estate. Not tonight, but last month's logbook has a few entries you made up.
- **Knows (in their own words):** "At 21:21 a car alarm chirped, so I walked into the parking yard with my torch. Nobody was in the yard and every car was locked. I was back at the gate by 21:24."
- **Recall (witness ability):** I remember one more thing. At about 21:14, from the gate, I saw a shadow pass the fifth-floor window of the back stairwell, going down. Whoever it was wore one of tonight's green event lanyards. Committee members and helpers all had one.

## True timeline (original variant)

| From | To | Who | Where | Note |
|---|---|---|---|---|
| 20:00 | 21:13 | Brian Kiprono | Rooftop (the harambee) | Runs the stream; walks to the back-stairwell door at 21:13 |
| 20:00 | 20:40 | Daniel Mutua | Rooftop (the harambee) |  |
| 20:00 | 22:00 | Faith Njeri Mwangi | Rooftop (the harambee) | Dancing by the speakers |
| 20:00 | 21:10 | Grace Achieng' Otieno | Rooftop (the harambee) | Hosting the pledge table |
| 20:00 | 21:20 | Joseph Ekai | Gate and askari booth |  |
| 20:00 | 21:36 | Wambui Kamau | Rooftop (the harambee) | MC on the mic |
| 20:30 | 20:55 | Kevin Otieno | Flat 4B (Grace's flat) |  |
| 20:45 | 21:30 | Daniel Mutua | Gate and askari booth | Tent lorry, 21:14–21:26 |
| 21:05 | 21:28 | Kevin Otieno | Mama Pendo's kiosk, across the road | Match replay; pays M-Pesa at 21:17 |
| 21:12 | 21:15 | Grace Achieng' Otieno | Flat 4B (Grace's flat) | Fetches the receipt book; sends WhatsApp at 21:15 |
| 21:14 | 21:20 | Brian Kiprono | Back stairwell, 4th–5th floor landing | Waits on the landing, argues with Grace, pushes her |
| 21:16 | 21:40 | Grace Achieng' Otieno | Back stairwell, 4th–5th floor landing | Confronted on the landing; falls at about 21:19 |
| 21:21 | 21:23 | Joseph Ekai | Parking yard | Car alarm check |
| 21:24 | 21:30 | Brian Kiprono | Parking yard | Goes down the back stairs to his car to make his story true |
| 21:24 | 22:00 | Joseph Ekai | Gate and askari booth |  |
| 21:31 | 21:31 | Kevin Otieno | Gate and askari booth |  |
| 21:35 | 21:40 | Kevin Otieno | Back stairwell, 4th–5th floor landing | Finds Grace |
| 21:36 | 22:00 | Brian Kiprono | Rooftop (the harambee) |  |
| 21:37 | 21:50 | Wambui Kamau | Back stairwell, 4th–5th floor landing | Checks Grace |

## Variant A: The chairman's cable

**Roles:** Brian Kiprono: Culprit · Wambui Kamau: Detective · Kevin Otieno: Secret-keeper · Faith Njeri Mwangi: Secret-keeper · Daniel Mutua: Insider · Joseph Ekai: Witness

#### Solution

- **Culprit:** Brian Kiprono
- **Motive:** Grace had discovered that Brian moved KSh 186,000 of the borehole fund from the committee paybill to his own line in February, and she planned to confront him before the AGM.
- **Method:** He waited in the dark back stairwell, argued with Grace on the landing when she came out of 4B, and pushed her. Then he tore out the page with the paybill totals and went down to the parking yard to make his cable story true.
- **Summary:** Brian Kiprono did it. He is the only person the evidence doesn't place away from the stairwell, and his 'I was at my car' story fails twice: the askari found the yard empty at 21:21, and the cable he claimed to fetch is still on his back seat.
- **Decisive clues:** `c-logbook`, `c-car`, `c-ledger`

#### Solution path

1. The live stream clears Wambui and Faith: both are on camera on the rooftop for the whole window.
2. Mama Pendo clears Kevin (at the kiosk 21:08–21:28, six minutes from the stairwell). The askari's logbook clears Joseph and Daniel (at the gate or parking yard, three to four minutes away).
3. That leaves Brian with no alibi. The stream shows him walking to the back-stairwell door at 21:13.
4. Brian's story puts him at his car from 21:12. But Joseph checked the yard with a torch at 21:21 and found nobody there, and the cable he 'went to fetch' is still on his back seat.
5. Grace's sticky note in 4B gives the motive: KSh 186,000 moved to 'B's line', and 'Confront B before the AGM'.

#### Red herrings

- **Faith Njeri Mwangi.** *Why they look guilty:* Her name tops Grace's defaulters list, and she owes KSh 40,000. *The real explanation:* Grace had already texted Faith that she would only announce totals, not names. And the live stream shows Faith dancing on the rooftop for the whole window. (`c-receipt`, `c-live`)
- **Kevin Otieno.** *Why they look guilty:* He argued with Grace, took money from her purse, and smokes on those very stairs. *The real explanation:* The argument was about the cigarettes and the KSh 2,000, which he used to clear a kiosk debt. Mama Pendo puts him at her kiosk for the whole window. (`c-purse`, `c-cig`, `c-kiosk`)

#### Fair-play audit (computed by `scripts/check-scenarios.js` logic)

| Character | Board evidence | Clues that place them elsewhere |
|---|---|---|
| Brian Kiprono | **Not cleared** | `c-live` |
| Wambui Kamau | Cleared | `c-live` |
| Kevin Otieno | Cleared | `c-logbook`, `c-kiosk` |
| Faith Njeri Mwangi | Cleared | `c-live` |
| Daniel Mutua | Cleared | `c-logbook` |
| Joseph Ekai | Cleared | `c-logbook` |

Cover story ("I went down to my car at 21:12 to fetch an extension cable for the speakers, sorted out the cable mess in the parking yard, and came back up about 21:35.") is contradicted by `c-live`, `c-logbook`.
Searchable clues: 8, against 8 searches at the minimum player count.

## Variant B: The caretaker's keys

Same night, different culprit: Daniel the caretaker, whose water-tanker scheme Grace had uncovered. Brian really was at his car.

**What changes:** clue `c-live` changes; clue `c-ledger` changes; clue `c-logbook` changes; clue `c-car` changes; Brian Kiprono's movements change; Daniel Mutua's movements change; Daniel Mutua's card changes; Joseph Ekai's card changes.

**Changed clues**

| ID | Clue | Where | Text | Establishes |
|---|---|---|---|---|
| `c-live` | The Facebook live stream, 21:05–21:30 | Rooftop (the harambee) | The committee's live stream ran from Brian's phone on a tripod. From 21:05 to 21:30, Wambui is on the mic counting pledges and Faith is dancing by the speakers, both on camera the whole time. At 21:11 Brian heads for the front stairs. At 21:12 Daniel carries a stack of chairs out through the back-stairwell door. Neither comes back before the stream ends. | Wambui Kamau at Rooftop (the harambee), 21:05–21:30; Faith Njeri Mwangi at Rooftop (the harambee), 21:05–21:30; Brian Kiprono at Rooftop (the harambee), 21:11; Daniel Mutua at Rooftop (the harambee), 21:12 |
| `c-ledger` | Grace's ledger and sticky note | Flat 4B (Grace's flat) | The committee ledger is open on Grace's table. A sticky note in her handwriting: 'Tanker receipts: 9 deliveries charged Jan–Mar, KSh 3,500 each. The tanker company says only 3 came. All logged by D.M. Tell landlord Monday.' | – |
| `c-logbook` | The askari's logbook | Gate and askari booth | In Joseph's handwriting: '21:10 all quiet. 21:16 chairman into parking, opened his boot. 21:21 car alarm, checked parking with torch. Chairman at his boot with a cable. 21:24 back at gate. 21:26 tent lorry arrived, no caretaker to load, driver waiting. 21:28 caretaker came from the back door, out of breath, signed. 21:31 Kevin in from kiosk.' | Joseph Ekai at Gate and askari booth, 21:10–21:20; Joseph Ekai at Parking yard, 21:21–21:23; Joseph Ekai at Gate and askari booth, 21:24–21:30; Brian Kiprono at Parking yard, 21:16; Brian Kiprono at Parking yard, 21:21–21:23; Daniel Mutua **not** at Gate and askari booth, 21:10–21:27; Daniel Mutua at Gate and askari booth, 21:28; Kevin Otieno at Gate and askari booth, 21:31 |
| `c-car` | Brian's car | Parking yard | Brian's Toyota Fielder, with the committee sticker on the windscreen. The boot has been opened recently: the spare-wheel cover is pushed aside and an empty cable box lies inside. Whatever was in it has been taken out. | – |

**Culprit's card:** You carried chairs down the back stairwell at 21:12 and waited for Grace on the landing. She had your tanker receipts. When she refused to keep quiet, you pushed her. You took the long way round to the gate and arrived at 21:28, two minutes after the tent lorry, which had been waiting for you. Cover story: "From 21:10 I was at the gate waiting for the tent-hire lorry, then loading the poles until it left."

**True timeline**

| From | To | Who | Where | Note |
|---|---|---|---|---|
| 20:00 | 21:11 | Brian Kiprono | Rooftop (the harambee) |  |
| 20:00 | 21:12 | Daniel Mutua | Rooftop (the harambee) | Carrying chairs; leaves by the back-stairwell door at 21:12 |
| 20:00 | 22:00 | Faith Njeri Mwangi | Rooftop (the harambee) | Dancing by the speakers |
| 20:00 | 21:10 | Grace Achieng' Otieno | Rooftop (the harambee) | Hosting the pledge table |
| 20:00 | 21:20 | Joseph Ekai | Gate and askari booth |  |
| 20:00 | 21:36 | Wambui Kamau | Rooftop (the harambee) | MC on the mic |
| 20:30 | 20:55 | Kevin Otieno | Flat 4B (Grace's flat) |  |
| 21:05 | 21:28 | Kevin Otieno | Mama Pendo's kiosk, across the road | Match replay; pays M-Pesa at 21:17 |
| 21:12 | 21:15 | Grace Achieng' Otieno | Flat 4B (Grace's flat) | Fetches the receipt book; sends WhatsApp at 21:15 |
| 21:14 | 21:21 | Daniel Mutua | Back stairwell, 4th–5th floor landing | Confronts Grace about the tanker receipts and pushes her |
| 21:16 | 21:32 | Brian Kiprono | Parking yard | Really does fetch and untangle the cable |
| 21:16 | 21:40 | Grace Achieng' Otieno | Back stairwell, 4th–5th floor landing | Confronted on the landing; falls at about 21:19 |
| 21:21 | 21:23 | Joseph Ekai | Parking yard | Car alarm check |
| 21:24 | 22:00 | Joseph Ekai | Gate and askari booth |  |
| 21:28 | 21:40 | Daniel Mutua | Gate and askari booth | Arrives late for the tent lorry, out of breath |
| 21:31 | 21:31 | Kevin Otieno | Gate and askari booth |  |
| 21:35 | 21:40 | Kevin Otieno | Back stairwell, 4th–5th floor landing | Finds Grace |
| 21:37 | 22:00 | Brian Kiprono | Rooftop (the harambee) |  |
| 21:37 | 21:50 | Wambui Kamau | Back stairwell, 4th–5th floor landing | Checks Grace |

**Roles:** Brian Kiprono: Insider · Wambui Kamau: Detective · Kevin Otieno: Secret-keeper · Faith Njeri Mwangi: Secret-keeper · Daniel Mutua: Culprit · Joseph Ekai: Witness

#### Solution

- **Culprit:** Daniel Mutua
- **Motive:** Grace had proof that Daniel charged residents for nine water-tanker deliveries when only three came, and she was going to tell the landlord on Monday.
- **Method:** He carried chairs out through the back-stairwell door at 21:12, waited on the dark landing, and pushed her when she refused to keep quiet. He reached the gate at 21:28, late for the tent lorry.
- **Summary:** Daniel Mutua did it. He leaves the stream through the back-stairwell door at 21:12, and the askari's log shows he was not at the gate until 21:28, even though the lorry was waiting for him from 21:26.
- **Decisive clues:** `c-logbook`, `c-live`, `c-ledger`

#### Solution path

1. The live stream clears Wambui and Faith, and Mama Pendo clears Kevin.
2. The askari's logbook places Brian at his car at 21:16 and 21:21–21:23, four minutes from the stairwell, which covers the whole window. Joseph clears himself the same way.
3. Daniel claims he was at the gate from 21:10. The log says the lorry waited from 21:26 with no caretaker, and Daniel arrived out of breath from the back door at 21:28.
4. The stream shows Daniel leaving through the back-stairwell door at 21:12, just before Grace came out of 4B.
5. The sticky note in 4B gives the motive: nine tanker deliveries charged and three delivered, all logged by D.M.

#### Red herrings

- **Faith Njeri Mwangi.** *Why they look guilty:* Her name tops Grace's defaulters list, and she owes KSh 40,000. *The real explanation:* Grace had already texted Faith that she would only announce totals, not names. And the live stream shows Faith dancing on the rooftop for the whole window. (`c-receipt`, `c-live`)
- **Kevin Otieno.** *Why they look guilty:* He argued with Grace, took money from her purse, and smokes on those very stairs. *The real explanation:* The argument was about the cigarettes and the KSh 2,000, which he used to clear a kiosk debt. Mama Pendo puts him at her kiosk for the whole window. (`c-purse`, `c-cig`, `c-kiosk`)

#### Fair-play audit (computed by `scripts/check-scenarios.js` logic)

| Character | Board evidence | Clues that place them elsewhere |
|---|---|---|
| Brian Kiprono | Cleared | `c-live`, `c-logbook` |
| Wambui Kamau | Cleared | `c-live` |
| Kevin Otieno | Cleared | `c-logbook`, `c-kiosk` |
| Faith Njeri Mwangi | Cleared | `c-live` |
| Daniel Mutua | **Not cleared** | `c-live`, `c-logbook` |
| Joseph Ekai | Cleared | `c-logbook` |

Cover story ("From 21:10 I was at the gate waiting for the tent-hire lorry, then loading the poles until it left.") is contradicted by `c-live`, `c-logbook`.
Searchable clues: 8, against 8 searches at the minimum player count.

## Details needing local review

- [ ] South C is a real Nairobi neighbourhood; Mwangaza Court and everyone in it are fictional. Check that the rooftop harambee, back stairwell and gate logbook feel true to a mid-size South C block.
- [ ] Kiswahili lines ('Nimefika kwa nyumba…', 'Pole, tutaongea kesho') need a native-speaker check for natural phrasing.
- [ ] Confirm that live-streaming an estate harambee on Facebook is common enough to be unremarkable.
