# The High Table

> **Spoilers.** This is the full design document, including the solution. Players must not read it before playing.

*Generated from `scenarios/the-high-table.json` by `npm run render`. Edit the JSON, not this file.*

| | |
|---|---|
| Location | Garden wedding venue, Nakuru |
| Tone | Bright daytime celebration with something rotten under the gold ribbons |
| Play time | about 20 minutes |
| Players | 4–6 |
| Variants | 2 (The double plot, New hiding places) |
| Content notes | A death caused by something added to a drink (no substance named, not described graphically); Land fraud and family conflict |

## Public introduction

It's 15:00 on a bright Saturday at a garden venue outside Nakuru. The choir has sung the couple into the reception tent, the pilau is steaming in the caterers' tent, and the photographer is marshalling family groups in the photo garden by the lake view: the groom's side in maroon ties, the bride's side in gold. At 14:40 the groom's uncle announced his wedding gift, a plot in Bahati. At 15:20 the bride's cousin Stephen came back to the high table, drank his passion juice, and collapsed. His glass had sat alone at his place from 15:03, when he stepped away to take a call, until 15:20.

**Victim:** Stephen Mwaura, 44, a land surveyor and the bride's cousin. Quiet, meticulous, and the person the family calls when a boundary is in doubt.

**Window:** 15:03–15:20 at High table and drinks station.

## Cast (public)

| Character | Age | Occupation | Public bio | Relationship to the victim |
|---|---|---|---|---|
| Jackson Kimani Ndung'u | 58 | Retired land officer | The groom's uncle and chief host. Gave the couple a plot in Bahati as a wedding gift, to loud applause. | Stephen surveyed land for the family for years. |
| Wanjiku 'Shiku' Mburu | 29 | Maid of honour | The bride's younger sister, a bank teller in Nakuru. Running the bridal party like a military operation. | Argued with Stephen this morning about seating. |
| Rose Nyambura | 47 | Retired police inspector | Chairs the church women's guild and led the choir that sang the couple in. Thirty years in the police, and still notices everything. | Knew Stephen from church. |
| Esther Chepkoech | 31 | Wedding planner | Runs a Nakuru events company. Clipboard, two phones and a walkie-talkie. | Stephen complained about her seating plan this morning. |
| Felix Odera | 33 | Wedding photographer | Official photographer. Shoots on two cameras and never misses a timestamp. | Photographed Stephen's own wedding years ago. |
| Hadija Mohammed | 40 | Caterer | Runs Bahati Bites catering. Feeding 300 guests today. | Her waiter poured Stephen's drink. |

**Seat order** (who is played first when there are fewer than 6 players; the culprit is always played): Jackson Kimani Ndung'u → Wanjiku 'Shiku' Mburu → Rose Nyambura → Hadija Mohammed → Felix Odera → Esther Chepkoech. Characters nobody plays become non-player characters, and their statements go on the board at Discovery.

## Places and travel times

| | High table and drinks station | Reception tent | Photo garden by the lake view | Caterers' tent | Bridal changing room, main house | Car park |
|---|---|---|---|---|---|---|
| **High table and drinks station** | 0 | 1 | 4 | 2 | 3 | 3 |
| **Reception tent** | 1 | 0 | 5 | 2 | 2 | 3 |
| **Photo garden by the lake view** | 4 | 5 | 0 | 6 | 7 | 7 |
| **Caterers' tent** | 2 | 2 | 6 | 0 | 4 | 5 |
| **Bridal changing room, main house** | 3 | 2 | 7 | 4 | 0 | 3 |
| **Car park** | 3 | 3 | 7 | 5 | 3 | 0 |

Minutes on foot, shortest route. These figures drive both the alibi logic and the fairness check.

## Walkable map

Sight radius **7 tiles** · players start in **Reception tent**. The map isn't to scale: story times use the travel table above, while the map sets how long walking takes in real time.

