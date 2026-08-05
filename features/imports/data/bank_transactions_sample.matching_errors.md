# Matching Error Audit

- Generated: 2026-08-05T19:52:08.050Z
- Source: `features/imports/data/bank_transactions_sample.xlsx`
- Context: 2025-2026, Term 4 — 1387 students, 1907 open charges
- Incoming rows audited: 334 (filtered rows excluded)
- Rows with at least one finding: 75
- **Rows the matcher called `confident` that still have a finding: 3**

Findings are heuristics: the memo is the only available ground truth and
parents mistype it. `high` = the memo and the proposal contradict each other,
`medium` = the proposal rests on weak evidence, `low` = arithmetic that a
reviewer will see anyway.

## Findings by type

| severity | finding | rows | of which `confident` |
|:---|:---|---:|---:|
| high | `coin_flip_candidates` — Top two candidates are effectively tied | 15 | 0 |
| high | `surname_initial_mismatch` — Memo's surname initial doesn't match the proposed student's surname | 5 | 0 |
| high | `class_mismatch` — Memo names a class the proposed student is not in | 3 | 1 |
| high | `multi_student_fallback` — Memo names several students; the split failed and one student got the whole transfer | 1 | 0 |
| medium | `no_allocation_with_open_charges` — Student has open charges but nothing was allocated | 25 | 0 |
| medium | `fuzzy_only_match` — Student reached only through a fuzzy (misspelled) name | 18 | 2 |
| medium | `unmatched_despite_name` — Memo contains a name but no student was proposed | 12 | 0 |
| medium | `level_mismatch` — Memo names a grade level the proposed student is not in | 9 | 0 |
| medium | `multi_student_separator` — Memo lists several students with an explicit separator, but only one was proposed | 1 | 0 |
| medium | `combo_available_not_taken` — A combination of charges sums to the amount but wasn't used | 1 | 0 |
| low | `under_allocated` — Allocation is short of the transfer amount | 8 | 0 |

## Patterns behind these findings

Written by hand from these runs, not computed — the row lists below are the evidence.

**Fixed** (see `docs/import_matching_plan.md`, Phase 8):

- Cyrillic `Е` transliterated to `ye` while the directory romanized the same letter
  both ways (`Yesui` / `Esukhei` / `Esutei`), so a Cyrillic memo could only reach
  half a family and sibling splits collapsed. `phoneticFold` now folds `ye`→`e`.
- A fee read off the amount out-voted the fee the parent wrote: `TAEKWONDO 400,000`
  settled a 400,000 *registration* charge. An explicit hint now retires the inferred
  one and stands down the amount-only searches.
- `detectMultiStudent` read the trailing `(BANK PAYER NAME)` block and could take a
  parent's surname for a second child. `match.ts` now strips it first.

**Open:**

1. **Near-ties dominate the remaining risk.** The largest finding below is two
   candidates within 10% of each other — a memo carrying one bare first name and no
   class. Nothing in the memo separates them; only a confirmed account link or an
   asked question can.
2. **Fuzzy-only identifications** are the next largest. Each is a real student
   reached through a misspelling, with no class in the memo to corroborate it.
3. **Multi-term fees dead-end.** Several no-allocation rows are exact multiples of
   the 375,000 bus rate (750,000 = two terms). `proposableFor` requires the amount to
   equal the rate exactly — deliberately, since two terms is two charges — so these
   need a proposal that can create several charges at once.
4. **Prepayments for next year** ('26-27', '2026.09САРД') have nothing to match
   against in a current-term-only charge context, and surface as under-allocated.

## `coin_flip_candidates` (high) — 15 rows

Top two candidates are effectively tied

- **Row 13** · 400,000 MNT · tier=attention (low_confidence)
  - memo: `TSENGEL TARA TSETSERLEG BURTGELIINHURAAMJ (ХААН БАНК ЭНХЦАГ ЦЭНГЭЛ)`
  - proposed: Byekbol Tsengel (12A)
  - Byekbol Tsengel (0.40) vs Michid Tsengel (0.40)
- **Row 19** · 400,000 MNT · tier=attention (low_confidence)
  - memo: `EB-ANIR 1-R ANGI 99102455 (ХААН БАНК ТӨМӨРБААТАР САРАНГЭРЭЛ)`
  - proposed: Anir Batsaikhan (9D)
  - Anir Batsaikhan (0.40) vs Anir-Erdene Munkhzaya (0.40)
  - also: level_mismatch
- **Row 21** · 5,000,000 MNT · tier=attention (low_confidence)
  - memo: `EB-L.ANIR 1-R ANGI 99102455 (ХААН БАНК ТӨМӨРБААТАР САРАНГЭРЭЛ)`
  - proposed: Anir-Erdene Munkhzaya (5IA)
  - Anir-Erdene Munkhzaya (0.40) vs Anir Otgonchuluun (0.40)
  - also: level_mismatch
- **Row 115** · 400,000 MNT · tier=attention (low_confidence)
  - memo: `BAYANMUNKHIIN MUNKHZAYA 3? (ХААН БАНК БААТАР БАЯНМӨНХ)`
  - proposed: Munkhjin Bayanmunkh (12D)
  - Munkhjin Bayanmunkh (0.40) vs Anir-Erdene Munkhzaya (0.40)
