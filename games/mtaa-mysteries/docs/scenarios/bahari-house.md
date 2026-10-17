# Blackout at Bahari House

> **Spoilers.** This is the full design document, including the solution. Players must not read it before playing.

*Generated from `scenarios/bahari-house.json` by `npm run render`. Edit the JSON, not this file.*

| | |
|---|---|
| Location | Old Town, Mombasa |
| Tone | Candlelit and atmospheric, an old house full of old loyalties |
| Play time | about 20 minutes |
| Players | 4–6 |
| Variants | 2 (The structural report, The architect's daughter) |
| Content notes | A death by a blow, not described graphically; A family business facing sale |

## Public introduction

Bahari House is a restored Swahili merchant's house in Mombasa's Old Town: a courtyard open to the sky, carved doors, a first-floor gallery and a roof terrace looking towards Fort Jesus. Tonight a Nairobi consortium is finalising its purchase, and dinner is tense. At 20:40 the power fails across Old Town. The taarab band plays on unplugged, lanterns are lit, and the manager, Rashid Omar Bakari, goes up to his office to phone the power company. When the lights return at 21:10 he is found on his office floor. He was alive at 20:47 and did not answer his phone at 21:05.

**Victim:** Rashid Omar Bakari, 61, manager of Bahari House for thirty years. Courteous, stubborn, and fiercely protective of the building.

**Window:** 20:47–21:05 at Manager's office.

## Cast (public)

| Character | Age | Occupation | Public bio | Relationship to the victim |
|---|---|---|---|---|
| Lydia Chebet | 33 | Conservation architect | From Eldoret, now with a Nairobi heritage firm. Surveyed the coral-stone walls for the sale. Wore a green fringed leso (*a printed cotton wrap*) at dinner. | Rashid challenged every line of her structural report. |
| Peter Njoroge Kamau | 55 | Property investor | Leads the Nairobi consortium buying Bahari House. Wants a rooftop bar and twenty more rooms. | Argued with Rashid at dinner, loudly, in front of everyone. |
| Amina Said | 38 | Assistant manager | Twelve years at Bahari House. Knows every key and every creaky stair. | Rashid's protégée, expected to take over when he retired. |
| Omar Hassan | 24 | Night receptionist | Studies hospitality management by day and works the front desk by night. | Rashid hired him straight out of college. |
| Achieng' Odhiambo | 45 | Travel journalist | Writing a feature on Old Town hotels for a travel magazine. Never without her camera. | Interviewed Rashid this afternoon about the house's history. |
| Mzee Yusuf Abdalla | 68 | Retired teacher | Has lived in Room 2 for a year. Plays bao (*a traditional board game of pits and seeds*) in the courtyard every evening. | Rashid's oldest friend, and months behind on his bill. |

**Seat order** (who is played first when there are fewer than 6 players; the culprit is always played): Lydia Chebet → Peter Njoroge Kamau → Achieng' Odhiambo → Mzee Yusuf Abdalla → Amina Said → Omar Hassan. Characters nobody plays become non-player characters, and their statements go on the board at Discovery.

## Places and travel times

| | Manager's office | First-floor gallery | Guest rooms, second floor | Roof terrace | Courtyard (dinner and taarab) | Reception | Kitchen | Generator shed, back lane |
|---|---|---|---|---|---|---|---|---|
| **Manager's office** | 0 | 1 | 2 | 3 | 3 | 3 | 3 | 5 |
| **First-floor gallery** | 1 | 0 | 1 | 2 | 2 | 2 | 2 | 4 |
| **Guest rooms, second floor** | 2 | 1 | 0 | 1 | 3 | 3 | 3 | 5 |
| **Roof terrace** | 3 | 2 | 1 | 0 | 4 | 4 | 4 | 6 |
| **Courtyard (dinner and taarab)** | 3 | 2 | 3 | 4 | 0 | 1 | 1 | 2 |
| **Reception** | 3 | 2 | 3 | 4 | 1 | 0 | 2 | 3 |
| **Kitchen** | 3 | 2 | 3 | 4 | 1 | 2 | 0 | 3 |
| **Generator shed, back lane** | 5 | 4 | 5 | 6 | 2 | 3 | 3 | 0 |

Minutes on foot, shortest route. These figures drive both the alibi logic and the fairness check.

## Clues

**Starting clues** (on the board at Discovery)

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-call` | The last call and the unanswered one | The office landline log shows Rashid's call to the power company ending at 20:47. At 21:05 Omar rang the office extension to say the generator had failed. Nobody answered. | Rashid Omar Bakari at Manager's office, 20:47; Omar Hassan at Reception, 21:05 | – |
| `c-found` | Found when the lights came on | When the power returned at 21:10, Omar went up and found Rashid on the floor beside his desk. A heavy brass oil lamp lay next to him. The doctor staying in Room 6 says he was struck once and fell. The office has one door, onto the gallery. | – | – |
| `c-dinner` | The dinner photo, 20:20 | The hotel posted a dinner photo at 20:20: Rashid at the head of the table, Peter in white linen, Amina in a navy buibui (*a long black or navy overgarment*), Achieng' in jeans with her camera. Lydia is the only guest in a green fringed leso. | Lydia Chebet at Courtyard (dinner and taarab), 20:20; Peter Njoroge Kamau at Courtyard (dinner and taarab), 20:20; Rashid Omar Bakari at Courtyard (dinner and taarab), 20:20 | – |
| `c-argument` | The argument at dinner | At 20:15, in front of every guest, Peter told Rashid: 'You cannot stop this sale, old man. One way or another, it is happening.' Rashid walked out of dinner at 20:30. | – | *red-herring* |

**Search: Manager's office**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-letter` | The letter on the desk | A draft letter on Rashid's desk, addressed to the county heritage office: 'I have reason to believe the structural report signed by L. Chebet overstates the damage to the coral-stone walls, so that the new owners can demolish the east wing. I have asked an independent engineer to inspect it.' Beside it, a bank deposit slip for KSh 1,200,000 into an account in the name of 'L. Chebet', which someone has tried to tear in half. | – | *motive*, *decisive* |
| `c-ledger` | The guest ledger | The guest ledger is open at Room 2: 'Mzee Yusuf, unpaid since June, KSh 162,000.' In the margin, in Rashid's pencil: 'Talk to Y. tonight.' Under the door, an envelope marked 'For Rashid, from Y.A.' | – | *red-herring* |
| `c-thread` | Threads on the door latch | Caught on the office door latch: a few long green cotton threads, twisted like the fringe of a wrap. | – | *decisive* |

**Search: Roof terrace**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-camera` | Achieng's long exposures | Achieng's camera holds eleven long exposures shot from the roof terrace between 20:46 and 21:06, each with her own silhouette at the edge of the frame. The 20:58 frame looks down into the courtyard and catches a phone torch on the first-floor gallery, lighting a woman in a long green fringed leso walking away from the office. | Achieng' Odhiambo at Roof terrace, 20:46–21:06; Lydia Chebet at First-floor gallery, 20:58 | *alibi*, *decisive* |

**Search: Courtyard (dinner and taarab)**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-video` | The taarab singer's phone video | The band's singer filmed the unplugged set from 20:44 to 21:06. Peter is at the front table by lantern-light the whole time, on the phone, waving his free hand. | Peter Njoroge Kamau at Courtyard (dinner and taarab), 20:44–21:06 | *alibi* |

**Search: Reception**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-cctv` | The reception camera | Only the reception camera has battery backup. From 20:40 to 21:10 it shows Omar at the front desk throughout, working by lantern. | Omar Hassan at Reception, 20:40–21:10 | *alibi* |

**Search: Kitchen**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-cook` | Mama Rehema, the cook | 'Mzee Yusuf came in as soon as the lights went, and stayed with me the whole time, stirring the tea and telling me about his students. He never left until the lights came back.' | Mzee Yusuf Abdalla at Kitchen, 20:42–21:10 | *alibi* |

**Search: Generator shed, back lane** (restricted: Insider only in round 1)

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-genlog` | The generator logbook | Signed by Amina Said and Baraka the watchman: '20:46 start attempt, failed. 20:52 failed. 21:01 failed, fuel line blocked. 21:03 gave up.' Baraka adds in pencil: 'Madam with me the whole time, holding the torch.' | Amina Said at Generator shed, back lane, 20:45–21:03 | *alibi* |

## Private role cards (original variant)

#### Lydia Chebet (Culprit)

- **Goal:** Don't be the top vote. You may lie about anything, including your whereabouts.
- **What really happened:** Peter's consortium paid you KSh 1.2 million to write a structural report that would let them demolish the east wing. At dinner Rashid told you he had written to the county. At 20:48 you went to his office by phone torch, begged him to tear up the letter, and when he refused you struck him with the brass lamp. You walked back along the gallery to your room at about 20:58.
- **Cover story:** "I had a migraine. I went up to my room at 20:40 and lay in the dark until the lights came back."
- **Danger:** Your leso is the only green one tonight. Someone may have seen your torch on the gallery. You tried to tear the deposit slip but didn't have time to take it.
- **Lesser secret you can confess (it's true):** You have applied for a job at the investor's own company, and haven't told the heritage board.
- **Knows (in their own words):** "At about 20:20, from my seat at dinner, I saw Mzee Yusuf go up to the gallery and slip an envelope under the office door."

#### Peter Njoroge Kamau (Secret-keeper)

- **Goal:** Clear your name fast. Don't let anyone learn the loan has collapsed.
- **Secret:** The consortium's bank loan fell through yesterday. If the sale is delayed, you lose your deposit and your partners.
- **Knows (in their own words):** "When the lights went out I stayed at my table in the courtyard, on a phone call with my partners, from 20:44 until the lights came back."

#### Amina Said (Insider)

- **Goal:** Find who did this. Keep your deal with the investor quiet.
- **Secret:** You have secretly agreed to manage the investor's new hotel if the sale goes through, the opposite of what Rashid wanted.
- **Knows (in their own words):** "When the power failed I went to the generator shed with Baraka the watchman. We tried to start it three times and it wouldn't catch. I came back to the courtyard at about 21:05."

#### Omar Hassan (Witness)

- **Goal:** Help find the truth. Don't let Room 7 come up.
- **Secret:** On quiet nights you let your cousin sleep in empty Room 7 without registering him.
- **Knows (in their own words):** "I never left the desk during the blackout. At about 20:58, through the courtyard arch, I saw a phone torch moving along the first-floor gallery, away from the office end."
- **Recall (witness ability):** One more detail comes back to me: the person with the torch wore something long and patterned, a leso or a scarf, with fringes that swung as they walked.

#### Achieng' Odhiambo (Detective)

- **Goal:** Solve it. Keep the PR money out of the story.
- **Secret:** Your 'independent' feature is partly paid for by the investor's PR firm. You haven't disclosed it.
- **Knows (in their own words):** "I'd gone up to the roof terrace at 20:38 to photograph the dhows' lights. When the blackout hit, I stayed up there shooting long exposures of a dark Old Town until the power came back."

#### Mzee Yusuf Abdalla (Secret-keeper)

- **Goal:** Find who did this to your friend. Keep your unpaid bill private.
- **Secret:** Rashid has let you stay without paying since your pension stopped. You are ashamed and have told no one.
- **Knows (in their own words):** "When the lights went out I went to the kitchen to help Mama Rehema make ginger tea on the gas stove, and I stayed there until the power came back."

## True timeline (original variant)

| From | To | Who | Where | Note |
|---|---|---|---|---|
| 20:00 | 20:38 | Achieng' Odhiambo | Courtyard (dinner and taarab) |  |
| 20:00 | 20:42 | Amina Said | Courtyard (dinner and taarab) |  |
| 20:00 | 20:40 | Lydia Chebet | Courtyard (dinner and taarab) |  |
| 20:00 | 20:17 | Mzee Yusuf Abdalla | Courtyard (dinner and taarab) |  |
| 20:00 | 21:15 | Omar Hassan | Reception |  |
| 20:00 | 21:15 | Peter Njoroge Kamau | Courtyard (dinner and taarab) |  |
| 20:00 | 20:30 | Rashid Omar Bakari | Courtyard (dinner and taarab) | Dinner; argues with Peter at 20:15 |
| 20:19 | 20:20 | Mzee Yusuf Abdalla | First-floor gallery | Slips an envelope under the office door |
| 20:22 | 20:40 | Mzee Yusuf Abdalla | Courtyard (dinner and taarab) |  |
| 20:33 | 21:30 | Rashid Omar Bakari | Manager's office | Phones the power company at 20:47; struck at about 20:52 |
| 20:41 | 21:15 | Mzee Yusuf Abdalla | Kitchen |  |
| 20:42 | 21:10 | Achieng' Odhiambo | Roof terrace |  |
| 20:43 | 20:46 | Lydia Chebet | Guest rooms, second floor | Says she has a migraine |
| 20:44 | 21:03 | Amina Said | Generator shed, back lane |  |
| 20:48 | 20:55 | Lydia Chebet | Manager's office | Confronts Rashid about his letter; strikes him with the brass lamp |
| 20:56 | 20:59 | Lydia Chebet | First-floor gallery | Walks back along the gallery by phone torch |
| 21:00 | 21:15 | Lydia Chebet | Guest rooms, second floor |  |
| 21:05 | 21:20 | Amina Said | Courtyard (dinner and taarab) |  |

## Variant A: The structural report

**Roles:** Lydia Chebet: Culprit · Peter Njoroge Kamau: Secret-keeper · Amina Said: Insider · Omar Hassan: Witness · Achieng' Odhiambo: Detective · Mzee Yusuf Abdalla: Secret-keeper

#### Solution

- **Culprit:** Lydia Chebet
- **Motive:** Lydia was paid KSh 1.2 million to exaggerate the damage in her structural report, and Rashid had written to the county to expose it.
- **Method:** She went to his office by phone torch during the blackout, argued with him, and struck him with the brass oil lamp. Then she walked back along the gallery to her room.
- **Summary:** Lydia Chebet did it. Everyone else is placed away from the office, and Lydia's migraine story fails: Achieng's 20:58 photo shows a woman in the only green leso of the night on the gallery, walking away from the office, and green threads are caught on the office latch.
- **Decisive clues:** `c-camera`, `c-thread`, `c-letter`

#### Solution path

1. The taarab video clears Peter, the reception camera clears Omar, the cook clears Yusuf, the generator log clears Amina, and Achieng's own photo series places her on the roof.
2. Lydia has no alibi beyond her own claim to be in her room.
3. The 20:20 dinner photo shows Lydia is the only person in a green fringed leso. At 20:58, Achieng's frame catches a woman in a green fringed leso on the gallery, walking away from the office. So Lydia was not in her room.
4. Green fringe threads on the office door latch put that wrap at the office door.
5. The draft letter and the KSh 1.2 million deposit slip give the motive: Rashid was about to expose her report.

#### Red herrings

- **Peter Njoroge Kamau.** *Why they look guilty:* He threatened Rashid at dinner: 'One way or another, it is happening.' *The real explanation:* He was desperate because his bank loan had collapsed, not because he planned violence. The singer's video shows him at his table for the whole window. (`c-argument`, `c-video`)
- **Mzee Yusuf Abdalla.** *Why they look guilty:* He owes KSh 162,000, Rashid planned to 'talk to Y. tonight', and he was seen at the office door. *The real explanation:* The envelope holds KSh 3,000 and a thank-you note. Rashid had been letting his old friend stay for free. Mama Rehema puts Yusuf in the kitchen for the whole blackout. (`c-ledger`, `c-cook`)

#### Fair-play audit (computed by `scripts/check-scenarios.js` logic)

| Character | Board evidence | Clues that place them elsewhere |
|---|---|---|
| Lydia Chebet | **Not cleared** | `c-dinner`, `c-camera` |
| Peter Njoroge Kamau | Cleared | `c-dinner`, `c-video` |
| Amina Said | Cleared | `c-genlog` |
| Omar Hassan | Cleared | `c-call`, `c-cctv` |
| Achieng' Odhiambo | Cleared | `c-camera` |
| Mzee Yusuf Abdalla | Cleared | `c-cook` |

Cover story ("I had a migraine. I went up to my room at 20:40 and lay in the dark until the lights came back.") is contradicted by `c-camera`.
Searchable clues: 8, against 8 searches at the minimum player count.

## Variant B: The architect's daughter

Same evidence trail, different motive and relationship: Lydia is the daughter of the architect Rashid blamed for a roof collapse in 2004.

**What changes:** clue `c-letter` changes; Lydia Chebet's card changes.

**Changed clues**

| ID | Clue | Where | Text | Establishes |
|---|---|---|---|---|
| `c-letter` | The letter on the desk | Manager's office | A letter in Rashid's hand, dated today and addressed 'To Lydia': 'I recognised you tonight; you have your father's face. In 2004 I let the board blame him for the east-wing roof when the fault was mine. He never worked again. But your report is not justice, it is revenge on this house. Tomorrow I tell the county both truths.' Under it, an old newspaper cutting: 'Architect Chebet barred after hotel roof collapse'. | – |

**Culprit's card:** Your father was the architect Rashid blamed for the 2004 roof collapse. He never worked again. You took this survey under your mother's surname and wrote a report that would let the new owners tear the house down. Rashid recognised you tonight and wrote that he would expose the report as revenge. At 20:48 you went to his office by phone torch. When he would not burn the letter, you struck him with the brass lamp, and walked back along the gallery at about 20:58. Cover story: "I had a migraine. I went up to my room at 20:40 and lay in the dark until the lights came back."

**Roles:** Lydia Chebet: Culprit · Peter Njoroge Kamau: Secret-keeper · Amina Said: Insider · Omar Hassan: Witness · Achieng' Odhiambo: Detective · Mzee Yusuf Abdalla: Secret-keeper

#### Solution

- **Culprit:** Lydia Chebet
- **Motive:** Lydia's father was the architect Rashid wrongly blamed for the 2004 roof collapse. Her report was revenge, and Rashid had recognised her and was about to expose it.
- **Method:** She went to his office by phone torch during the blackout, and struck him with the brass oil lamp when he refused to destroy his letter.
- **Summary:** Lydia Chebet did it, out of a twenty-year-old grievance. The evidence trail is the same: the green leso on the gallery at 20:58 breaks her migraine alibi, and the letter and newspaper cutting reveal who she really is.
- **Decisive clues:** `c-camera`, `c-thread`, `c-letter`

#### Solution path

1. The taarab video, reception camera, cook, generator log and roof photos clear Peter, Omar, Yusuf, Amina and Achieng'.
2. Lydia's alibi is only her own word.
3. The only green fringed leso of the night is on the gallery at 20:58, walking away from the office, and green threads are caught on the office latch.
4. The letter 'To Lydia' and the 2004 newspaper cutting show the motive: a father ruined by Rashid, and a report written for revenge.

#### Red herrings

- **Peter Njoroge Kamau.** *Why they look guilty:* He threatened Rashid at dinner: 'One way or another, it is happening.' *The real explanation:* He was desperate because his bank loan had collapsed, not because he planned violence. The singer's video shows him at his table for the whole window. (`c-argument`, `c-video`)
- **Mzee Yusuf Abdalla.** *Why they look guilty:* He owes KSh 162,000, Rashid planned to 'talk to Y. tonight', and he was seen at the office door. *The real explanation:* The envelope holds KSh 3,000 and a thank-you note. Rashid had been letting his old friend stay for free. Mama Rehema puts Yusuf in the kitchen for the whole blackout. (`c-ledger`, `c-cook`)

#### Fair-play audit (computed by `scripts/check-scenarios.js` logic)

| Character | Board evidence | Clues that place them elsewhere |
|---|---|---|
| Lydia Chebet | **Not cleared** | `c-dinner`, `c-camera` |
| Peter Njoroge Kamau | Cleared | `c-dinner`, `c-video` |
| Amina Said | Cleared | `c-genlog` |
| Omar Hassan | Cleared | `c-call`, `c-cctv` |
| Achieng' Odhiambo | Cleared | `c-camera` |
| Mzee Yusuf Abdalla | Cleared | `c-cook` |

Cover story ("I had a migraine. I went up to my room at 20:40 and lay in the dark until the lights came back.") is contradicted by `c-camera`.
Searchable clues: 8, against 8 searches at the minimum player count.

## Details needing local review

- [ ] Old Town Mombasa is real; Bahari House and its staff and guests are fictional. Check the hotel's layout (open courtyard, first-floor gallery, roof terrace) against real Old Town Swahili houses.
- [ ] Power cuts in Old Town and live taarab at a hotel dinner: confirm these are plausible and not presented as a cliché.
- [ ] Check names and dress (leso, buibui) are used respectfully and accurately for the coast.