```

 #########################
 #CCCCC##TTTTTTTTTTTTTTTT#
 #CCcCC##TTTTTTTTTTTTTTTT#
 #CCCCC::TTTtTTTTTTTTTTTT#
 #CCCCC##TTTTTTTTT1TTTTTT#
 #CCCCC##TTTTTTTTTTTTTTTT#
 ########TTTTTTTTTTTTTtTT#
        #TTTTTTTTTTTTTTTT#
        #TTTTTTTTTTTTTTTT# #########
 ###### ########:######### #KKkKKKK#
 #AAAA# #DDDdDDDDDDDDDDDD# #KKKKKKK#
 #AAAA:.:DDDDDDDDDDDDdDDD:.:KKKKKKK#
 #AAAA# ########:######### #KKK3KkK#
 #AaAA#         .          #########
 #AAAA#         .
 #A4AA# ########:#########
 ###### #PPPPPPPPPPPPPPPP#
        #PPPPPPPPPPPP2PPP#
        #PPPPPpPPPPPPPPPP#
        #PPPPPPPPPPPPPPPP#
        ##################
```

Key: `#` wall · `.` path · `:` door · capital letter = a place's floor · lowercase letter = a clue spot in that place · digit = errand.

| Letter | Place | Clue spots |
|---|---|---|
| T | Reception tent | 2 |
| D | High table and drinks station | 2 |
| P | Photo garden by the lake view | 1 |
| K | Caterers' tent | 2 |
| C | Bridal changing room, main house (restricted) | 1 |
| A | Car park | 1 |

| Errand | Seconds |
|---|---|
| 1. Hand out programmes | 2 |
| 2. Straighten the photo backdrop | 3 |
| 3. Carry a tray of chapati | 3 |
| 4. Guide a car into a space | 3 |

## Clues

**Starting clues** (on the board at Discovery)

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-collapse` | Collapse at the high table | At 15:20 Stephen came back to the high table and drank his passion juice. At 15:22 he collapsed. A doctor among the guests says something was added to the drink. The waiter poured it at 15:02. Stephen stepped away with his phone at 15:03, and the glass sat alone at his place until he came back. | Stephen Mwaura at High table and drinks station, 15:02; Stephen Mwaura at High table and drinks station, 15:20 | – |
| `c-dress` | The dress code and the programme | The invitation's dress code: the groom's family in maroon ties and scarves, the bride's family in gold. The programme lists family photos in the photo garden from 14:50 to 15:30, while the choir sings in the tent. | – | – |
| `c-gift` | The gift at 14:40 | At 14:40 Uncle Jackson announced his gift to the couple: a title deed for a plot in Bahati. Guests saw Stephen frowning and stepping out to make a phone call right afterwards. | – | – |

**Search: High table and drinks station**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-glass` | Stephen's place setting | Stephen's place card is bent, as if it was picked up and put back in a hurry. There is a faint residue on the rim of his glass. Under the table is a maroon cufflink. | – | *decisive* |
| `c-note` | A note under the plate | Under Stephen's side plate is a note in gold ink: 'Stay out of my business. S.' | – | *red-herring* |

**Search: Reception tent**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-stream` | The church live stream | The live stream points at the choir. Rose leads from 15:00 to 15:30 without a break. At 15:15, a man in a dark suit and maroon tie, Uncle Jackson, crosses the back of the frame from the high-table end, heading towards the car park side. | Rose Nyambura at Reception tent, 15:00–15:30; Jackson Kimani Ndung'u at Reception tent, 15:15 | *alibi*, *decisive* |

**Search: Photo garden by the lake view**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-photolog` | Felix's photo log | Felix's camera timestamps show bridal-party shots from 14:50 to 15:25, with Shiku in nearly every frame and Felix's own shadow in many. The groom's family group, scheduled for 15:10, is marked 'postponed: uncle missing'. It was retaken at 15:26 with Jackson in it. | Wanjiku 'Shiku' Mburu at Photo garden by the lake view, 14:50–15:25; Felix Odera at Photo garden by the lake view, 14:50–15:25; Jackson Kimani Ndung'u **not** at Photo garden by the lake view, 15:07–15:25; Jackson Kimani Ndung'u at Photo garden by the lake view, 15:26 | *alibi*, *decisive* |

**Search: Caterers' tent**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-kitchen` | The caterers' statement | Hadija's three cooks: 'Madam never left the tent from 15:00 to 15:25. We were plating 300 portions of pilau and she was shouting at all of us.' | Hadija Mohammed at Caterers' tent, 15:00–15:25 | *alibi* |
| `c-licence` | A certificate in a drawer | Hadija's food-handling licence, expired in March, is folded in a drawer under the cash box. Beside it is a renewal form, filled in but never submitted. | – | *red-herring* |