- **Row 213** · 400,000 MNT · tier=attention (multiple_candidates)
  - memo: `TELMEN GEGEEN ?3 (ХААН БАНК ЦЭНД-ОЧИР ЦЭДЭВСҮРЭН)`
  - proposed: Oyungoo Telmen (2AB)
  - Oyungoo Telmen (0.60) vs Tsetsengoo Telmen (0.60)
- **Row 361** · 210,000 MNT · tier=attention (multiple_candidates)
  - memo: `EB -8E - Enerel Voleyball payment (ХУДАЛДАА ХӨГЖЛИЙН БАНК ГАНБАТ ЧУЛУУНБААТАР)`
  - proposed: Enerel Ganbat (8E)
  - Enerel Ganbat (0.60) vs Munkh-Enerel Ganbold (0.60)
- **Row 394** · 4,350,000 MNT · tier=attention (multiple_candidates)
  - memo: `EB -Л. Амир, 5 В, 4-р улирал (ХУДАЛДАА ХӨГЖЛИЙН БАНК AMIR LAILA)`
  - proposed: Amir Dilshad (7B)
  - Amir Dilshad (0.60) vs Amir Laila (0.60)
  - also: level_mismatch
- **Row 441** · 5,000,000 MNT · tier=attention (multiple_candidates)
  - memo: `ORGIL NEGUN PRESCHOOL5? /88786688/ (ХААН БАНК ОТГОНЖАРГАЛ ҮҮРЦАЙХ)`
  - proposed: Negun Zorigtbaatar (4SA)
  - Negun Zorigtbaatar (0.60) vs Negun Sergelen (0.60)
  - also: level_mismatch
- **Row 461** · 1,700,000 MNT · tier=attention (low_confidence)
  - memo: `TUGULDUR TSELMEG 3? 2026-2027, REGIST FEE (ХААН БАНК ТӨМӨРХҮҮ ЦЭЛМЭГ)`
  - proposed: Tselmeg Delgerdalai (3LM)
  - Tselmeg Delgerdalai (0.50) vs Tuguldur-Uils Munkhbadrakh (0.50)
- **Row 485** · 300,000 MNT · tier=attention (multiple_candidates)
  - memo: `YI JI DA ER HAN（EDA）/5TA/FOOTBALL (ГОЛОМТ БАНК MENGGENQIQIGE XXX)`
  - proposed: Yi Bo / Tergel Gong (1PB)
  - Yi Bo / Tergel Gong (0.60) vs Cha yi ru ma /Tsakhirmaa Bai wu en qi (0.60)
  - also: class_mismatch, no_allocation_with_open_charges
- **Row 502** · 300,000 MNT · tier=attention (multiple_candidates)
  - memo: `art club. Tsegts`
  - proposed: Tsegts Munkhtsooj (5+A)
  - Tsegts Munkhtsooj (0.60) vs Tsegts Chinzorigt (0.60)
- **Row 539** · 3,250,000 MNT · tier=attention (multiple_candidates)
  - memo: `EB -5348218 Amjiltiin ezed-s Ch.Bat-Amgalan 4 (ХУДАЛДАА ХӨГЖЛИЙН БАНК АМЖИЛТЫН ЭЗЭД ХХК)`
  - proposed: Sodongoo Enkh-Amgalan (4SA)
  - Sodongoo Enkh-Amgalan (0.55) vs Sonor Munkh-Amgalan (0.55)
- **Row 547** · 342,000 MNT · tier=attention (multiple_candidates)
  - memo: `EB -E.Enerel 6D math’s club (ХУДАЛДАА ХӨГЖЛИЙН БАНК МӨНХЖАРГАЛ БАЯРСАЙХАН)`
  - proposed: Enerel Enkhjargal (6D)
  - Enerel Enkhjargal (0.60) vs Tugs-Enerel Damdinpurev (0.60)
- **Row 551** · 615,000 MNT · tier=attention (multiple_candidates)
  - memo: `Б.ХУЛАН (ГЭРИЙН ДААЛГАВАР) 99106866 (ХААН БАНК ГАЛСАНДОВЖОО БАТЦЭЦЭГ)`
  - proposed: Khulan Bat-Orshikh (3TM)
  - Khulan Bat-Orshikh (0.60) vs Khulan Batbayar (0.60)
- **Row 560** · 7,500,000 MNT · tier=attention (multiple_candidates)
  - memo: `Б.СОНДОР Б.АНИР 6819974 БАЙГУУЛЛАГААР (ХААН БАНК БАТБОЛД БАТБАЯР)`
  - proposed: Sondor Batzorig (3SE)
  - Sondor Batzorig (0.60) vs Anir Bum-Erdene (0.60)

## `surname_initial_mismatch` (high) — 5 rows

Memo's surname initial doesn't match the proposed student's surname

- **Row 27** · 400,000 MNT · tier=attention (low_confidence)
  - memo: `О.EZLEN 1-Р АНГИ (ХААН БАНК ЧОЙЖИЛ МЯГМАРДОРЖ)`
  - proposed: Ezlen Enkhmanlai (5KO)
  - memo "О.EZLEN" names Ezlen, so the initial should be the surname — proposed student's is "Enkhmanlai"
  - also: level_mismatch, fuzzy_only_match
- **Row 41** · 30,000 MNT · tier=attention (low_confidence)
  - memo: `E.BATMUNKH ESM (ХААН БАНК ДЭРЭМ АРИУНЖАРГАЛ)`
  - proposed: Batmunkh Gerelt-Od (8B)
  - memo "E.BATMUNKH" names Batmunkh, so the initial should be the surname — proposed student's is "Gerelt-Od"
  - also: fuzzy_only_match, no_allocation_with_open_charges
