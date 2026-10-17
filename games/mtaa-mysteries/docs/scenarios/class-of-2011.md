# Class of 2011

> **Spoilers.** This is the full design document, including the solution. Players must not read it before playing.

*Generated from `scenarios/class-of-2011.json` by `npm run render`. Edit the JSON, not this file.*

| | |
|---|---|
| Location | Lakeside lodge, Kisumu |
| Tone | Nostalgic and bittersweet, old friends and older secrets |
| Play time | about 20 minutes |
| Players | 4–6 |
| Variants | 2 (The 2010 exam, The sponsor's cheque) |
| Content notes | A death by a blow, not described graphically; Drinking, and a character hiding a relapse |

## Public introduction

Fifteen years after graduating from Winam University, the class of 2011 has taken over a lakeside lodge in Kisumu: tilapia on the grill, a DJ playing their old campus anthems, a WhatsApp group buzzing with old photos. At 20:45 Collins Wekesa tapped his glass and promised that at 22:00 he would 'tell the truth about the 2010 Statistics exam'. At 21:30 he was seen walking into the boat shed on the shore. At 22:10 the boatman found him there. Collins was alive at 21:30 and stopped answering his phone by 21:50.

**Victim:** Collins Wekesa, 36, deputy principal of a secondary school in Bungoma and the reunion's treasurer. Earnest, funny, and done with keeping other people's secrets.

**Window:** 21:30–21:50 at Boat shed on the shore.

## Cast (public)

| Character | Age | Occupation | Public bio | Relationship to the victim |
|---|---|---|---|---|
| Dr Kiprop Rotich | 37 | University lecturer | Now teaches statistics at Winam University, where they all studied. Up for promotion. Limping after last Saturday's staff football match. | Shared a hostel room with Collins in first year. |
| Atieno Ochieng' | 36 | Corporate lawyer | Nairobi lawyer, class WhatsApp group admin, and tonight's organiser and MC. | Collins's closest friend from campus. |
| Nafula Simiyu | 35 | Radio presenter | Hosts a breakfast show on a Kisumu radio station. Asks questions for a living. | Collins's ex. They broke up badly in final year and argued again tonight. |
| Hussein Ali Omar | 37 | Hardware businessman | Runs a hardware business in Kisumu and paid for tonight's venue. Always the sharpest-dressed man in the room. | Collins, as treasurer, had been chasing Hussein's sponsorship pledge. |
| Mercy Akinyi | 36 | Nurse | A nurse in Kisumu and the class's unofficial agony aunt. | Was Collins's study partner all four years. |
| Tom Omondi | 37 | Matatu SACCO manager | The class clown, now managing a matatu SACCO on the Kisumu–Busia route. | Owes Collins KSh 20,000 from a business idea that failed. |

**Seat order** (who is played first when there are fewer than 6 players; the culprit is always played): Dr Kiprop Rotich → Hussein Ali Omar → Nafula Simiyu → Tom Omondi → Atieno Ochieng' → Mercy Akinyi. Characters nobody plays become non-player characters, and their statements go on the board at Discovery.

## Places and travel times

| | Main hall (dinner and DJ) | Fire-pit garden | Boat shed on the shore | Fish banda on the beach | Car park | Block B cottages |
|---|---|---|---|---|---|---|
| **Main hall (dinner and DJ)** | 0 | 1 | 4 | 4 | 2 | 3 |
| **Fire-pit garden** | 1 | 0 | 3 | 3 | 3 | 2 |
| **Boat shed on the shore** | 4 | 3 | 0 | 2 | 5 | 3 |
| **Fish banda on the beach** | 4 | 3 | 2 | 0 | 6 | 5 |
| **Car park** | 2 | 3 | 5 | 6 | 0 | 5 |
| **Block B cottages** | 3 | 2 | 3 | 5 | 5 | 0 |

Minutes on foot, shortest route. These figures drive both the alibi logic and the fairness check.

## Clues

**Starting clues** (on the board at Discovery)

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-promise` | The promise at 20:45 | At 20:45 Collins tapped his glass: 'At ten o'clock I'll tell the truth about the 2010 Statistics exam. Some of you won't like it.' The hall laughed nervously. | – | – |
| `c-seen` | Seen at 21:30 | A boda rider delivering fish to the beach banda saw Collins walk into the boat shed at 21:30 with his phone torch on. | Collins Wekesa at Boat shed on the shore, 21:30 | – |
| `c-found` | Found at 22:10 | Atieno rang Collins at 21:52 to call him up for his speech. No answer. At 22:10 the lodge boatman found him in the boat shed beside an upturned canoe, struck with an oar. Rain began falling at about 21:40. | Atieno Ochieng' at Main hall (dinner and DJ), 21:52 | – |

**Search: Main hall (dinner and DJ)**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-dj` | The DJ's video and the bar tab | The DJ filmed the hall from the booth between 21:20 and 22:00. Atieno is on the mic the whole time. Hussein gives his sponsor's toast at 21:35, then stays at the bar; his tab shows rounds at 21:31 and 21:47. | Atieno Ochieng' at Main hall (dinner and DJ), 21:20–22:00; Hussein Ali Omar at Main hall (dinner and DJ), 21:31–21:55 | *alibi* |

**Search: Fire-pit garden**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-garden` | The fire-pit waiter | 'At 21:15 the radio lady shouted at Mr Collins and walked off. Then Dr Kiprop and Mr Collins talked by the fire until about 21:27, and Mr Collins went down to the lake. The doctor sat a few minutes more, then went down the same path at about 21:32.' | Dr Kiprop Rotich at Fire-pit garden, 21:20–21:32; Collins Wekesa at Fire-pit garden, 21:20–21:27; Nafula Simiyu at Fire-pit garden, 21:15 | *decisive*, *red-herring* |

**Search: Boat shed on the shore**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-photos` | Screenshots in Collins's jacket | Printed WhatsApp screenshots from 2010: someone selling the Statistics exam paper at KSh 1,500 a copy. The seller's number is saved as 'Kip Room 14'. Collins has written on the back: 'Tonight. No more hiding.' | – | *motive*, *decisive* |
| `c-cheque` | A bounced cheque | Also in Collins's jacket: Hussein's sponsorship cheque for KSh 150,000, stamped 'Refer to drawer' by the bank, with Collins's note: 'H, sort this tonight or I tell the class.' | – | *red-herring* |
| `c-prints` | Footprints in the wet sand | Sharp footprints of a man's smart shoe lead out of the shed and up the path towards the Block B cottages, not the hall or the beach. Because the rain began at 21:40 and the prints are sharp, they were made after it started. | – | *decisive* |

**Search: Fish banda on the beach**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-banda` | Mama Akoth at the fish banda | 'The radio lady and the nurse sat with me from half past nine until almost ten, eating and talking about men.' | Nafula Simiyu at Fish banda on the beach, 21:30–21:52; Mercy Akinyi at Fish banda on the beach, 21:30–21:52 | *alibi* |

**Search: Car park**

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-askari` | The car-park askari's note | 'Probox, white, gentleman inside from 21:25 to 22:00, did not get out. Knocked at 21:45, he waved. Quarter bottle on the seat.' | Tom Omondi at Car park, 21:25–22:00 | *alibi*, *red-herring* |

**Search: Block B cottages** (restricted: Insider only in round 1)

| ID | Clue | Text | Establishes | Tags |
|---|---|---|---|---|
| `c-turndown` | The housekeeping turndown sheet | 'Block B, cottages 1 to 5, turndown 21:35 to 21:42. All empty, lights off.' Cottage 5 is Dr Rotich's. | nobody at Block B cottages, 21:35–21:42 | *decisive* |

## Private role cards (original variant)

#### Dr Kiprop Rotich (Culprit)

- **Goal:** Don't be the top vote. You may lie about anything, including your whereabouts.
- **What really happened:** In 2010 you sold copies of the leaked Statistics exam. Collins was about to say so in front of everyone, and it would end your career. At 21:32 you followed him down to the boat shed and begged him. When he refused, you struck him with an oar. You walked up to your cottage in the rain at 21:42, changed your wet shirt, and came back to the hall at 22:01.
- **Cover story:** "After talking to Collins by the fire, I went to my cottage at 21:30 to mark exam scripts, and came back to the hall at about 22:00."
- **Danger:** Housekeeping does turndown in the evening. You left prints in the wet sand. Your ankle makes you easy to recognise walking.
- **Lesser secret you can confess (it's true):** Your PhD thesis leaned heavily on a classmate's unpublished work. You call it 'inspiration'.
- **Knows (in their own words):** "At 21:20 Collins came to the fire pit and told me quietly: 'Tonight I name names about 2010. I'm sorry, Kip.'"

#### Atieno Ochieng' (Insider)

- **Goal:** Find who did this to your friend. Keep your own part in 2010 hidden if you can.
- **Secret:** In 2010 you knew the Statistics exam had leaked, and you said nothing, because you had bought a copy yourself.
- **Knows (in their own words):** "I ran games on the mic from 21:20 until about 22:00. At 21:52 I rang Collins to say his speech was next. He didn't pick up."

#### Nafula Simiyu (Detective)

- **Goal:** Find the truth. Avoid admitting you backed out on him.
- **Secret:** Collins asked you to help him go public about 2010 on your show. You agreed, then got scared and told him no at 21:15. That was the argument.
- **Knows (in their own words):** "From about 21:25 until nearly 22:00 I sat at the fish banda on the beach with Mercy, eating fried tilapia and complaining about Collins."

#### Hussein Ali Omar (Secret-keeper)

- **Goal:** Help solve it. Keep the bounced cheque quiet.
- **Secret:** Your sponsorship cheque bounced on Friday. The business is in trouble and you are embarrassed.
- **Knows (in their own words):** "I gave my sponsor's toast in the hall at 21:35, and stayed by the bar afterwards until about 21:55."

#### Mercy Akinyi (Witness)

- **Goal:** Make sure the right person is named. Protect yourself as the source.
- **Secret:** You are the anonymous source who told Collins last year who sold the 2010 exam.
- **Knows (in their own words):** "From 21:25 I sat at the fish banda with Nafula. At about 21:35 I saw a phone torch bobbing down the path from the garden towards the boat shed."
- **Recall (witness ability):** I remember one more detail: the person with the torch walked unevenly, favouring one leg, like someone with a sore ankle.

#### Tom Omondi (Secret-keeper)

- **Goal:** Help find who did it. Don't let anyone find out about the drinking.
- **Secret:** You promised your wife you had stopped drinking. Tonight you have been drinking alone in your car.
- **Knows (in their own words):** "From about 21:25 until 22:00 I sat in my Probox in the car park with a quarter bottle. The car-park askari knocked on my window once."

## True timeline (original variant)

| From | To | Who | Where | Note |
|---|---|---|---|---|
| 20:00 | 22:30 | Atieno Ochieng' | Main hall (dinner and DJ) |  |
| 20:00 | 21:15 | Collins Wekesa | Main hall (dinner and DJ) | Promises his 22:00 speech at 20:45 |
| 20:00 | 21:10 | Dr Kiprop Rotich | Main hall (dinner and DJ) |  |
| 20:00 | 21:55 | Hussein Ali Omar | Main hall (dinner and DJ) |  |
| 20:00 | 21:20 | Mercy Akinyi | Main hall (dinner and DJ) |  |
| 20:00 | 21:10 | Nafula Simiyu | Main hall (dinner and DJ) |  |
| 20:00 | 21:20 | Tom Omondi | Main hall (dinner and DJ) |  |
| 21:12 | 21:32 | Dr Kiprop Rotich | Fire-pit garden |  |
| 21:12 | 21:20 | Nafula Simiyu | Fire-pit garden |  |
| 21:16 | 21:27 | Collins Wekesa | Fire-pit garden | Argues with Nafula at 21:15; talks to Kiprop at 21:20 |
| 21:25 | 21:55 | Mercy Akinyi | Fish banda on the beach |  |
| 21:25 | 21:55 | Nafula Simiyu | Fish banda on the beach |  |
| 21:25 | 22:00 | Tom Omondi | Car park |  |
| 21:30 | 22:15 | Collins Wekesa | Boat shed on the shore | Seen entering at 21:30 |
| 21:35 | 21:42 | Dr Kiprop Rotich | Boat shed on the shore | Confronts Collins and strikes him with an oar |
| 21:45 | 21:58 | Dr Kiprop Rotich | Block B cottages | Changes his wet shirt |
| 22:01 | 22:30 | Dr Kiprop Rotich | Main hall (dinner and DJ) |  |

## Variant A: The 2010 exam

**Roles:** Dr Kiprop Rotich: Culprit · Atieno Ochieng': Insider · Nafula Simiyu: Detective · Hussein Ali Omar: Secret-keeper · Mercy Akinyi: Witness · Tom Omondi: Secret-keeper

#### Solution

- **Culprit:** Dr Kiprop Rotich
- **Motive:** Kiprop sold the leaked 2010 Statistics exam as a student. Collins had the screenshots and was about to name him, which would end Kiprop's academic career.
- **Method:** He followed Collins down to the boat shed at 21:32 and struck him with an oar when he refused to stay quiet, then walked up to his cottage in the rain.
- **Summary:** Dr Kiprop Rotich did it. Everyone else is placed away from the shore for the whole window. Kiprop says he was in his cottage from 21:30, but the turndown sheet shows the cottages empty at 21:35–21:42, the waiter saw him take the lake path at 21:32, and after-rain footprints lead from the shed to the cottages.
- **Decisive clues:** `c-turndown`, `c-garden`, `c-prints`, `c-photos`

#### Solution path

1. The DJ's video clears Atieno and Hussein. Mama Akoth clears Nafula and Mercy. The askari clears Tom.
2. Kiprop says he was in his cottage from 21:30. The waiter saw him take the lake path at 21:32, and housekeeping found every cottage empty from 21:35 to 21:42.
3. Sharp footprints made after the 21:40 rain lead from the boat shed to the cottages, not to the hall or the beach.
4. The screenshots in Collins's jacket ('Kip Room 14') give the motive.

#### Red herrings

- **Nafula Simiyu.** *Why they look guilty:* Collins's ex shouted at him at 21:15, just before he died. *The real explanation:* She had backed out of helping him go public on her radio show. She spent the whole window at the fish banda with Mercy. (`c-garden`, `c-banda`)
- **Tom Omondi.** *Why they look guilty:* He owes Collins money and disappeared from the hall for half an hour. *The real explanation:* He was drinking secretly in his car. The askari saw him there the whole time. (`c-askari`)
- **Hussein Ali Omar.** *Why they look guilty:* Collins was threatening to expose his bounced cheque tonight. *The real explanation:* Embarrassing, but the DJ's video shows him in the hall for the whole window. (`c-cheque`, `c-dj`)

#### Fair-play audit (computed by `scripts/check-scenarios.js` logic)

| Character | Board evidence | Clues that place them elsewhere |
|---|---|---|
| Dr Kiprop Rotich | **Not cleared** | `c-garden` |
| Atieno Ochieng' | Cleared | `c-found`, `c-dj` |
| Nafula Simiyu | Cleared | `c-banda`, `c-garden` |
| Hussein Ali Omar | Cleared | `c-dj` |
| Mercy Akinyi | Cleared | `c-banda` |
| Tom Omondi | Cleared | `c-askari` |

Cover story ("After talking to Collins by the fire, I went to my cottage at 21:30 to mark exam scripts, and came back to the hall at about 22:00.") is contradicted by `c-garden`, `c-turndown`.
Searchable clues: 8, against 8 searches at the minimum player count.

## Variant B: The sponsor's cheque

Same reunion, different culprit: Hussein, whose bounced cheque was about to be read out. Kiprop's 2010 secret is real, but this time it's a red herring.

**What changes:** clue `c-dj` changes; clue `c-garden` changes; clue `c-askari` changes; clue `c-cheque` changes; clue `c-photos` changes; clue `c-prints` changes; clue `c-turndown` changes; Hussein Ali Omar's movements change; Dr Kiprop Rotich's movements change; Dr Kiprop Rotich's card changes; Hussein Ali Omar's card changes; Mercy Akinyi's card changes.

**Changed clues**

| ID | Clue | Where | Text | Establishes |
|---|---|---|---|---|
| `c-dj` | The DJ's video and the bar tab | Main hall (dinner and DJ) | The DJ filmed the hall from the booth between 21:20 and 22:00. Atieno is on the mic the whole time. Hussein's sponsor's toast was due at 21:35, but he is nowhere to be seen; Atieno jokes, 'Our sponsor has gone to find money!' He reappears at the bar at 21:54. | Atieno Ochieng' at Main hall (dinner and DJ), 21:20–22:00; Hussein Ali Omar **not** at Main hall (dinner and DJ), 21:30–21:53; Hussein Ali Omar at Main hall (dinner and DJ), 21:54 |
| `c-garden` | The fire-pit waiter | Fire-pit garden | 'At 21:15 the radio lady shouted at Mr Collins and walked off. Then Dr Kiprop and Mr Collins talked by the fire until about 21:27, and Mr Collins went down to the lake. The doctor went the other way, up to the cottages, at 21:28.' | Dr Kiprop Rotich at Fire-pit garden, 21:20–21:28; Collins Wekesa at Fire-pit garden, 21:20–21:27; Nafula Simiyu at Fire-pit garden, 21:15 |
| `c-askari` | The car-park askari's note | Car park | 'Probox, white, gentleman inside from 21:25 to 22:00, did not get out. Knocked at 21:45, he waved. Quarter bottle on the seat. Also: the big sponsor came half-running into the car park at 21:46, wiped his shoes with a cloth from his boot, and went back in at 21:52.' | Tom Omondi at Car park, 21:25–22:00; Hussein Ali Omar at Car park, 21:46–21:52 |
| `c-cheque` | A bounced cheque | Boat shed on the shore | Also in Collins's jacket: Hussein's sponsorship cheque for KSh 150,000, stamped 'Refer to drawer' by the bank, with Collins's note: 'H, sort this tonight or I tell the class.' | – |
| `c-photos` | Screenshots in Collins's jacket | Boat shed on the shore | Printed WhatsApp screenshots from 2010: someone selling the Statistics exam paper at KSh 1,500 a copy. The seller's number is saved as 'Kip Room 14'. Collins has written on the back: 'Tonight. No more hiding.' | – |
| `c-prints` | Footprints in the wet sand | Boat shed on the shore | Sharp footprints of a man's leather loafer lead out of the shed along the shore path, towards the car park. Because the rain began at 21:40 and the prints are sharp, they were made after it started. | – |
| `c-turndown` | The housekeeping turndown sheet | Block B cottages | 'Block B, cottages 1 to 4 empty. Cottage 5, Dr Rotich at his desk marking, 21:35 to 21:42. Asked us not to disturb.' | Dr Kiprop Rotich at Block B cottages, 21:30–21:58 |

**Culprit's card:** Your KSh 150,000 sponsorship cheque bounced, and Collins was going to read it out to the whole class at 22:00. You slipped out of the hall at 21:28, before your own toast, and found him at the boat shed. When he would not give you a week, you struck him with an oar. You went round by the shore path to the car park, wiped your loafers with a cloth from your boot, and were back at the bar by 21:54. Cover story: "I gave my toast at 21:35 and stayed at the bar until about 22:00."

**True timeline**

| From | To | Who | Where | Note |
|---|---|---|---|---|
| 20:00 | 22:30 | Atieno Ochieng' | Main hall (dinner and DJ) |  |
| 20:00 | 21:15 | Collins Wekesa | Main hall (dinner and DJ) | Promises his 22:00 speech at 20:45 |
| 20:00 | 21:10 | Dr Kiprop Rotich | Main hall (dinner and DJ) |  |
| 20:00 | 21:28 | Hussein Ali Omar | Main hall (dinner and DJ) | Slips out before his scheduled toast |
| 20:00 | 21:20 | Mercy Akinyi | Main hall (dinner and DJ) |  |
| 20:00 | 21:10 | Nafula Simiyu | Main hall (dinner and DJ) |  |
| 20:00 | 21:20 | Tom Omondi | Main hall (dinner and DJ) |  |
| 21:12 | 21:28 | Dr Kiprop Rotich | Fire-pit garden |  |
| 21:12 | 21:20 | Nafula Simiyu | Fire-pit garden |  |
| 21:16 | 21:27 | Collins Wekesa | Fire-pit garden | Argues with Nafula at 21:15; talks to Kiprop at 21:20 |
| 21:25 | 21:55 | Mercy Akinyi | Fish banda on the beach |  |
| 21:25 | 21:55 | Nafula Simiyu | Fish banda on the beach |  |
| 21:25 | 22:00 | Tom Omondi | Car park |  |
| 21:30 | 22:15 | Collins Wekesa | Boat shed on the shore | Seen entering at 21:30 |
| 21:30 | 22:00 | Dr Kiprop Rotich | Block B cottages | Marks scripts, as he says |
| 21:33 | 21:40 | Hussein Ali Omar | Boat shed on the shore | Begs Collins to keep quiet about the cheque; strikes him with an oar |
| 21:46 | 21:52 | Hussein Ali Omar | Car park | Wipes his shoes with a cloth from his boot |
| 21:54 | 22:30 | Hussein Ali Omar | Main hall (dinner and DJ) |  |
| 22:03 | 22:30 | Dr Kiprop Rotich | Main hall (dinner and DJ) |  |

**Roles:** Dr Kiprop Rotich: Secret-keeper · Atieno Ochieng': Insider · Nafula Simiyu: Detective · Hussein Ali Omar: Culprit · Mercy Akinyi: Witness · Tom Omondi: Secret-keeper

#### Solution

- **Culprit:** Hussein Ali Omar
- **Motive:** Hussein's KSh 150,000 sponsorship cheque had bounced, and Collins, the treasurer, was going to tell the class at 22:00.
- **Method:** He slipped out before his own toast, struck Collins with an oar in the boat shed, and went round by the shore path to the car park to clean his shoes.
- **Summary:** Hussein Ali Omar did it. He claims he gave his toast at 21:35, but the DJ's video shows him missing from 21:30 to 21:53, the askari saw him cleaning his shoes in the car park at 21:46, and after-rain loafer prints lead from the shed towards the car park.
- **Decisive clues:** `c-dj`, `c-askari`, `c-cheque`

#### Solution path

1. Mama Akoth clears Nafula and Mercy, the askari clears Tom, the DJ clears Atieno, and housekeeping saw Kiprop marking in Cottage 5.
2. Hussein says he gave his toast at 21:35. The DJ's video shows his toast never happened and he was gone from 21:30 to 21:53.
3. The askari saw him rush into the car park at 21:46 and wipe his shoes. The after-rain prints are loafers, heading that way.
4. The bounced cheque and Collins's note, 'sort this tonight or I tell the class', give the motive.

#### Red herrings

- **Dr Kiprop Rotich.** *Why they look guilty:* The 2010 screenshots in Collins's jacket name 'Kip Room 14'. *The real explanation:* Kiprop really did sell the exam in 2010, but housekeeping saw him marking in his cottage for the whole window. (`c-photos`, `c-turndown`)
- **Nafula Simiyu.** *Why they look guilty:* Collins's ex shouted at him at 21:15, just before he died. *The real explanation:* She had backed out of helping him go public on her radio show. She spent the whole window at the fish banda with Mercy. (`c-garden`, `c-banda`)
- **Tom Omondi.** *Why they look guilty:* He owes Collins money and disappeared from the hall for half an hour. *The real explanation:* He was drinking secretly in his car. The askari saw him there the whole time. (`c-askari`)

#### Fair-play audit (computed by `scripts/check-scenarios.js` logic)

| Character | Board evidence | Clues that place them elsewhere |
|---|---|---|
| Dr Kiprop Rotich | Cleared | `c-garden`, `c-turndown` |
| Atieno Ochieng' | Cleared | `c-found`, `c-dj` |
| Nafula Simiyu | Cleared | `c-banda`, `c-garden` |
| Hussein Ali Omar | **Not cleared** | `c-dj`, `c-askari` |
| Mercy Akinyi | Cleared | `c-banda` |
| Tom Omondi | Cleared | `c-askari` |

Cover story ("I gave my toast at 21:35 and stayed at the bar until about 22:00.") is contradicted by `c-dj`, `c-askari`.
Searchable clues: 8, against 8 searches at the minimum player count.

## Details needing local review

- [ ] Winam University and the lodge are fictional; Kisumu, Lake Victoria and the Dunga shoreline are real. Check the lodge details (fish banda on the beach, boat shed, cottages) feel right for a Kisumu lakeside venue.
- [ ] The cast mixes communities on purpose (Luo, Luhya, Kalenjin, Somali Kenyan). Check names and professions read naturally, and that no community is made the 'suspicious' one.
- [ ] Exam leaks in Kenyan universities are a real and sensitive topic. Keep the 2010 scandal fictional and specific to this story.