**Search: Bridal changing room, main house** (restricted: Insider only in round 1)

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-bride` | The bride's statement | 'Esther was with me from about 15:03 until 15:25. The zip broke and she sewed me into the dress. She didn't leave once, she wouldn't let me move.' | Esther Chepkoech at Bridal changing room, main house, 15:03–15:25 | *alibi* |

**Search: Car park**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-report` | Stephen's car | The parking boy says Stephen sat in his car on a phone call from about 15:05 to 15:17. On the dashboard is a printed search from the Lands registry for the Bahati plot: two different owners registered in 2019, both transfers signed by J. K. Ndung'u. Stephen's sticky note: 'Tell the couple before they build. J must explain today.' | Stephen Mwaura at Car park, 15:05–15:17 | *motive*, *decisive* |

## Private role cards (original variant)

#### Jackson Kimani Ndung'u (Culprit)

- **Goal:** Don't be the top vote. You may lie about anything, including your whereabouts.
- **What really happened:** The Bahati plot you gave the couple had already been sold to someone else in 2019, and you signed both transfers. Stephen found out at lunch and was going to tell everyone. At 15:07 you slipped out of the family photos, and at 15:10 you added something to his glass at the high table. You walked back through the tent at 15:15 and rejoined the photos at 15:26.
- **Cover story:** "I was in the photo garden with the family from 15:00 until after Stephen collapsed."
- **Danger:** The photographer keeps a log. The church was live-streaming the tent. You lost a cufflink.
- **Lesser secret you can confess (it's true):** You 'borrowed' the sound-system deposit from the groom's harambee money and haven't put it back.
- **Knows (in their own words):** "At 15:02 I watched a waiter pour Stephen's passion juice and set it at his place on the high table, just as Stephen stepped away with his phone."

#### Wanjiku 'Shiku' Mburu (Secret-keeper)

- **Goal:** Help find the truth. Keep your relationship secret until after the wedding.
- **Secret:** You have been secretly dating the groom's best man for a year. Stephen saw you together and told you to tell the families.
- **Knows (in their own words):** "From 14:50 until about 15:25 I was in the photo garden with the bridal party, holding my sister's train between shots."

#### Rose Nyambura (Detective)

- **Goal:** Find the culprit. Keep the inquiry out of the conversation.
- **Secret:** You took early retirement after an internal inquiry you would rather not discuss.
- **Knows (in their own words):** "I led the choir in the reception tent from 15:00 to 15:30. The church live-streamed it for relatives in the diaspora."

#### Esther Chepkoech (Insider)

- **Goal:** Solve it before the guests panic. Keep the DJ mix-up quiet.
- **Secret:** You double-booked today's DJ with another wedding and have been quietly paying both.
- **Knows (in their own words):** "From 15:03 to 15:25 I was in the main house helping the bride into her second outfit. The zip broke and I had to sew her in."

#### Felix Odera (Witness)

- **Goal:** Help find who did it. Keep the blog side-hustle secret.
- **Secret:** You sell candid wedding photos to a gossip blog under a fake name.
- **Knows (in their own words):** "I was in the photo garden shooting family groups from 14:50 to 15:25. At about 15:12 my assistant's walkie crackled: 'Groom's uncle is missing from the family shot.'"
- **Recall (witness ability):** I remember one more detail. Through the long lens, at about 15:11, I caught someone at the high table in a dark suit and a maroon tie, bending over the place settings.

#### Hadija Mohammed (Secret-keeper)

- **Goal:** Clear your business's name. Keep the licence problem quiet.
- **Secret:** Your catering licence expired in March and you haven't renewed it.
- **Knows (in their own words):** "From 15:00 to 15:25 I never left the caterers' tent. My staff and I were plating 300 portions of pilau."

## True timeline (original variant)

| From | To | Who | Where | Note |
|---|---|---|---|---|
| 14:30 | 15:00 | Esther Chepkoech | Reception tent |  |
| 14:30 | 15:30 | Hadija Mohammed | Caterers' tent |  |
| 14:30 | 14:45 | Jackson Kimani Ndung'u | Reception tent | Announces the Bahati plot at 14:40 |
| 14:30 | 15:30 | Rose Nyambura | Reception tent |  |
| 14:30 | 14:50 | Stephen Mwaura | Reception tent |  |
| 14:50 | 15:25 | Felix Odera | Photo garden by the lake view |  |
| 14:50 | 15:06 | Jackson Kimani Ndung'u | Photo garden by the lake view | First family groups |
| 14:50 | 15:25 | Wanjiku 'Shiku' Mburu | Photo garden by the lake view |  |
| 14:55 | 15:02 | Stephen Mwaura | High table and drinks station | Waiter pours his juice at 15:02 |
| 15:03 | 15:25 | Esther Chepkoech | Bridal changing room, main house |  |
| 15:05 | 15:17 | Stephen Mwaura | Car park | On the phone in his car |
| 15:10 | 15:13 | Jackson Kimani Ndung'u | High table and drinks station | Tampers with Stephen's glass |
| 15:14 | 15:20 | Jackson Kimani Ndung'u | Reception tent | Walks through the tent, caught on the live stream |
| 15:20 | 15:40 | Stephen Mwaura | High table and drinks station | Drinks and collapses at 15:22 |
| 15:26 | 15:35 | Jackson Kimani Ndung'u | Photo garden by the lake view | Retaken family photo |

## Variant A: The double plot

**Roles:** Jackson Kimani Ndung'u: Culprit · Wanjiku 'Shiku' Mburu: Secret-keeper · Rose Nyambura: Detective · Esther Chepkoech: Insider · Felix Odera: Witness · Hadija Mohammed: Secret-keeper

#### Solution

- **Culprit:** Jackson Kimani Ndung'u
- **Motive:** Jackson had sold the 'gift' plot in Bahati twice, signing both transfers, and Stephen had the Lands search to prove it.
- **Method:** He slipped out of the family photos and added something to Stephen's unattended glass at the high table, then walked back through the tent.
- **Summary:** Jackson Kimani Ndung'u did it. Everyone else is placed away from the high table for the whole window. Jackson says he was at the family photos, but Felix's log shows the groom's family shot postponed with 'uncle missing', and the live stream catches him coming from the high-table end at 15:15.
- **Decisive clues:** `c-photolog`, `c-stream`, `c-report`

#### Solution path

1. The photo log clears Shiku and Felix, the live stream clears Rose, the cooks clear Hadija, and the bride clears Esther.
2. Jackson claims he was at the family photos the whole time. Felix's log shows the groom's family photo postponed at 15:10 because the uncle was missing, and retaken at 15:26.
3. The live stream shows Jackson crossing the tent from the high-table end at 15:15, a minute from Stephen's glass. A maroon cufflink (groom's side) lies under the high table.
4. The Lands search in Stephen's car gives the motive: the plot was sold twice, with both transfers signed by Jackson.