- **Row 209** · 400,000 MNT · tier=attention (low_confidence)
  - memo: `O.ERDEM/UT20291175/ BURTGELIN HURAAMJ (ХААН БАНК ДАМДИНСҮРЭН ЭНХБОЛД)`
  - proposed: Erdem Shinebayar (9A)
  - memo "O.ERDEM" names Erdem, so the initial should be the surname — proposed student's is "Shinebayar"
  - also: fuzzy_only_match
- **Row 353** · 10,000,000 MNT · tier=attention (low_confidence)
  - memo: `М.АРИУНХҮСЛЭН М.МӨНХХҮСЛЭН (ХААН БАНК ЦЭНГЭЛ ЦАЦРАЛ)`
  - proposed: Ariunkhuslen Yondonpurev (1JA)
  - memo "М.АРИУНХҮСЛЭН" names Ariunkhuslen, so the initial should be the surname — proposed student's is "Yondonpurev"
  - also: fuzzy_only_match
- **Row 386** · 26,516,250 MNT · tier=attention (low_confidence)
  - memo: `М.АРИУНХҮСЛЭН М.МӨНХХҮСЛЭН (ХААН БАНК ЦЭНГЭЛ ЦАЦРАЛ)`
  - proposed: Ariunkhuslen Yondonpurev (1JA)
  - memo "М.АРИУНХҮСЛЭН" names Ariunkhuslen, so the initial should be the surname — proposed student's is "Yondonpurev"
  - also: fuzzy_only_match, under_allocated

## `class_mismatch` (high) — 3 rows

Memo names a class the proposed student is not in

- **Row 6** · 1,500,000 MNT · tier=confident (confident)
  - memo: `RISHAB SAMUDRAJIT,10 B (ГОЛОМТ БАНК SAMUDRAJIT SAIKIA)`
  - proposed: Rishab Samudrajit (9B)
  - memo class 10B vs student in 9B
- **Row 67** · 21,500,000 MNT · tier=attention (unbalanced)
  - memo: `ОЧ ОВОГТОЙ САЯН 9Д АНГИ ТӨЛБӨР ОЮУТОЛГОЙ (ХУДАЛДАА ХӨГЖЛИЙН БАНК ЭНХТУЯА ШИЛЭГ)`
  - proposed: Sayan Och (8D)
  - memo class 9D vs student in 8D
  - also: under_allocated
- **Row 485** · 300,000 MNT · tier=attention (multiple_candidates)
  - memo: `YI JI DA ER HAN（EDA）/5TA/FOOTBALL (ГОЛОМТ БАНК MENGGENQIQIGE XXX)`
  - proposed: Yi Bo / Tergel Gong (1PB)
  - memo class 5TA vs student in 1PB
  - also: coin_flip_candidates, no_allocation_with_open_charges

## `multi_student_fallback` (high) — 1 rows

Memo names several students; the split failed and one student got the whole transfer

- **Row 15** · 48,775,000 MNT · tier=attention (unbalanced)
  - memo: `Tushig 4grade Sergelen Saran 7 grade 2026-27 academic year`
  - proposed: Saran Mariya Erdenetuul (12B)
  - memo reads as Tushig Lkhagvasuren + Saran Mariya Erdenetuul; allocation fell back to Saran Mariya Erdenetuul alone for the full 48,775,000 MNT
  - also: level_mismatch, under_allocated

## `no_allocation_with_open_charges` (medium) — 25 rows

Student has open charges but nothing was allocated

- **Row 7** · 750,000 MNT · tier=attention (unbalanced)
  - memo: `4SA AGVAANNINJ BUS PAYMENT (ХААН БАНК БАТТУЛГА АЛТАНТУЯА)`
  - proposed: Agvaanninj Tsogtgerel (4SA)
  - 1 open charge(s) totalling 23,000,000 MNT; flags: manual_review
- **Row 28** · 130,000 MNT · tier=attention (unbalanced)
  - memo: `JAVKHLAN UJIN 2LB (ХААН БАНК СОДНОМДОРЖ ЖАВХЛАН)`
  - proposed: Ujin Javkhlan (2LB)
  - 3 open charge(s) totalling 24,017,500 MNT; flags: manual_review
- **Row 29** · 345,000 MNT · tier=attention (unbalanced)
  - memo: `2LB ZHAHEYA (ХААН БАНК XXX BUHEBILIGE)`
  - proposed: Zhaheya - (2LB)
  - 3 open charge(s) totalling 22,700,000 MNT; flags: manual_review
- **Row 30** · 30,000 MNT · tier=attention (unbalanced)
  - memo: `TEMDEGTIIN HURAAMJ, ARIUNKHUSLEN MUNKHKHUSLEN (ХААН БАНК ЦЭНГЭЛ ЦАЦРАЛ)`
  - proposed: Ariunkhuslen Yondonpurev (1JA)
  - 2 open charge(s) totalling 18,300,000 MNT; flags: manual_review
- **Row 41** · 30,000 MNT · tier=attention (low_confidence)
  - memo: `E.BATMUNKH ESM (ХААН БАНК ДЭРЭМ АРИУНЖАРГАЛ)`
  - proposed: Batmunkh Gerelt-Od (8B)
  - 1 open charge(s) totalling 24,000,000 MNT; flags: manual_review
  - also: surname_initial_mismatch, fuzzy_only_match
