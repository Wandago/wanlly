# The Last Stop Before Timboroa

> **Spoilers.** This is the full design document, including the solution. Players must not read it before playing.

*Generated from `scenarios/last-stop-timboroa.json` by `npm run render`. Edit the JSON, not this file.*

| | |
|---|---|
| Location | Roadside stopover on the Nakuru–Eldoret highway |
| Tone | Cold, misty, late-night road trip with a locked-room puzzle |
| Play time | about 20 minutes |
| Players | 4–6 |
| Variants | 2 (The songwriter's credits, The door money) |
| Content notes | A death by a blow, not described graphically; A character driving without a licence |

## Public introduction

Kanjo Sound, a six-piece benga-fusion band, is driving overnight from Nairobi to a festival in Eldoret. At 21:30 they pull into a roadside stopover below Timboroa, where the mist is thick and the cold bites. Mzee Kariuki fires up the grill, the truck drivers ask for a song, and the band's manager and sound engineer, Kelvin 'KK' Kamande, locks himself in the equipment store room to fix a wireless mic kit. At 23:05 Mzee Kariuki unlocks the store and finds KK on the floor. The padlock had been locked from the outside. KK was alive at 22:28, and from 22:50 his phone rang unanswered inside the room.

**Victim:** Kelvin 'KK' Kamande, 39, the band's manager and sound engineer. Built Kanjo Sound from a church youth band into a touring act. Generous, controlling, and owed money by half the industry.

**Window:** 22:30–22:50 at Equipment store room.

## Cast (public)

| Character | Age | Occupation | Public bio | Relationship to the victim |
|---|---|---|---|---|
| Baraka Mwangi | 31 | Lead guitarist | Lead guitarist and the band's quiet songwriter. Plays with custom guitar picks printed 'BM'. | KK has managed him since he was nineteen. |
| Wanjiru 'Jiru' Nduta | 27 | Lead singer | The voice of the band. Her solo single is trending. | KK threatened to sue if she left the band. |
| Otieno 'Sticks' Okoth | 35 | Drummer | Drummer, joker, and the band's back-up driver. | KK paid his hospital bills last year. |
| Halima Jeptoo | 29 | Driver and tour manager | Drives the van and runs the tour schedule. Grew up near Eldoret and knows every stop on this road. | KK hired her after the last driver crashed. |
| Mzee Kariuki Gathecha | 63 | Stopover owner | Runs the stopover his father built, and mans the grill himself. | Has hosted KK's bands for ten years. |
| Lucy Wangari | 24 | Documentary YouTuber | Filming a tour documentary for her YouTube channel. Her camera is always rolling. | KK gave her permission to film everything. |

**Seat order** (who is played first when there are fewer than 6 players; the culprit is always played): Baraka Mwangi → Wanjiru 'Jiru' Nduta → Halima Jeptoo → Otieno 'Sticks' Okoth → Lucy Wangari → Mzee Kariuki Gathecha. Characters nobody plays become non-player characters, and their statements go on the board at Discovery.

## Places and travel times

| | Equipment store room | Yard | Grill and dining hall | Lodge rooms | The band van | Roadside wall by the highway | Petrol station shop next door |
|---|---|---|---|---|---|---|---|
| **Equipment store room** | 0 | 1 | 2 | 2 | 2 | 3 | 4 |
| **Yard** | 1 | 0 | 1 | 1 | 1 | 2 | 3 |
| **Grill and dining hall** | 2 | 1 | 0 | 2 | 2 | 3 | 4 |
| **Lodge rooms** | 2 | 1 | 2 | 0 | 2 | 3 | 4 |
| **The band van** | 2 | 1 | 2 | 2 | 0 | 3 | 4 |
| **Roadside wall by the highway** | 3 | 2 | 3 | 3 | 3 | 0 | 1 |
| **Petrol station shop next door** | 4 | 3 | 4 | 4 | 4 | 1 | 0 |

Minutes on foot, shortest route. These figures drive both the alibi logic and the fairness check.

## Clues

**Starting clues** (on the board at Discovery)

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-lastmsg` | KK's last message, 22:28 | To the band WhatsApp group at 22:28: 'Wireless kit sorted. Coming to eat in 20, don't finish the mbuzi (*goat meat*).' From 22:50, calls to his phone rang unanswered inside the store room. | Kelvin 'KK' Kamande at Equipment store room, 22:28 | – |
| `c-locked` | The locked store room | At 23:05 Mzee Kariuki unlocked the padlock on the store-room door and found KK on the floor beside the mixing desk, struck with a mic stand. The store room has one door and a barred window. Mzee Kariuki says the only key never left his belt. | Mzee Kariuki Gathecha at Equipment store room, 23:05 | – |
| `c-caps` | Tour merch | Everyone in the band and crew is wearing the black Kanjo Sound tour cap against the cold: Jiru, Baraka, Sticks, Halima and Lucy. Mzee Kariuki wears a knitted kofia (*cap*). | – | – |

**Search: Equipment store room**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-pick` | A guitar pick under the desk | A black guitar pick printed 'BM' lies under the mixing desk, near KK's hand. It's clean, not trodden into the dust like everything else on the floor. | – | *decisive* |
| `c-earring` | A gold earring by the door | A gold hoop earring lies by the door, half under a speaker case. | – | *red-herring* |
| `c-laptop` | KK's laptop | KK's laptop is open on the mixing desk at an email from the music copyright society: 'Registration query: six works recently registered with B. Mwangi as sole composer match works registered by Kanjo Sound (K. Kamande, manager) in 2021.' Below it, KK's unsent reply: 'Baraka, we talk tonight, or I go to the society and the lawyers.' | – | *motive*, *decisive* |

**Search: Grill and dining hall**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-footage` | Lucy's footage, 22:25–22:55 | Jiru sings for the truck drivers non-stop. Mzee Kariuki is at the grill in every wide shot. Lucy's own voice asks the drivers questions between songs throughout. At 22:29 the van's interior light flicks on in the yard, visible through the window, for about two minutes. | Wanjiru 'Jiru' Nduta at Grill and dining hall, 22:25–22:55; Mzee Kariuki Gathecha at Grill and dining hall, 22:25–22:55; Lucy Wangari at Grill and dining hall, 22:25–22:55 | *alibi* |

**Search: Lodge rooms**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-towels` | Mama Kariuki's towel round | 'At 22:38 I knocked on Room 2, the guitarist's room, with towels. No answer. The door was unbolted and the room was dark and empty, so I left them on the bed. When I passed again at 22:50 the light was on.' | Baraka Mwangi **not** at Lodge rooms, 22:38; Baraka Mwangi at Lodge rooms, 22:50 | *decisive* |

**Search: The band van** (restricted: Insider only in round 1)

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-glovebox` | The van's glovebox | The spare store key is in the glovebox, but not on its hook, where Halima always hangs it. It's lying loose next to an empty guitar-string packet. | – | *red-herring*, *decisive* |

**Search: Roadside wall by the highway**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-trucker` | A trucker's statement | 'The lady driver sat on that wall on a video call from about half past ten until a quarter to eleven, maybe a bit after. I lent her my power bank. She never went into the yard.' | Halima Jeptoo at Roadside wall by the highway, 22:30–22:48 | *alibi* |

**Search: Petrol station shop next door**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-shop` | The petrol station shop | The shop's camera shows Sticks in his tour cap watching football by the till from 22:28 to 22:52. He bought airtime by M-Pesa at 22:40. | Otieno 'Sticks' Okoth at Petrol station shop next door, 22:28–22:52 | *alibi* |

## Private role cards (original variant)

#### Baraka Mwangi (Culprit)

- **Goal:** Don't be the top vote. You may lie about anything, including your whereabouts.
- **What really happened:** You registered six of the band's songs as your own with the copyright society, and KK found out. At 22:29 you took the spare key from the van's glovebox. At 22:33 you went into the store to beg KK not to go to the lawyers. When he refused, you struck him with a mic stand. You padlocked the door at about 22:40 to make it look impossible, dropped the key back in the glovebox at 22:43, and went to your room at 22:46.
- **Cover story:** "From about 22:15 I was in my room restringing my guitar. I didn't come out until I heard the shouting."
- **Danger:** Mzee Kariuki's wife does a towel round. You may have dropped a pick. The van light comes on when you open the door.
- **Lesser secret you can confess (it's true):** You have been talking to another band about joining them after this tour.
- **Knows (in their own words):** "At check-in I saw Halima put the spare store-room key in the van's glovebox."

#### Wanjiru 'Jiru' Nduta (Secret-keeper)

- **Goal:** Find who did this. Keep the solo deal quiet until it's announced.
- **Secret:** You have signed a solo deal with a Nairobi label. KK found out this week.
- **Knows (in their own words):** "At 21:50 I fetched my mic stand from the store room, and lost a gold earring there. From 22:25 until almost 23:00 I sang an acoustic set for the truck drivers in the dining hall."

#### Otieno 'Sticks' Okoth (Secret-keeper)

- **Goal:** Help solve it. Keep the licence problem quiet.
- **Secret:** You don't have a valid driving licence. You've failed the test twice, and you've driven the van on this tour anyway.
- **Knows (in their own words):** "From about 22:28 to 22:52 I was in the petrol station shop next door, buying airtime and watching the football on their TV."

#### Halima Jeptoo (Insider)

- **Goal:** Find who did it. Keep the Nakuru cash quiet.
- **Secret:** A club owner in Nakuru paid you cash to book the band for less, and you kept the difference.
- **Knows (in their own words):** "At check-in at 21:30, Mzee Kariuki gave me the spare key to the store room, and I put it on the hook in the van's glovebox. From 22:30 until about 22:48 I sat on the roadside wall, where the signal is better, on a video call with my daughter."

#### Mzee Kariuki Gathecha (Witness)

- **Goal:** Find who did this under your roof. Keep the sale quiet.
- **Secret:** You are selling the stopover to a petrol company next month and haven't told your staff.
- **Knows (in their own words):** "I was at the grill all evening. At 22:40, through the window, a truck's headlights lit up a figure at the store-room door, pulling it shut."
- **Recall (witness ability):** I remember one more detail: the figure wore the band's black tour cap, with some kind of strap slung across the back.

#### Lucy Wangari (Detective)

- **Goal:** Solve it. Keep the streaming deal quiet.
- **Secret:** KK wasn't paying you, so you secretly sold the documentary rights to a streaming company.
- **Knows (in their own words):** "I filmed Jiru's acoustic set from beside the grill, from 22:25 to 22:55."

## True timeline (original variant)

| From | To | Who | Where | Note |
|---|---|---|---|---|
| 21:00 | 23:00 | Mzee Kariuki Gathecha | Grill and dining hall |  |
| 21:30 | 22:10 | Baraka Mwangi | Grill and dining hall |  |
| 21:30 | 21:32 | Halima Jeptoo | The band van | Puts the spare key in the glovebox |
| 21:30 | 22:15 | Kelvin 'KK' Kamande | Grill and dining hall |  |
| 21:30 | 23:00 | Lucy Wangari | Grill and dining hall |  |
| 21:30 | 22:20 | Otieno 'Sticks' Okoth | Grill and dining hall |  |
| 21:30 | 21:47 | Wanjiru 'Jiru' Nduta | Grill and dining hall |  |
| 21:35 | 22:20 | Halima Jeptoo | Grill and dining hall |  |
| 21:49 | 21:52 | Wanjiru 'Jiru' Nduta | Equipment store room | Fetches her mic stand, loses an earring |
| 21:54 | 23:00 | Wanjiru 'Jiru' Nduta | Grill and dining hall |  |
| 22:12 | 22:27 | Baraka Mwangi | Lodge rooms |  |
| 22:17 | 23:20 | Kelvin 'KK' Kamande | Equipment store room | Messages the band at 22:28; struck at about 22:36 |
| 22:25 | 22:50 | Halima Jeptoo | Roadside wall by the highway |  |
| 22:26 | 22:55 | Otieno 'Sticks' Okoth | Petrol station shop next door |  |
| 22:29 | 22:31 | Baraka Mwangi | The band van | Takes the spare key from the glovebox |
| 22:33 | 22:41 | Baraka Mwangi | Equipment store room | Confronts KK, strikes him with a mic stand, padlocks the door |
| 22:43 | 22:44 | Baraka Mwangi | The band van | Drops the key back in the glovebox |
| 22:46 | 23:10 | Baraka Mwangi | Lodge rooms |  |
| 22:55 | 23:10 | Halima Jeptoo | Lodge rooms |  |
| 23:05 | 23:20 | Mzee Kariuki Gathecha | Equipment store room | Unlocks the store and finds KK |

## Variant A: The songwriter's credits

**Roles:** Baraka Mwangi: Culprit · Wanjiru 'Jiru' Nduta: Secret-keeper · Otieno 'Sticks' Okoth: Secret-keeper · Halima Jeptoo: Insider · Mzee Kariuki Gathecha: Witness · Lucy Wangari: Detective

#### Solution

- **Culprit:** Baraka Mwangi
- **Motive:** Baraka had registered six of the band's songs as his own, and KK was about to go to the copyright society and the lawyers.
- **Method:** He took the spare store key from the van, struck KK with a mic stand, padlocked the door from outside to make it look like a locked room, and returned the key to the glovebox.
- **Summary:** Baraka Mwangi did it. The 'locked room' was locked with the spare key from the van. Everyone else is placed away from the store for the whole window, while Baraka's 'in my room' story fails: Mama Kariuki found Room 2 empty at 22:38.
- **Decisive clues:** `c-towels`, `c-pick`, `c-laptop`, `c-glovebox`

#### Solution path

1. Lucy's footage clears Jiru, Mzee Kariuki and Lucy. The shop camera clears Sticks, and the trucker clears Halima.
2. The locked door isn't impossible: there's a spare key, and it has been moved off its hook in the glovebox. The van light came on at 22:29.
3. Baraka says he was in Room 2 from 22:15, but Mama Kariuki found it dark and empty at 22:38.
4. A clean 'BM' pick lies under the desk by KK's hand, and the copyright email on KK's laptop gives the motive.

#### Red herrings

- **Wanjiru 'Jiru' Nduta.** *Why they look guilty:* Her earring is in the store room, and KK was threatening to sue her. *The real explanation:* She lost the earring fetching her mic stand at 21:50. Lucy's footage shows her singing for the whole window. (`c-earring`, `c-footage`)
- **Halima Jeptoo.** *Why they look guilty:* She put the spare key in the glovebox, and she's the only one who's supposed to know it's there. *The real explanation:* Baraka saw her put it there at check-in. The trucker puts her on the roadside wall for the whole window. (`c-glovebox`, `c-trucker`)

#### Fair-play audit (computed by `scripts/check-scenarios.js` logic)

| Character | Board evidence | Clues that place them elsewhere |
|---|---|---|
| Baraka Mwangi | **Not cleared** | `c-towels` |
| Wanjiru 'Jiru' Nduta | Cleared | `c-footage` |
| Otieno 'Sticks' Okoth | Cleared | `c-shop` |
| Halima Jeptoo | Cleared | `c-trucker` |
| Mzee Kariuki Gathecha | Cleared | `c-footage` |
| Lucy Wangari | Cleared | `c-footage` |

Cover story ("From about 22:15 I was in my room restringing my guitar. I didn't come out until I heard the shouting.") is contradicted by `c-towels`.
Searchable clues: 8, against 8 searches at the minimum player count.

## Variant B: The door money

Same evidence trail, different motive: KK had discovered Baraka skimming the cash door takings on the last three gigs.

**What changes:** clue `c-laptop` changes.

**Changed clues**

| ID | Clue | Where | Text | Establishes |
|---|---|---|---|---|
| `c-laptop` | KK's laptop | Equipment store room | KK's laptop is open at a spreadsheet titled 'Door money: Thika, Naivasha, Nakuru'. Each gig shows a gap of KSh 20,000–35,000 between the tickets the venue counted and the cash Baraka handed in. KK's note at the bottom: 'B collected all three. Confront tonight.' | – |

**Culprit's card:** You have been skimming the cash door takings for three gigs running, and KK worked it out. At 22:29 you took the spare key from the van's glovebox. At 22:33 you went into the store to talk him out of firing you. When he said he'd call the police, you struck him with a mic stand. You padlocked the door to make it look impossible, dropped the key back in the glovebox at 22:43, and went to your room at 22:46. Cover story: "From about 22:15 I was in my room restringing my guitar. I didn't come out until I heard the shouting."

**Roles:** Baraka Mwangi: Culprit · Wanjiru 'Jiru' Nduta: Secret-keeper · Otieno 'Sticks' Okoth: Secret-keeper · Halima Jeptoo: Insider · Mzee Kariuki Gathecha: Witness · Lucy Wangari: Detective

#### Solution

- **Culprit:** Baraka Mwangi
- **Motive:** Baraka had been skimming the cash door takings, and KK's spreadsheet proved it.
- **Method:** He took the spare store key from the van, struck KK with a mic stand, padlocked the door from outside, and returned the key.
- **Summary:** Baraka Mwangi did it, to hide the missing door money. The alibi trail is the same: Room 2 was empty at 22:38, the spare key was moved, and his pick lies by KK's hand.
- **Decisive clues:** `c-towels`, `c-pick`, `c-laptop`, `c-glovebox`

#### Solution path

1. The footage, shop camera and trucker clear everyone except Baraka.
2. The spare key in the glovebox has been moved, so the locked room is explained.
3. Room 2 was empty at 22:38, so Baraka's cover story is false.
4. The pick and the door-money spreadsheet connect him to the store and give the motive.

#### Red herrings

- **Wanjiru 'Jiru' Nduta.** *Why they look guilty:* Her earring is in the store room, and KK was threatening to sue her. *The real explanation:* She lost the earring fetching her mic stand at 21:50. Lucy's footage shows her singing for the whole window. (`c-earring`, `c-footage`)
- **Halima Jeptoo.** *Why they look guilty:* She put the spare key in the glovebox, and she's the only one who's supposed to know it's there. *The real explanation:* Baraka saw her put it there at check-in. The trucker puts her on the roadside wall for the whole window. (`c-glovebox`, `c-trucker`)

#### Fair-play audit (computed by `scripts/check-scenarios.js` logic)

| Character | Board evidence | Clues that place them elsewhere |
|---|---|---|
| Baraka Mwangi | **Not cleared** | `c-towels` |
| Wanjiru 'Jiru' Nduta | Cleared | `c-footage` |
| Otieno 'Sticks' Okoth | Cleared | `c-shop` |
| Halima Jeptoo | Cleared | `c-trucker` |
| Mzee Kariuki Gathecha | Cleared | `c-footage` |
| Lucy Wangari | Cleared | `c-footage` |

Cover story ("From about 22:15 I was in my room restringing my guitar. I didn't come out until I heard the shouting.") is contradicted by `c-towels`.
Searchable clues: 8, against 8 searches at the minimum player count.

## Details needing local review

- [ ] Timboroa is real and known as one of the highest, coldest points on the highway; the stopover and its owners are fictional. Check the stopover details (grill hall, lodge rooms, petrol station next door, truckers on the roadside).
- [ ] The music copyright dispute is fictional. Don't name a real collecting society, and check the registration detail is plausible for Kenyan musicians.
- [ ] Check the band's genre, slang and the 'tour cap' merch for authenticity.