#### Red herrings

- **Wanjiku 'Shiku' Mburu.** *Why they look guilty:* A note signed 'S.' under Stephen's plate says 'Stay out of my business', and she argued with him this morning. *The real explanation:* Stephen had seen Shiku with the best man and told her to come clean to the families. She spent the whole window in the photo garden. (`c-note`, `c-photolog`)
- **Hadija Mohammed.** *Why they look guilty:* Her waiter poured the drink, and she's hiding an expired licence. *The real explanation:* The licence is a paperwork problem, not a motive. Her cooks put her in the caterers' tent for the whole window. (`c-licence`, `c-kitchen`)

#### Fair-play audit (computed by `scripts/check-scenarios.js` logic)

| Character | Board evidence | Clues that place them elsewhere |
|---|---|---|
| Jackson Kimani Ndung'u | **Not cleared** | `c-stream`, `c-photolog` |
| Wanjiku 'Shiku' Mburu | Cleared | `c-photolog` |
| Rose Nyambura | Cleared | `c-stream` |
| Esther Chepkoech | Cleared | `c-bride` |
| Felix Odera | Cleared | `c-photolog` |
| Hadija Mohammed | Cleared | `c-kitchen` |

Cover story ("I was in the photo garden with the family from 15:00 until after Stephen collapsed.") is contradicted by `c-stream`, `c-photolog`.
Searchable clues: 8, against 8 searches at the minimum player count.

## Variant B: New hiding places

Same solution, with the clues moved: Stephen had given his Lands search to the bride for safekeeping, and the note and cufflink turn up elsewhere. The group has to search in different places.

**What changes:** clue `c-report` changes; clue `c-note` changes; clue `c-bride` changes.