- **Row 99** · 60,000 MNT · tier=attention (unbalanced)
  - memo: `TEMUULEN KHALIUN 2AB (ХААН БАНК МӨНХСАЙХАН ХАЛИУНАА)`
  - proposed: Khaliun Temuulen (2AB)
  - 2 open charge(s) totalling 18,300,000 MNT; flags: manual_review
- **Row 127** · 324,000 MNT · tier=attention (low_confidence)
  - memo: `Eric, Manduun math`
  - proposed: Manduukh Sanaa (8E)
  - 3 open charge(s) totalling 24,655,000 MNT; flags: manual_review
  - also: fuzzy_only_match
- **Row 155** · 210,000 MNT · tier=attention (unbalanced)
  - memo: `VOLLEYBALL SONDOR.E 8E (ГОЛОМТ БАНК ЭРХЭМБАЯР ДАВААСҮРЭН)`
  - proposed: Sondor Erkhembayar (8E)
  - 1 open charge(s) totalling 24,000,000 MNT; flags: manual_review
- **Row 169** · 400,000 MNT · tier=attention (unbalanced)
  - memo: `LEE MINWOO KAAN 1ML TAEKWONDO (ХААН БАНК ЭНХЖАРГАЛ ИТГЭЛ)`
  - proposed: Kaan Lee Minwoo (1ML)
  - 3 open charge(s) totalling 24,050,000 MNT; flags: manual_review
  - also: combo_available_not_taken
- **Row 173** · 690,000 MNT · tier=attention (unbalanced)
  - memo: `EB -unumunkh geriin daalgavariim angi 3VO (ХУДАЛДАА ХӨГЖЛИЙН БАНК ЭНХБАТ БАТБАЯР)`
  - proposed: Unumunkh Enkhbat (3VO)
  - 2 open charge(s) totalling 18,645,000 MNT; flags: manual_review
- **Row 199** · 300,000 MNT · tier=attention (unbalanced)
  - memo: `EB -Altansukh munkhmandakh,4rr,football (ХУДАЛДАА ХӨГЖЛИЙН БАНК САРАНГУА БАТДОРЖ)`
  - proposed: Munkhmandakh Altansukh (4RR)
  - 1 open charge(s) totalling 9,000,000 MNT; flags: manual_review
- **Row 251** · 645,000 MNT · tier=attention (unbalanced)
  - memo: `MATH TEST ODMANDAKH 12B (ГОЛОМТ БАНК ЭЛИТСЕРВИС ХХК)`
  - proposed: Odmandakh Galsansar (12B)
  - 1 open charge(s) totalling 30,000,000 MNT; flags: manual_review
- **Row 293** · 275,000 MNT · tier=attention (unbalanced)
  - memo: `SORSARAANA 1JK VLDEGDEL (ГОЛОМТ БАНК УРАНЗОРИГТ ПҮРЭВ-ОЧИР)`
  - proposed: Sorsaraanaa Uranzorigt (1JK)
  - 1 open charge(s) totalling 11,500,000 MNT; flags: manual_review
  - also: fuzzy_only_match
- **Row 300** · 510,000 MNT · tier=attention (unbalanced)
  - memo: `ОЮУНБААТАР ХАДААН 1PB (ХААН БАНК РАДНАА БАЯРСАЙХАН)`
  - proposed: Khadaan Oyunbaatar (1PB)
  - 2 open charge(s) totalling 23,675,000 MNT; flags: manual_review
- **Row 320** · 360,000 MNT · tier=attention (unbalanced)
  - memo: `12D МӨНХБАЯР МИШЭЭЛ (ХААН БАНК ПҮРЭВЖАВ МӨНХБАЯР)`
  - proposed: Misheel Munkhbayar (12D)
  - 2 open charge(s) totalling 30,342,000 MNT; flags: manual_review
- **Row 351** · 210,000 MNT · tier=attention (unbalanced)
  - memo: `ХОНГОРЗРЛ 8В ВОЛЛЕЙБОЛ (ГОЛОМТ БАНК БАТ-ОТГОН ЛХАГВАЖАВ)`
  - proposed: Khongorzol Gan-Ochir (8B)
  - 1 open charge(s) totalling 19,000,000 MNT; flags: manual_review
  - also: fuzzy_only_match
- **Row 356** · 210,000 MNT · tier=attention (unbalanced)
  - memo: `БОЛД НОМИН ЭРДЭНЭ (ХААН БАНК ДОРЖ БОЛД)`
  - proposed: Nomin-Erdene Bold (7C)
  - 3 open charge(s) totalling 23,455,000 MNT; flags: manual_review
- **Row 412** · 200,000 MNT · tier=attention (unbalanced)
  - memo: `Ц. ОЮУНБИЛГҮҮН ТӨЛБӨР ҮЛДЭГДЭЛ-8Д (ХААН БАНК БӨХХУЯГ ХИШИГЖАРГАЛ)`
  - proposed: Oyunbilguun Tserenjamts (8D)
  - 1 open charge(s) totalling 24,000,000 MNT; flags: manual_review
  - also: fuzzy_only_match
- **Row 442** · 390,000 MNT · tier=attention (unbalanced)
  - memo: `EB -UNURTUVSHIN ENHNOMIN 4 (ХУДАЛДАА ХӨГЖЛИЙН БАНК ӨНӨРТҮВШИН БАЛТ)`
  - proposed: Enkhnomin Unurtuvshin (4+A)
  - 1 open charge(s) totalling 3,900,000 MNT; flags: manual_review
- **Row 485** · 300,000 MNT · tier=attention (multiple_candidates)
  - memo: `YI JI DA ER HAN（EDA）/5TA/FOOTBALL (ГОЛОМТ БАНК MENGGENQIQIGE XXX)`
  - proposed: Yi Bo / Tergel Gong (1PB)
  - 1 open charge(s) totalling 17,100,000 MNT; flags: manual_review
  - also: class_mismatch, coin_flip_candidates
- **Row 489** · 300,000 MNT · tier=attention (unbalanced)
  - memo: `ENKHTUVSHIN ENERLEN 3SE BASKETBALL (ХААН БАНК ЮРА УЯНГА)`
  - proposed: Enerlen Enkhtuvshin (3SE)
  - 3 open charge(s) totalling 23,800,000 MNT; flags: manual_review
- **Row 522** · 50,000 MNT · tier=attention (unbalanced)
  - memo: `Э.УХААНЗАЯА 5TA (ХААН БАНК ӨЛЗИЙСАЙХАН ЭРДЭНЭСАЙХАН)`
  - proposed: Ukhaanzaya Erdenesaikhan (5TA)
  - 1 open charge(s) totalling 21,850,000 MNT; flags: manual_review
  - also: fuzzy_only_match
- **Row 524** · 690,000 MNT · tier=attention (unbalanced)
  - memo: `ANKHILUUN MORSAL SHAH MOHAMMAD 2ABHOMEWORK CLUB (ХААН БАНК ДАЯНЖАВ ЛХАГВА)`
  - proposed: Ankhiluun Morsal Shakh Mokhammad (2AB)
  - 2 open charge(s) totalling 23,660,000 MNT; flags: manual_review
- **Row 542** · 10,000 MNT · tier=attention (unbalanced)
  - memo: `EB -Amar 12B ID (ХУДАЛДАА ХӨГЖЛИЙН БАНК САРАНТУЯА БААСАНХҮҮ)`
  - proposed: Amar Baasanbat (12B)
  - 1 open charge(s) totalling 25,000,000 MNT; flags: manual_review
- **Row 561** · 225,000 MNT · tier=attention (unbalanced)
  - memo: `9D CHINGUUN (ХААН БАНК ЧОЙДОРЖ МӨНХЗУЛ)`
  - proposed: Chinguun Munkhzul (9D)
  - 4 open charge(s) totalling 23,157,860 MNT; flags: manual_review

## `fuzzy_only_match` (medium) — 18 rows

Student reached only through a fuzzy (misspelled) name

- **Row 25** · 2,350,000 MNT · tier=attention (flagged)
  - memo: `A.OYU-VJIN 3 LM (ХААН БАНК ПҮРЭВ-УХНА АРИУНБАТ)`
  - proposed: Oyu-Ujin Ariunbat (3LM)
  - edit distance 1, class corroborates
- **Row 27** · 400,000 MNT · tier=attention (low_confidence)
  - memo: `О.EZLEN 1-Р АНГИ (ХААН БАНК ЧОЙЖИЛ МЯГМАРДОРЖ)`
  - proposed: Ezlen Enkhmanlai (5KO)
  - edit distance 1, no class in memo
  - also: surname_initial_mismatch, level_mismatch
- **Row 41** · 30,000 MNT · tier=attention (low_confidence)
  - memo: `E.BATMUNKH ESM (ХААН БАНК ДЭРЭМ АРИУНЖАРГАЛ)`
  - proposed: Batmunkh Gerelt-Od (8B)
  - edit distance 1, no class in memo
  - also: surname_initial_mismatch, no_allocation_with_open_charges
- **Row 127** · 324,000 MNT · tier=attention (low_confidence)
  - memo: `Eric, Manduun math`
  - proposed: Manduukh Sanaa (8E)
  - edit distance 1, no class in memo
  - also: no_allocation_with_open_charges
- **Row 145** · 400,000 MNT · tier=attention (multiple_candidates)
  - memo: `A NUOJIN(M.ANUJIN) 1JB, TAEKWONDO (ХААН БАНК CHAOGE MANDUHU)`
  - proposed: Anuojin/Anujin - (1JB)
  - edit distance 2, class corroborates
- **Row 172** · 750,000 MNT · tier=attention (multi_student)
  - memo: `З.ОЮУДАРЬ 11A З.НОМИНДАРЬ 8D (ХААН БАНК БАЯРСАЙХАН УУГАНЦЭЦЭГ)`
  - proposed: Oyudari Zolbayar (11A)
  - edit distance 2, class corroborates
- **Row 209** · 400,000 MNT · tier=attention (low_confidence)
  - memo: `O.ERDEM/UT20291175/ BURTGELIN HURAAMJ (ХААН БАНК ДАМДИНСҮРЭН ЭНХБОЛД)`
  - proposed: Erdem Shinebayar (9A)
  - edit distance 1, no class in memo
  - also: surname_initial_mismatch
- **Row 293** · 275,000 MNT · tier=attention (unbalanced)
  - memo: `SORSARAANA 1JK VLDEGDEL (ГОЛОМТ БАНК УРАНЗОРИГТ ПҮРЭВ-ОЧИР)`
  - proposed: Sorsaraanaa Uranzorigt (1JK)
  - edit distance 1, class corroborates
  - also: no_allocation_with_open_charges