**Changed clues**

| ID | Clue | Where | Text | Establishes |
|---|---|---|---|---|
| `c-report` | An envelope in the bride's bag | Bridal changing room, main house | In the bride's bag in the changing room is a brown envelope Stephen handed her at lunch: a printed search from the Lands registry for the Bahati plot, showing two different owners registered in 2019, both transfers signed by J. K. Ndung'u. His note: 'Read this after the photos. J must explain today.' The bride hadn't opened it. | – |
| `c-note` | A note on Stephen's windscreen | Car park | Tucked under Stephen's windscreen wiper is a note in gold ink: 'Stay out of my business. S.' | – |
| `c-bride` | The bride's statement | Reception tent | Told to Rose in the tent: 'Esther was with me in the house from about 15:03 until 15:25. The zip broke and she sewed me into the dress. She didn't leave once.' | Esther Chepkoech at Bridal changing room, main house, 15:03–15:25 |

**Roles:** Jackson Kimani Ndung'u: Culprit · Wanjiku 'Shiku' Mburu: Secret-keeper · Rose Nyambura: Detective · Esther Chepkoech: Insider · Felix Odera: Witness · Hadija Mohammed: Secret-keeper

#### Solution

- **Culprit:** Jackson Kimani Ndung'u
- **Motive:** Jackson had sold the 'gift' plot in Bahati twice, signing both transfers, and Stephen had the Lands search to prove it.
- **Method:** He slipped out of the family photos and added something to Stephen's unattended glass at the high table, then walked back through the tent.
- **Summary:** Jackson Kimani Ndung'u did it. Everyone else is placed away from the high table for the whole window. Jackson says he was at the family photos, but Felix's log shows the groom's family shot postponed with 'uncle missing', and the live stream catches him coming from the high-table end at 15:15.
- **Decisive clues:** `c-photolog`, `c-stream`, `c-report`

#### Solution path

1. The photo log clears Shiku and Felix, the live stream clears Rose, the cooks clear Hadija, and the bride clears Esther.
2. Jackson claims he was at the family photos the whole time. Felix's log shows the groom's family photo postponed at 15:10 because the uncle was missing, and retaken at 15:26.
3. The live stream shows Jackson crossing the tent from the high-table end at 15:15, a minute from Stephen's glass. A maroon cufflink (groom's side) lies under the high table.
4. The Lands search in Stephen's car gives the motive: the plot was sold twice, with both transfers signed by Jackson.

#### Red herrings

- **Wanjiku 'Shiku' Mburu.** *Why they look guilty:* A note signed 'S.' under Stephen's plate says 'Stay out of my business', and she argued with him this morning. *The real explanation:* Stephen had seen Shiku with the best man and told her to come clean to the families. She spent the whole window in the photo garden. (`c-note`, `c-photolog`)
- **Hadija Mohammed.** *Why they look guilty:* Her waiter poured the drink, and she's hiding an expired licence. *The real explanation:* The licence is a paperwork problem, not a motive. Her cooks put her in the caterers' tent for the whole window. (`c-licence`, `c-kitchen`)

#### Fair-play audit (computed by `scripts/check-scenarios.js` logic)

| Character | Board evidence | Clues that place them elsewhere |
|---|---|---|
| Jackson Kimani Ndung'u | **Not cleared** | `c-stream`, `c-photolog` |
| Wanjiku 'Shiku' Mburu | Cleared | `c-photolog` |
| Rose Nyambura | Cleared | `c-stream` |
| Esther Chepkoech | Cleared | `c-bride` |
| Felix Odera | Cleared | `c-photolog` |
| Hadija Mohammed | Cleared | `c-kitchen` |

Cover story ("I was in the photo garden with the family from 15:00 until after Stephen collapsed.") is contradicted by `c-stream`, `c-photolog`.
Searchable clues: 8, against 8 searches at the minimum player count.

## Details needing local review

- [ ] The venue is fictional; Nakuru and Bahati are real. Check that the wedding programme (choir in the tent, family photos by colour-coded side, a land title as a wedding gift) matches real Nakuru weddings.
- [ ] Double allocation of land titles is a real and painful issue. Keep it specific to this fictional family and avoid implying any real office or official.
- [ ] Check that a retired police inspector running a church women's guild reads naturally, and that a caterer's expired licence isn't a lazy stereotype.