- **Row 351** · 210,000 MNT · tier=attention (unbalanced)
  - memo: `ХОНГОРЗРЛ 8В ВОЛЛЕЙБОЛ (ГОЛОМТ БАНК БАТ-ОТГОН ЛХАГВАЖАВ)`
  - proposed: Khongorzol Gan-Ochir (8B)
  - edit distance 1, class corroborates
  - also: no_allocation_with_open_charges
- **Row 353** · 10,000,000 MNT · tier=attention (low_confidence)
  - memo: `М.АРИУНХҮСЛЭН М.МӨНХХҮСЛЭН (ХААН БАНК ЦЭНГЭЛ ЦАЦРАЛ)`
  - proposed: Ariunkhuslen Yondonpurev (1JA)
  - edit distance 1, no class in memo
  - also: surname_initial_mismatch
- **Row 386** · 26,516,250 MNT · tier=attention (low_confidence)
  - memo: `М.АРИУНХҮСЛЭН М.МӨНХХҮСЛЭН (ХААН БАНК ЦЭНГЭЛ ЦАЦРАЛ)`
  - proposed: Ariunkhuslen Yondonpurev (1JA)
  - edit distance 1, no class in memo
  - also: surname_initial_mismatch, under_allocated
- **Row 389** · 3,000,000 MNT · tier=attention (flagged)
  - memo: `3LM М.ЯВУУДАЙ ТӨЛБӨР (ХААН БАНК БААТАР АРИУНЦЭЦЭГ)`
  - proposed: Yvuudai Myagmardorj (3LM)
  - edit distance 1, class corroborates
- **Row 412** · 200,000 MNT · tier=attention (unbalanced)
  - memo: `Ц. ОЮУНБИЛГҮҮН ТӨЛБӨР ҮЛДЭГДЭЛ-8Д (ХААН БАНК БӨХХУЯГ ХИШИГЖАРГАЛ)`
  - proposed: Oyunbilguun Tserenjamts (8D)
  - edit distance 1, class corroborates
  - also: no_allocation_with_open_charges
- **Row 471** · 255,000 MNT · tier=confident (confident)
  - memo: `EANIRLAN 6E ANGI GAR BUMBUG DUGUILAN (M BANK СҮХБААТАР ГАНЧИМЭГ)`
  - proposed: Anirlan Erdenebayar (6E)
  - edit distance 1, class corroborates
- **Row 496** · 1,505,715 MNT · tier=attention (low_confidence)
  - memo: `GAQIURI 3PER 4D SEASON (ХААН БАНК TE RIGELE)`
  - proposed: Qiuri Ga (3+)
  - edit distance 1, no class in memo
- **Row 522** · 50,000 MNT · tier=attention (unbalanced)
  - memo: `Э.УХААНЗАЯА 5TA (ХААН БАНК ӨЛЗИЙСАЙХАН ЭРДЭНЭСАЙХАН)`
  - proposed: Ukhaanzaya Erdenesaikhan (5TA)
  - edit distance 1, class corroborates
  - also: no_allocation_with_open_charges
- **Row 531** · 255,000 MNT · tier=confident (confident)
  - memo: `Э.СОЛОНГОО- 4SA /УРАН ЗУРАГ/ 99805775 (ХААН БАНК БАЯНМӨНХ ЦОЛМОНЧИМЭГ)`
  - proposed: Sodongoo Enkh-Amgalan (4SA)
  - edit distance 1, class corroborates
- **Row 544** · 394,000 MNT · tier=attention (low_confidence)
  - memo: `Home work 2 T.MunhkErdene`
  - proposed: Munkh-Erdene Tuvshintur (2AB)
  - edit distance 1, no class in memo

## `unmatched_despite_name` (medium) — 12 rows

Memo contains a name but no student was proposed

- **Row 88** · 240,000 MNT · tier=attention (unmatched)
  - memo: `EB-ШИНЭ ҮЕ СУРГУУЛЬ САГСАН БӨМБӨГ ХУРААМЖ (ХААН БАНК ЕРӨНХИЙ БОЛОВСРОЛЫН ШИНЭ ҮЕ СУРГУУЛ)`
  - proposed: (no proposal)
  - memo token "shine" is 1 edit(s) from directory name "shin" but no student was proposed
- **Row 95** · 3,000,000 MNT · tier=attention (unmatched)
  - memo: `EB-1 SUOTAI (ХААН БАНК БУЯН АРВИЖИХ БСА)`
  - proposed: (no proposal)
  - memo token "suutai" is 2 edit(s) from directory name "suduhai" but no student was proposed
- **Row 125** · 690,000 MNT · tier=attention (unmatched)
  - memo: `1JB ВҮ ЭНЭРЭЛ HOMEWORK (ХААН БАНК SHI MALETE)`
  - proposed: (no proposal)
  - memo token "enerel" is 1 edit(s) from directory name "enerelt" but no student was proposed
- **Row 135** · 600,000 MNT · tier=attention (unmatched)
  - memo: `3SE,БОДЬДАРЬ,4-Р УЛИРЛЫН БАЛЕТ БҮРТГЭЛ (ГОЛОМТ БАНК LUOJIE JIAXIANG)`
  - proposed: (no proposal)
  - memo token "buddar" is 2 edit(s) from directory name "budidari" but no student was proposed
- **Row 139** · 120,000 MNT · tier=attention (unmatched)
  - memo: `EB -Монтэ Роза Кибер (ХУДАЛДАА ХӨГЖЛИЙН БАНК МОНТЭ РОЗА КИБЕР ХХК)`
  - proposed: (no proposal)
  - memo token "munte" is 2 edit(s) from directory name "munh" but no student was proposed
- **Row 194** · 360,000 MNT · tier=attention (unmatched)
  - memo: `6D-AnDai-Math&#39;s club (КАПИТРОН БАНК YING XIU)`
  - proposed: (no proposal)
  - memo token "andai" is 2 edit(s) from directory name "anudari" but no student was proposed
- **Row 217** · 400,000 MNT · tier=attention (unmatched)
  - memo: `Б. ЭЛБЭРЭЛ 3, БҮРТГЭЛИЙН ХУРААМЖ (ХААН БАНК БАТБАЯР БИЛЭГТ)`
  - proposed: (no proposal)
  - memo token "b.elberel" is 2 edit(s) from directory name "b.enerel" but no student was proposed
- **Row 276** · 5,000,000 MNT · tier=attention (unmatched)
  - memo: `Б.ЭЛБЭРЭЛ 3 , 2026.09САРД СУРГАЛЫНТӨЛБӨР (ХААН БАНК БАТБАЯР БИЛЭГТ)`
  - proposed: (no proposal)
  - memo token "b.elberel" is 2 edit(s) from directory name "b.enerel" but no student was proposed
- **Row 313** · 4,857,142 MNT · tier=attention (unmatched)
  - memo: `CHELE 5?B ТӨЛБӨР (ХААН БАНК HASI GAOWA)`
  - proposed: (no proposal)
  - memo token "chele" is 2 edit(s) from directory name "chae" but no student was proposed
- **Row 314** · 400,000 MNT · tier=attention (unmatched)
  - memo: `CHELE 5?B БҮРТГЭЛ (ХААН БАНК HASI GAOWA)`
  - proposed: (no proposal)
  - memo token "chele" is 2 edit(s) from directory name "chae" but no student was proposed
- **Row 391** · 120,000 MNT · tier=attention (unmatched)
  - memo: `РОЯАЛЬ БДС-C САГСНЫ ХУРААМЖ (ХААН БАНК ГАНБОЛД БАЯРМАА)`
  - proposed: (no proposal)
  - memo token "ruyaal" is 2 edit(s) from directory name "uyaral" but no student was proposed
- **Row 499** · 255,000 MNT · tier=attention (unmatched)
  - memo: `EB -YiErgui-6B，volleyball (ХУДАЛДАА ХӨГЖЛИЙН БАНК TANG HAI)`
  - proposed: (no proposal)
  - memo token "yiergui" is 2 edit(s) from directory name "ergui" but no student was proposed

## `level_mismatch` (medium) — 9 rows

Memo names a grade level the proposed student is not in

- **Row 15** · 48,775,000 MNT · tier=attention (unbalanced)
  - memo: `Tushig 4grade Sergelen Saran 7 grade 2026-27 academic year`
  - proposed: Saran Mariya Erdenetuul (12B)
  - memo level 4/7 vs student in 12B
  - also: multi_student_fallback, under_allocated
- **Row 19** · 400,000 MNT · tier=attention (low_confidence)
  - memo: `EB-ANIR 1-R ANGI 99102455 (ХААН БАНК ТӨМӨРБААТАР САРАНГЭРЭЛ)`
  - proposed: Anir Batsaikhan (9D)
  - memo level 1 vs student in 9D
  - also: coin_flip_candidates
- **Row 21** · 5,000,000 MNT · tier=attention (low_confidence)
  - memo: `EB-L.ANIR 1-R ANGI 99102455 (ХААН БАНК ТӨМӨРБААТАР САРАНГЭРЭЛ)`
  - proposed: Anir-Erdene Munkhzaya (5IA)
  - memo level 1 vs student in 5IA
  - also: coin_flip_candidates
- **Row 27** · 400,000 MNT · tier=attention (low_confidence)
  - memo: `О.EZLEN 1-Р АНГИ (ХААН БАНК ЧОЙЖИЛ МЯГМАРДОРЖ)`
  - proposed: Ezlen Enkhmanlai (5KO)
  - memo level 1 vs student in 5KO
  - also: surname_initial_mismatch, fuzzy_only_match
- **Row 123** · 400,000 MNT · tier=attention (missing_charge)
  - memo: `БАТБЭХ АНХИЛ-ҮЖИН 4 НАС АНГИ (ХААН БАНК БАДАМСҮРЭН ХУЛАН)`
  - proposed: Ankhil Ider (2MG)
  - memo level 4 vs student in 2MG
- **Row 338** · 4,900,000 MNT · tier=attention (flagged)
  - memo: `EZLEN 1-Р АНГИ 88115699 (ХААН БАНК ЧОЙЖИЛ МЯГМАРДОРЖ)`
  - proposed: Ezlen Enkhmanlai (5KO)
  - memo level 1 vs student in 5KO
- **Row 394** · 4,350,000 MNT · tier=attention (multiple_candidates)
  - memo: `EB -Л. Амир, 5 В, 4-р улирал (ХУДАЛДАА ХӨГЖЛИЙН БАНК AMIR LAILA)`
  - proposed: Amir Dilshad (7B)
  - memo level 5 vs student in 7B
  - also: coin_flip_candidates
- **Row 441** · 5,000,000 MNT · tier=attention (multiple_candidates)
  - memo: `ORGIL NEGUN PRESCHOOL5? /88786688/ (ХААН БАНК ОТГОНЖАРГАЛ ҮҮРЦАЙХ)`
  - proposed: Negun Zorigtbaatar (4SA)
  - memo level 1+/2+/3+/4+/5+ vs student in 4SA
  - also: coin_flip_candidates
- **Row 487** · 1,125,000 MNT · tier=attention (multi_student)
  - memo: `BUS12 Х. ЕСҮХЭЙ, ЕСҮЙ, ЕСҮТЭЙ (ХААН БАНК БАТМӨНХ БААСАНСҮРЭН)`
  - proposed: Esukhei Kherlen (8E)
  - memo level 12 vs student in 8E

## `multi_student_separator` (medium) — 1 rows

Memo lists several students with an explicit separator, but only one was proposed

- **Row 4** · 270,000 MNT · tier=attention (flagged)
  - memo: `YI,ERGUI. 6B, VOLLEYBALL (ХААН БАНК XXX TENGHE)`
  - proposed: Yi Ergui . (6B)
  - separated segments name Yi Bo / Tergel Gong | Yi Ergui .; proposed only Yi Ergui . for the full 270,000 MNT

## `combo_available_not_taken` (medium) — 1 rows

A combination of charges sums to the amount but wasn't used

- **Row 169** · 400,000 MNT · tier=attention (unbalanced)
  - memo: `LEE MINWOO KAAN 1ML TAEKWONDO (ХААН БАНК ЭНХЖАРГАЛ ИТГЭЛ)`
  - proposed: Kaan Lee Minwoo (1ML)
  - 1 combination(s) sum to the amount, e.g. #1785 registration 400,000 MNT
  - also: no_allocation_with_open_charges

## `under_allocated` (low) — 8 rows

Allocation is short of the transfer amount

- **Row 15** · 48,775,000 MNT · tier=attention (unbalanced)
  - memo: `Tushig 4grade Sergelen Saran 7 grade 2026-27 academic year`
  - proposed: Saran Mariya Erdenetuul (12B)
  - allocated 25,000,000 MNT of 48,775,000 MNT; 23,775,000 MNT unexplained; flags: overpayment, multi_student_unresolved
  - also: level_mismatch, multi_student_fallback
- **Row 32** · 20,500,000 MNT · tier=attention (unbalanced)
  - memo: `BOLOR NAIDAN 5MA (FOR 6TH CLASS), BOLOR NAIDAN 5MA (FOR 6TH CLASS) (M BANK ПҮРЭВДОРЖ НАЙДАН)`
  - proposed: Bolor Naidan (5MA)
  - allocated 19,255,000 MNT of 20,500,000 MNT; 1,245,000 MNT unexplained; flags: overpayment
- **Row 55** · 18,525,000 MNT · tier=attention (unbalanced)
  - memo: `Sondor Naidan 5?c (for 1st class) (ХАС БАНК ХУЛАН ЭНХСАЙХАН)`
  - proposed: Sondor Naidan (5+C)
  - allocated 13,000,000 MNT of 18,525,000 MNT; 5,525,000 MNT unexplained; flags: overpayment
- **Row 66** · 19,500,000 MNT · tier=attention (unbalanced)
  - memo: `NINJIN TENGIS 4RR 2026-2027 FEE (ГОЛОМТ БАНК ТЭНГИС ЭРДЭНЭБАТ)`
  - proposed: Ninjin Tengis (4RR)
  - allocated 19,000,000 MNT of 19,500,000 MNT; 500,000 MNT unexplained; flags: overpayment
- **Row 67** · 21,500,000 MNT · tier=attention (unbalanced)
  - memo: `ОЧ ОВОГТОЙ САЯН 9Д АНГИ ТӨЛБӨР ОЮУТОЛГОЙ (ХУДАЛДАА ХӨГЖЛИЙН БАНК ЭНХТУЯА ШИЛЭГ)`
  - proposed: Sayan Och (8D)
  - allocated 20,000,000 MNT of 21,500,000 MNT; 1,500,000 MNT unexplained; flags: overpayment
  - also: class_mismatch
- **Row 68** · 19,500,000 MNT · tier=attention (unbalanced)
  - memo: `EB -Bayarsaikhan-ii Anand 4SA angi tulbur (ХУДАЛДАА ХӨГЖЛИЙН БАНК БАЯРСАЙХАН БААТАРХҮҮ)`
  - proposed: Anand Bayarsaikhan (4SA)
  - allocated 19,000,000 MNT of 19,500,000 MNT; 500,000 MNT unexplained; flags: overpayment
- **Row 386** · 26,516,250 MNT · tier=attention (low_confidence)
  - memo: `М.АРИУНХҮСЛЭН М.МӨНХХҮСЛЭН (ХААН БАНК ЦЭНГЭЛ ЦАЦРАЛ)`
  - proposed: Ariunkhuslen Yondonpurev (1JA)
  - allocated 18,300,000 MNT of 26,516,250 MNT; 8,216,250 MNT unexplained; flags: overpayment
  - also: surname_initial_mismatch, fuzzy_only_match
- **Row 388** · 31,500,000 MNT · tier=attention (unbalanced)
  - memo: `HYEOKJAE JANG_11B (ХААН БАНК LEE WON KYUNG)`
  - proposed: Hyeokjae Jang (11B)
  - allocated 25,000,000 MNT of 31,500,000 MNT; 6,500,000 MNT unexplained; flags: overpayment
