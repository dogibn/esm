# Bank Transaction Matching — Dry Run

- Generated: 2026-08-04T14:38:02.228Z
- Source: `features/imports/data/bank_transactions_sample.xlsx`
- Academic year: 2025-2026 (id=1), term: Term 4 (id=4)
- Students=1387, enrollments=1373, open charges=1907
- Rows: 565 (231 filtered before matching, 334 incoming)

## Summary — what the reviewer sees

- confident (bulk-confirmable): 117 / 334 (35%)
- attention (needs a human): 217 / 334 (65%)

Attention reasons:
- missing_charge: 65
- multiple_candidates: 36
- unbalanced: 33
- flagged: 31
- not_student: 16
- low_confidence: 15
- unmatched: 15
- multi_student: 6

Raw MatchResult kinds (incoming only):
- matched: 282
- unmatched: 31
- low_confidence: 15
- matched_multi: 6

Unmatched reasons:
- not_student: 16
- no_candidates: 15

## Stage coverage

Which stages produced evidence, per incoming row (grade stage collapses to its
strongest hit: class > wildcard > level).

- class+name+fee: 155
- class+name: 65
- name: 30
- name+fee: 25
- level+name: 22
- level+name+fee: 19
- wildcard+name: 13
- wildcard+name+fee: 5

## Rows

### Row 1 — 4,250,000 MNT
- Memo: `EB -Munkhbadrakh Khongor-Uchral, preschool 5 , 3-r ulirliin tulbur (ХУДАЛДАА ХӨГЖЛИЙН БАНК ӨЛЗИЙ-АМГАЛАН НЯМААСҮРЭН)`
- Sender: MN730004000436028195 (ӨЛЗИЙ-АМГАЛАН НЯМААСҮРЭН)
- Tier: **confident** (confident)
- Status: **matched** (2 proposal(s))
  - → Khongor-uchral Munkhbadrakh | signals: memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1088 "tuition" 4,250,000 MNT
  - → Anand-Ochir Hongor | signals: memo_grade_level, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1357 "tuition" 4,250,000 MNT

### Row 2 — 210,000 MNT
- Memo: `Б.БААТАР 8Д САГСАН БӨМБӨГ (ХААН БАНК ГАНСҮХ ЭНХТАЙВАН)`
- Sender: MN560005005400550725 (ГАНСҮХ ЭНХТАЙВАН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Baatar Boldtseren | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1602 "basketball GR 6-9 Term 4" 210,000 MNT

### Row 3 — 210,000 MNT
- Memo: `8вUjinlkham гар бөмбөг`
- Sender: MN680034370000000854 (ЯНЖМАА БАЖААХҮҮ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Ujinlkham Otgonbayar | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1399 "Volleyball 1-3pm Term 4" 210,000 MNT

### Row 4 — 270,000 MNT
- Memo: `YI,ERGUI. 6B, VOLLEYBALL (ХААН БАНК XXX TENGHE)`
- Sender: MN300005005037634520 (XXX TENGHE)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Yi Ergui . | signals: memo_grade_class, memo_name_full, fee_hint_explicit | flags: overpayment
    - alloc charge #1703 "Volleyball 11 am to 1pm Term 4" 270,000 MNT

### Row 5 — 225,000 MNT
- Memo: `E.MISHEEL 1JA HOMEWORK CLUB1 (ХААН БАНК ОГНООН АРИУНБОЛД)`
- Sender: MN180005005009461183 (ОГНООН АРИУНБОЛД)
- Tier: **confident** (confident)
- Status: **matched** (4 proposal(s))
  - → Misheel Erdenetsogt | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1615 "HW GR1 Term 4" 225,000 MNT
  - → Misheel Erkhembayar | signals: memo_name_initial, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Misheel Enkhtuvshin | signals: memo_name_initial, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Misheel Erkhembayar | signals: memo_name_initial, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 6 — 1,500,000 MNT
- Memo: `RISHAB SAMUDRAJIT,10 B (ГОЛОМТ БАНК SAMUDRAJIT SAIKIA)`
- Sender: MN300015002205046519 (SAMUDRAJIT SAIKIA)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Rishab Samudrajit | signals: memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #629 "tuition" 1,500,000 MNT

### Row 7 — 750,000 MNT
- Memo: `4SA AGVAANNINJ BUS PAYMENT (ХААН БАНК БАТТУЛГА АЛТАНТУЯА)`
- Sender: MN670005005302056921 (БАТТУЛГА АЛТАНТУЯА)
- Tier: **attention** (unbalanced)
- Status: **matched** (1 proposal(s))
  - → Agvaanninj Tsogtgerel | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 8 — 2,000,000 MNT
- Memo: `Munkhbat Dulguun 2 OB`
- Sender: MN410034100900651543 (МӨНГӨНЧИМЭГ ЧУЛУУНБААТАР)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Dulguun Munkhbat | signals: memo_grade_class, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #929 "tuition" 2,000,000 MNT

### Row 9 — 0 MNT
- Memo: `Бялуу авахад РД:9097392 (ГОЛОМТ БАНК СКАЙХАЙПЕРМАРКЕТ ХХК)`
- Sender: MN020015003635101339 (СКАЙХАЙПЕРМАРКЕТ ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 10 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 11 — 7,000,000 MNT
- Memo: `ENKHBAYAR ENEREL ULDEGDEL TOLBOR 12B 99556365 (ХААН БАНК БОЛД БАДАМ)`
- Sender: MN230005005169119407 (БОЛД БАДАМ)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (2 proposal(s))
  - → Enerel Enkhbayar | signals: memo_grade_class, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #240 "tuition" 7,000,000 MNT
  - → Enkhbayar Otgonbayar | signals: memo_grade_class, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1046 "tuition" 7,000,000 MNT

### Row 12 — 4,200,000 MNT
- Memo: `EB -1JK U.Ariun-Erdene tolboriin uldegdel (ХУДАЛДАА ХӨГЖЛИЙН БАНК БОЛОРМАА ГҮНДСАМБУУ)`
- Sender: MN230004000407255500 (БОЛОРМАА ГҮНДСАМБУУ)
- Tier: **confident** (confident)
- Status: **matched** (3 proposal(s))
  - → Ariun-Erdene Undrakhtamir | signals: memo_grade_class, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1092 "tuition" 4,200,000 MNT
  - → Erdene Gerel | signals: memo_grade_class, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1125 "tuition" 4,200,000 MNT
  - → Tselmeg Molor-Erdene | signals: memo_grade_class, memo_name_partial | flags: no_open_charges
    - (no allocation)

### Row 13 — 400,000 MNT
- Memo: `TSENGEL TARA TSETSERLEG BURTGELIINHURAAMJ (ХААН БАНК ЭНХЦАГ ЦЭНГЭЛ)`
- Sender: MN220005005003993124 (ЭНХЦАГ ЦЭНГЭЛ)
- Tier: **attention** (low_confidence)
- Status: **low_confidence** (5 proposal(s))
  - → Byekbol Tsengel | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Michid Tsengel | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Khuslen Tsengel | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Erkhes Tsengel | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Tselmuun Tsengel | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)

### Row 14 — 375,000 MNT
- Memo: `MM:8C Temuujin Misheel bus (ТӨРИЙН БАНК И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ БСБ) (АРД КРЕДИТ ББСБ БАДАМ БАТЦЭЦЭГ)`
- Sender: MN210052112700163720 (БАДАМ БАТЦЭЦЭГ)
- Tier: **attention** (missing_charge)
- Status: **matched** (3 proposal(s))
  - → MIsheel Temuujin | signals: memo_grade_class, memo_name_full, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Misheel Natsagdorj | signals: memo_grade_class, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Misheel Sainbileg | signals: memo_grade_class, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 15 — 48,775,000 MNT
- Memo: `Tushig 4grade Sergelen Saran 7 grade 2026-27 academic year`
- Sender: MN400034102300024195 (СЭРГЭЛЭН ЦЭДЭНДАМБА)
- Tier: **attention** (unbalanced)
- Status: **matched** (5 proposal(s))
  - → Saran Mariya Erdenetuul | signals: memo_name_partial | flags: overpayment
    - alloc charge #275 "tuition" 25,000,000 MNT
  - → Tushig Batsaikhan | signals: memo_grade_level, memo_name_partial | flags: overpayment
    - alloc charge #60 "tuition" 19,000,000 MNT
  - → Tushig Lkhagvasuren | signals: memo_grade_level, memo_name_partial | flags: overpayment
    - alloc charge #542 "tuition" 17,100,000 MNT
    - alloc charge #1518 "Football GR 3-5 /Term 4/" 300,000 MNT
    - alloc charge #1519 "Taekwondo Term 4 /Grade 1-5/" 400,000 MNT
  - → Sergelen Batbayar | signals: memo_grade_level, memo_name_partial | flags: overpayment
    - alloc charge #996 "tuition" 24,000,000 MNT
  - → Tushig Bayarbat | signals: memo_name_partial | flags: overpayment
    - alloc charge #112 "tuition" 19,000,000 MNT

### Row 16 — 5,425,000 MNT
- Memo: `4BA UILSTUGULDUR 88077955 (ХААН БАНК НАРАНГЭРЭЛ ЭНХДӨЛГӨӨН)`
- Sender: MN030005005041122447 (НАРАНГЭРЭЛ ЭНХДӨЛГӨӨН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Uilstuguldur Bilguunbold | signals: memo_grade_class, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #555 "tuition" 5,425,000 MNT

### Row 17 — 400,000 MNT
- Memo: `Бүртгэлийн хураамж Алтанхуяг Дармаагирди`
- Sender: MN290034103801880631 (ОТГОНБАВУУ НАМШИР)
- Tier: **attention** (missing_charge)
- Status: **matched** (3 proposal(s))
  - → Darmagirdi Altankhuyag | signals: memo_name_partial, memo_name_fuzzy, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Telmen Altankhuyag | signals: memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #1864 "registration" 400,000 MNT
  - → Sujata Altankhuyag | signals: memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)

### Row 18 — 0 MNT
- Memo: `Өөрийн данс хооронд`
- Sender: MN250034385300029587 (И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ БСБ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 19 — 400,000 MNT
- Memo: `EB-ANIR 1-R ANGI 99102455 (ХААН БАНК ТӨМӨРБААТАР САРАНГЭРЭЛ)`
- Sender: MN420005005700409793 (ТӨМӨРБААТАР САРАНГЭРЭЛ)
- Tier: **attention** (low_confidence)
- Status: **low_confidence** (5 proposal(s))
  - → Anir Batsaikhan | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #1874 "registration" 400,000 MNT
  - → Anir-Erdene Munkhzaya | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Anir Otgonchuluun | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Anir Bum-Erdene | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Anir Batbayar | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)

### Row 20 — 6,500,000 MNT
- Memo: `8B TSELMUUN 88077955 (ХААН БАНК НАРАНГЭРЭЛ ЭНХДӨЛГӨӨН)`
- Sender: MN030005005041122447 (НАРАНГЭРЭЛ ЭНХДӨЛГӨӨН)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Tselmuun Bilguunbold | signals: memo_grade_class, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #44 "tuition" 6,500,000 MNT

### Row 21 — 5,000,000 MNT
- Memo: `EB-L.ANIR 1-R ANGI 99102455 (ХААН БАНК ТӨМӨРБААТАР САРАНГЭРЭЛ)`
- Sender: MN420005005700409793 (ТӨМӨРБААТАР САРАНГЭРЭЛ)
- Tier: **attention** (low_confidence)
- Status: **low_confidence** (5 proposal(s))
  - → Anir-Erdene Munkhzaya | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #284 "tuition" 5,000,000 MNT
  - → Anir Otgonchuluun | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #524 "tuition" 5,000,000 MNT
  - → Anir Bum-Erdene | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #587 "tuition" 5,000,000 MNT
  - → Anir Batbayar | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #811 "tuition" 5,000,000 MNT
  - → Anir Batsaikhan | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1277 "tuition" 5,000,000 MNT

### Row 22 — 0 MNT
- Memo: `FINANCIAL LOAN AGREEMENT`
- Sender: 3499102621090002 (SWIFT- ИЛГЭЭХ ГҮЙЛГЭЭНИЙ ӨГЛӨГ /ҮНДСЭН ДҮН/)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 23 — 0 MNT
- Memo: `SWIFT ХУРААМЖ:[30000.00MNT] /430801`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 24 — 0 MNT
- Memo: `SWIFT  CHARGE OUR:[30.00USD] /262110`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 25 — 2,350,000 MNT
- Memo: `A.OYU-VJIN 3 LM (ХААН БАНК ПҮРЭВ-УХНА АРИУНБАТ)`
- Sender: MN500005005700985053 (ПҮРЭВ-УХНА АРИУНБАТ)
- Tier: **attention** (flagged)
- Status: **matched** (2 proposal(s))
  - → Oyu-Ujin Ariunbat | signals: memo_grade_class, memo_name_fuzzy, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #725 "tuition" 2,350,000 MNT
  - → Oyun Amartogtokh | signals: memo_name_fuzzy, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1247 "tuition" 2,350,000 MNT

### Row 26 — 1,300,000 MNT
- Memo: `ATTILA DICKMANS - KOREAN TRIP (ХААН БАНК DICKMANS PIETER)`
- Sender: MN520005005179083307 (DICKMANS PIETER)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Attila Dickmans | signals: memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #624 "tuition" 1,300,000 MNT

### Row 27 — 400,000 MNT
- Memo: `О.EZLEN 1-Р АНГИ (ХААН БАНК ЧОЙЖИЛ МЯГМАРДОРЖ)`
- Sender: MN270005005309592310 (ЧОЙЖИЛ МЯГМАРДОРЖ)
- Tier: **attention** (low_confidence)
- Status: **low_confidence** (1 proposal(s))
  - → Ezlen Enkhmanlai | signals: memo_name_fuzzy, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)

### Row 28 — 130,000 MNT
- Memo: `JAVKHLAN UJIN 2LB (ХААН БАНК СОДНОМДОРЖ ЖАВХЛАН)`
- Sender: MN670005005003855447 (СОДНОМДОРЖ ЖАВХЛАН)
- Tier: **attention** (unbalanced)
- Status: **matched** (2 proposal(s))
  - → Ujin Javkhlan | signals: memo_grade_class, memo_name_full | flags: manual_review
    - (no allocation)
  - → Namu-Ujin Munguntulga | signals: memo_grade_class, memo_name_partial | flags: manual_review
    - (no allocation)

### Row 29 — 345,000 MNT
- Memo: `2LB ZHAHEYA (ХААН БАНК XXX BUHEBILIGE)`
- Sender: MN260005005011851895 (XXX BUHEBILIGE)
- Tier: **attention** (unbalanced)
- Status: **matched** (1 proposal(s))
  - → Zhaheya - | signals: memo_grade_class, memo_name_partial | flags: manual_review
    - (no allocation)

### Row 30 — 30,000 MNT
- Memo: `TEMDEGTIIN HURAAMJ, ARIUNKHUSLEN MUNKHKHUSLEN (ХААН БАНК ЦЭНГЭЛ ЦАЦРАЛ)`
- Sender: MN740005005062038152 (ЦЭНГЭЛ ЦАЦРАЛ)
- Tier: **attention** (unbalanced)
- Status: **matched** (1 proposal(s))
  - → Ariunkhuslen Yondonpurev | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 31 — 150,000 MNT
- Memo: `8B D. AMARJAVKHLAN VOLLEYBALL WEEKEND 99087953 (ХААН БАНК ГОМБО БОЛОРМАА)`
- Sender: MN790005005402351504 (ГОМБО БОЛОРМАА)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Amarjavkhlan Deleg | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1542 "Volleyball 11 am to 1pm Term 4" 150,000 MNT

### Row 32 — 20,500,000 MNT
- Memo: `BOLOR NAIDAN 5MA (FOR 6TH CLASS), BOLOR NAIDAN 5MA (FOR 6TH CLASS) (M BANK ПҮРЭВДОРЖ НАЙДАН)`
- Sender: MN630039008000300510 (ПҮРЭВДОРЖ НАЙДАН)
- Tier: **attention** (unbalanced)
- Status: **matched** (3 proposal(s))
  - → Bolor Naidan | signals: memo_grade_class, memo_name_full | flags: overpayment
    - alloc charge #975 "tuition" 19,000,000 MNT
    - alloc charge #1637 "Art KS2 /Term 4/" 255,000 MNT
  - → Sondor Naidan | signals: memo_name_full | flags: overpayment
    - alloc charge #884 "tuition" 13,000,000 MNT
  - → Karl Naidan Schnorbusch | signals: memo_name_full | flags: overpayment
    - alloc charge #908 "tuition" 18,000,000 MNT

### Row 33 — 0 MNT
- Memo: `Өөрийн данс хооронд`
- Sender: MN250034385300029587 (И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ БСБ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 34 — 2,250,000 MNT
- Memo: `4BA Э,Амартүвшин  сургалтын төлбөр  99097804`
- Sender: MN020034340003852507 (ДАВААДУЛАМ НАДМИДСҮРЭН)
- Tier: **confident** (confident)
- Status: **matched** (4 proposal(s))
  - → Amartuvshin Enkhbaatar | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #505 "tuition" 2,250,000 MNT
  - → Argun Amartuvshin | signals: memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #425 "tuition" 2,250,000 MNT
  - → Indranil Amartuvshin | signals: memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1216 "tuition" 2,250,000 MNT
  - → Amartuvshin Erdenelkhagva | signals: memo_name_partial, fee_hint_explicit | flags: no_open_charges
    - (no allocation)

### Row 35 — 9,000,000 MNT
- Memo: `11 E.Amarbayasgalan 99097804 surgalt tulbur`
- Sender: MN020034340003852507 (ДАВААДУЛАМ НАДМИДСҮРЭН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Amarbayasgalan Enkhbaatar | signals: memo_grade_level, memo_name_initial, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1293 "tuition" 9,000,000 MNT

### Row 36 — 0 MNT
- Memo: `Акустик хавтан (ХААН БАНК МОДЕРН МОНГОЛИА МАРВЕЛС )`
- Sender: MN830005005009797088 (МОДЕРН МОНГОЛИА МАРВЕЛС)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 37 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 38 — 0 MNT
- Memo: `Аргилит хавтан авахад (ХААН БАНК БИ ЭС ЭЙЧ)`
- Sender: MN830005005027718129 (БИ ЭС ЭЙЧ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 39 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 40 — 135,000 MNT
- Memo: `ARURI ALTAN 7A FOOTBALL CLUB (ХААН БАНК XXX TUYA)`
- Sender: MN610005005131206564 (XXX TUYA)
- Tier: **confident** (confident)
- Status: **matched** (2 proposal(s))
  - → Aruri Alatan | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1469 "football GR 6-9 Term 4" 135,000 MNT
  - → Baiguulsan Altan-Uul | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1598 "football GR 6-9 Term 4" 135,000 MNT

### Row 41 — 30,000 MNT
- Memo: `E.BATMUNKH ESM (ХААН БАНК ДЭРЭМ АРИУНЖАРГАЛ)`
- Sender: MN780005005034916201 (ДЭРЭМ АРИУНЖАРГАЛ)
- Tier: **attention** (low_confidence)
- Status: **low_confidence** (1 proposal(s))
  - → Batmunkh Gerelt-Od | signals: memo_name_fuzzy | flags: manual_review
    - (no allocation)

### Row 42 — 400,000 MNT
- Memo: `ХОСБАЯР ТЭМҮҮЛЭЛ 3? (ХААН БАНК ЭРДЭНЭСҮХ ХОСБАЯР)`
- Sender: MN520005005429402380 (ЭРДЭНЭСҮХ ХОСБАЯР)
- Tier: **attention** (missing_charge)
- Status: **matched** (5 proposal(s))
  - → Temuulel Nyamdorj | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Unugegeen Khosbayar | signals: memo_grade_wildcard, memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Enkhriilen Khosbayar | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Enkhrii Khosbayar | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Ninjin Khosbayar | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)

### Row 43 — 375,000 MNT
- Memo: `BUS 11A KHERLEN (ХААН БАНК МЯГМАРСҮРЭН УЯНГАА)`
- Sender: MN290005005303080567 (МЯГМАРСҮРЭН УЯНГАА)
- Tier: **attention** (missing_charge)
- Status: **matched** (4 proposal(s))
  - → Kherlen Tuvshintur | signals: memo_grade_class, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Esutei Kherlen | signals: memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Esukhei Kherlen | signals: memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Yesui Kherlen | signals: memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 44 — 0 MNT
- Memo: `Зураг угаалгахад (ХААН БАНК ТҮМЭНБААТАР ЧИМЭДЦЭРЭН)`
- Sender: MN400005005019051856 (ТҮМЭНБААТАР ЧИМЭДЦЭРЭН)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 45 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 46 — 0 MNT
- Memo: `Принтер засварт (ХААН БАНК ЮУ БИ ТИ КЭЙ)`
- Sender: MN350005005030097045 (ЮУ БИ ТИ КЭЙ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 47 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 48 — 240,000 MNT
- Memo: `EB -ASU UBAC basketball final (ХУДАЛДАА ХӨГЖЛИЙН БАНК УЛААНБААТАР ДАХЬ АМЕРИК ЕРӨНХИЙ БОЛ)`
- Sender: MN940004000404197752 (УЛААНБААТАР ДАХЬ АМЕРИК ЕРӨНХИЙ БОЛ)
- Tier: **attention** (not_student)
- Status: **unmatched** (not_student)

### Row 49 — 1,700,000 MNT
- Memo: `ATTILA - TRIP KOREA (FULL PAYMENT IS DONE) (ХААН БАНК DICKMANS PIETER)`
- Sender: MN520005005179083307 (DICKMANS PIETER)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Attila Dickmans | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #624 "tuition" 1,700,000 MNT

### Row 50 — 150,000 MNT
- Memo: `мөнхжигүүр хөлбөмбөг`
- Sender: MN370034103101866601 (ОТГОНЖАРГАЛ ЛХАГВАА)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Munkhjiguur Otgonjargal | signals: memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1450 "Football GR 3-5 /Term 4/" 150,000 MNT

### Row 51 — 414,000 MNT
- Memo: `KHULAN 10A, MATH (ХААН БАНК БАСАНЖАВ ГАНБАТ)`
- Sender: MN760005005653384066 (БАСАНЖАВ ГАНБАТ)
- Tier: **attention** (flagged)
- Status: **matched** (5 proposal(s))
  - → Khulan Ganbat | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: overpayment
    - alloc charge #1415 "Math's club /Joel/ Term 4 Tue, Thu" 414,000 MNT
  - → Khulan Chinbat | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Khulan Ganbold | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Khulan Gantulga | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Khulan Ikhbayar | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 52 — 1,625,000 MNT
- Memo: `EB -Энх-Учрал 4А ; 99097953 (ХУДАЛДАА ХӨГЖЛИЙН БАНК ДЭЛХИЙЦЭЦЭГ ДЭЛЭГНЯМДОРЖ)`
- Sender: MN590004000411096925 (ДЭЛХИЙЦЭЦЭГ ДЭЛЭГНЯМДОРЖ)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (5 proposal(s))
  - → Enkh-Uchral Tuguldur | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #562 "tuition" 1,625,000 MNT
  - → Enkh-uchral Gurbazar | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #883 "tuition" 1,625,000 MNT
  - → Narangoo Enkh-Uchral | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1161 "tuition" 1,625,000 MNT
  - → Uchral Dulguun | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #703 "tuition" 1,625,000 MNT
  - → Khongor-uchral Munkhbadrakh | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1088 "tuition" 1,625,000 MNT

### Row 53 — 0 MNT
- Memo: `Зар сурталчилгааны төлбөрт (ГОЛОМТ БАНК СИЛВЭР СТЕРЛИНГ ХХК)`
- Sender: MN940015002015143520 (СИЛВЭР СТЕРЛИНГ ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 54 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 55 — 18,525,000 MNT
- Memo: `Sondor Naidan 5?c (for 1st class) (ХАС БАНК ХУЛАН ЭНХСАЙХАН)`
- Sender: MN530032005001259502 (ХУЛАН ЭНХСАЙХАН)
- Tier: **attention** (unbalanced)
- Status: **matched** (3 proposal(s))
  - → Sondor Naidan | signals: memo_grade_wildcard, memo_name_full | flags: overpayment
    - alloc charge #884 "tuition" 13,000,000 MNT
  - → Bolor Naidan | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #975 "tuition" 18,525,000 MNT
  - → Karl Naidan Schnorbusch | signals: memo_name_partial | flags: overpayment
    - alloc charge #908 "tuition" 18,000,000 MNT

### Row 56 — 3,000,000 MNT
- Memo: `ЕРӨӨЛТИЙН ЭНҮҮН, 3? (ХААН БАНК ДОРЖ МӨНХТУЛГА)`
- Sender: MN100005005750312601 (ДОРЖ МӨНХТУЛГА)
- Tier: **attention** (flagged)
- Status: **matched** (4 proposal(s))
  - → Enuun Yuruult | signals: memo_grade_wildcard, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1134 "tuition" 3,000,000 MNT
  - → Yeruult Anar | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #947 "tuition" 3,000,000 MNT
  - → Enkhtushig Yeruult | signals: memo_name_partial | flags: overpayment
    - alloc charge #1583 "Taekwondo Term 4 /Grade 1-5/" 400,000 MNT
  - → Goo-Ujin Yeruult | signals: memo_name_partial | flags: no_open_charges
    - (no allocation)

### Row 57 — 120,000 MNT
- Memo: `EB-UBAC САГС PLAY OFF ХУРААМЖ /АХЛАХ АНГИ/ (ХААН БАНК ТОМЁ СУРГУУЛЬ ЦЭЦЭРЛЭГИЙН ЦОГЦОЛБОР)`
- Sender: MN580005005111673146 (ТОМЁ СУРГУУЛЬ ЦЭЦЭРЛЭГИЙН ЦОГЦОЛБОР)
- Tier: **attention** (not_student)
- Status: **unmatched** (not_student)

### Row 58 — 0 MNT
- Memo: `Summer flight allowance  (ХУДАЛДАА ХӨГЖЛИЙН БАНК BRETT NICHOLAS ARENDSE)`
- Sender: MN070004000457197984 (BRETT NICHOLAS ARENDSE)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 59 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 60 — 0 MNT
- Memo: `Summer flight allowance  (ХУДАЛДАА ХӨГЖЛИЙН БАНК JEANETTE MARGARET ARENDSE)`
- Sender: MN890004000457197963 (JEANETTE MARGARET ARENDSE)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 61 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 62 — 0 MNT
- Memo: `Ma Willa Тизний төлбөр болон өдөр солиход (ХУДАЛДАА ХӨГЖЛИЙН БАНК ДИ ЭЙЧ ЭЛ ГЛОБАЛ ФОРВАРДИНГ МОНГОЛ ХХК)`
- Sender: MN940004000499437590 (ДИ ЭЙЧ ЭЛ ГЛОБАЛ ФОРВАРДИНГ МОНГОЛ ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 63 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 64 — 120,000 MNT
- Memo: `EB -8184372 уб элит сургууль UBAC19 girls (ХУДАЛДАА ХӨГЖЛИЙН БАНК ЕРӨНХИЙ БОЛОВСРОЛЫН УЛААНБААТАР ЭЛИ)`
- Sender: MN600004000463061747 (ЕРӨНХИЙ БОЛОВСРОЛЫН УЛААНБААТАР ЭЛИ)
- Tier: **attention** (not_student)
- Status: **unmatched** (not_student)

### Row 65 — 300,000 MNT
- Memo: `BASKETBALL 3CL GERELT JAVKHLANTUGS TERM 4 (ГОЛОМТ БАНК УЯНГА МАНДАЛ)`
- Sender: MN980015001109020664 (УЯНГА МАНДАЛ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Gerelt Javkhlantugs | signals: memo_grade_class, memo_name_full, fee_hint_explicit
    - alloc charge #1497 "Basketball 3-5 /Term 4/" 300,000 MNT

### Row 66 — 19,500,000 MNT
- Memo: `NINJIN TENGIS 4RR 2026-2027 FEE (ГОЛОМТ БАНК ТЭНГИС ЭРДЭНЭБАТ)`
- Sender: MN280015001605115814 (ТЭНГИС ЭРДЭНЭБАТ)
- Tier: **attention** (unbalanced)
- Status: **matched** (1 proposal(s))
  - → Ninjin Tengis | signals: memo_grade_class, memo_name_full | flags: overpayment
    - alloc charge #511 "tuition" 19,000,000 MNT

### Row 67 — 21,500,000 MNT
- Memo: `ОЧ ОВОГТОЙ САЯН 9Д АНГИ ТӨЛБӨР ОЮУТОЛГОЙ (ХУДАЛДАА ХӨГЖЛИЙН БАНК ЭНХТУЯА ШИЛЭГ)`
- Sender: MN440004000499153601 (ЭНХТУЯА ШИЛЭГ)
- Tier: **attention** (unbalanced)
- Status: **matched** (1 proposal(s))
  - → Sayan Och | signals: memo_name_full | flags: overpayment
    - alloc charge #791 "tuition" 20,000,000 MNT

### Row 68 — 19,500,000 MNT
- Memo: `EB -Bayarsaikhan-ii Anand 4SA angi tulbur (ХУДАЛДАА ХӨГЖЛИЙН БАНК БАЯРСАЙХАН БААТАРХҮҮ)`
- Sender: MN070004000499222652 (БАЯРСАЙХАН БААТАРХҮҮ)
- Tier: **attention** (unbalanced)
- Status: **matched** (3 proposal(s))
  - → Anand Bayarsaikhan | signals: memo_grade_class, memo_grade_level, memo_name_full | flags: overpayment
    - alloc charge #366 "tuition" 19,000,000 MNT
  - → Anand Altangerel | signals: memo_grade_class, memo_grade_level, memo_name_partial | flags: overpayment
    - alloc charge #379 "tuition" 17,100,000 MNT
  - → Temuulen Bayarsaikhan | signals: memo_grade_level, memo_name_partial | flags: overpayment
    - alloc charge #529 "tuition" 18,000,000 MNT
    - alloc charge #1516 "Basketball 3-5 /Term 4/" 300,000 MNT

### Row 69 — 240,000 MNT
- Memo: `EB- ХҮМҮҮН СУРУУЛЬ UBAC BASKETBALLPLAY-OFFS (ХААН БАНК НИЙСЛЭЛИЙН ЕРӨНХИЙ БОЛОВСРОЛЫН ХҮМҮ)`
- Sender: MN880005005570070550 (НИЙСЛЭЛИЙН ЕРӨНХИЙ БОЛОВСРОЛЫН ХҮМҮ)
- Tier: **attention** (not_student)
- Status: **unmatched** (not_student)

### Row 70 — 0 MNT
- Memo: `qpay 963155691744836 ID:6288655; (ТӨРИЙН САН ТӨРИЙН ҮЙЛЧИЛГЭЭНИЙ ЦАХИМ ТӨЛБӨР)`
- Sender: MN630090010090000000 (ТӨРИЙН ҮЙЛЧИЛГЭЭНИЙ ЦАХИМ ТӨЛБӨР)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 71 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 72 — 0 MNT
- Memo: `qpay 091068595041186 1000000`
- Sender: MN470034343100209164 (ККТТ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 73 — 0 MNT
- Memo: `qpay 685987149087802 ID:6288519; (ТӨРИЙН САН ТӨРИЙН ҮЙЛЧИЛГЭЭНИЙ ЦАХИМ ТӨЛБӨР)`
- Sender: MN630090010090000000 (ТӨРИЙН ҮЙЛЧИЛГЭЭНИЙ ЦАХИМ ТӨЛБӨР)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 74 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 75 — 0 MNT
- Memo: `qpay 235753425429350 100000`
- Sender: MN470034343100209164 (ККТТ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 76 — 0 MNT
- Memo: `Бараа авахад /гайхмаараа/ (ХААН БАНК ЭЛБЭГ ЭЛБЭРЭЛТ ЭРХЭМ)`
- Sender: MN220005005876205290 (ЭЛБЭГ ЭЛБЭРЭЛТ ЭРХЭМ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 77 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 78 — 120,000 MNT
- Memo: `EB -Acd. 5395348, UBAC HS girls Basketball Playoffs, ESM (ХУДАЛДАА ХӨГЖЛИЙН БАНК НИЙСЛЭЛИЙН ЕРӨНХИЙ БОЛОВСРОЛЫН БРИТ)`
- Sender: MN680004000415015175 (НИЙСЛЭЛИЙН ЕРӨНХИЙ БОЛОВСРОЛЫН БРИТ)
- Tier: **attention** (not_student)
- Status: **unmatched** (not_student)

### Row 79 — 0 MNT
- Memo: `Нэмэлт гэрээний төлбөрт / №4/ (ХААН БАНК ХААНДААТГАЛ)`
- Sender: MN600005005007739356 (ХААНДААТГАЛ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 80 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 81 — 0 MNT
- Memo: `Бичиг хэргийн төлбөрт (ХААН БАНК НАМШИР ДЭНСМАА)`
- Sender: MN580005005087090339 (НАМШИР ДЭНСМАА)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 82 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 83 — 120,000 MNT
- Memo: `EB -HS Girls Basketball ESM Invoice, РД6925707 (ХУДАЛДАА ХӨГЖЛИЙН БАНК НИЙСЛЭЛИЙН ЕРӨНХИЙ БОЛОВСРОЛЫН УЛАА)`
- Sender: MN850004000427051793 (НИЙСЛЭЛИЙН ЕРӨНХИЙ БОЛОВСРОЛЫН УЛАА)
- Tier: **attention** (not_student)
- Status: **unmatched** (not_student)

### Row 84 — 0 MNT
- Memo: `MANAGEMENT SERVICE`
- Sender: 3499102621090002 (SWIFT- ИЛГЭЭХ ГҮЙЛГЭЭНИЙ ӨГЛӨГ /ҮНДСЭН ДҮН/)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 85 — 0 MNT
- Memo: `SWIFT ХУРААМЖ:[30000.00MNT] /430801`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 86 — 0 MNT
- Memo: `SWIFT  CHARGE OUR:[30.00USD] /262110`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 87 — 526,083 MNT
- Memo: `РС74070108 (КАПИТРОН БАНК БЗД НДГ ТЭТГЭМЖ)`
- Sender: MN040030003022020007 (БЗД НДГ ТЭТГЭМЖ)
- Tier: **attention** (not_student)
- Status: **unmatched** (not_student)

### Row 88 — 240,000 MNT
- Memo: `EB-ШИНЭ ҮЕ СУРГУУЛЬ САГСАН БӨМБӨГ ХУРААМЖ (ХААН БАНК ЕРӨНХИЙ БОЛОВСРОЛЫН ШИНЭ ҮЕ СУРГУУЛ)`
- Sender: MN680005005003966688 (ЕРӨНХИЙ БОЛОВСРОЛЫН ШИНЭ ҮЕ СУРГУУЛ)
- Tier: **attention** (unmatched)
- Status: **unmatched** (no_candidates)

### Row 89 — 4,900,000 MNT
- Memo: `O.ERHEMBAYAR (ХААН БАНК БААСАНГЭРЭЛ ОТГОНХУЯГ)`
- Sender: MN270005005664390180 (БААСАНГЭРЭЛ ОТГОНХУЯГ)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Erkhembayar Otgonkhuyag | signals: memo_name_initial, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #688 "tuition" 4,900,000 MNT

### Row 90 — 4,800,000 MNT
- Memo: `O.ERHEMBAYAR (ХААН БАНК БААСАНГЭРЭЛ ОТГОНХУЯГ)`
- Sender: MN270005005664390180 (БААСАНГЭРЭЛ ОТГОНХУЯГ)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Erkhembayar Otgonkhuyag | signals: memo_name_initial, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #688 "tuition" 4,800,000 MNT

### Row 91 — 1,300,000 MNT
- Memo: `O.ERHEMBAYAR (ХААН БАНК БААСАНГЭРЭЛ ОТГОНХУЯГ)`
- Sender: MN270005005664390180 (БААСАНГЭРЭЛ ОТГОНХУЯГ)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Erkhembayar Otgonkhuyag | signals: memo_name_initial, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #688 "tuition" 1,300,000 MNT

### Row 92 — 0 MNT
- Memo: `Хулдаасан хэвлэлийн төлбөрт (ГОЛОМТ БАНК ТОД ГЭРЭЛТЭХ ӨНГӨ)`
- Sender: MN160015001405007455 (ТОД ГЭРЭЛТЭХ ӨНГӨ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 93 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 94 — 400,000 MNT
- Memo: `ENHBAT TSEGTSHUR 1 (ХААН БАНК ЭРДЭНЭЦЭЦЭГ ШҮРЭНЧУЛУУ)`
- Sender: MN860005005024317255 (ЭРДЭНЭЦЭЦЭГ ШҮРЭНЧУЛУУ)
- Tier: **attention** (missing_charge)
- Status: **matched** (5 proposal(s))
  - → Turbat Enkhbat | signals: memo_grade_level, memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Urangua Enkhbat | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #1749 "registration" 400,000 MNT
  - → Temuulen Enkhbat | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Unumunkh Enkhbat | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → minjinsor Enkhbat | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)

### Row 95 — 3,000,000 MNT
- Memo: `EB-1 SUOTAI (ХААН БАНК БУЯН АРВИЖИХ БСА)`
- Sender: MN480005005219605323 (БУЯН АРВИЖИХ БСА)
- Tier: **attention** (unmatched)
- Status: **unmatched** (no_candidates)

### Row 96 — 5,000,000 MNT
- Memo: `Lkhagvadorj Misheel 10A-angi (ХАС БАНК ЛХАГВАДОРЖ ЧУЛУУНБАТ)`
- Sender: MN550032005005734367 (ЛХАГВАДОРЖ ЧУЛУУНБАТ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Misheel lkhagvadorj | signals: memo_grade_class, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #840 "tuition" 5,000,000 MNT

### Row 97 — 0 MNT
- Memo: `Цэцэгний урьдчилгаа төлбөрт (ХААН БАНК НАРАНГЭРЭЛ ЦОГЗОЛМАА)`
- Sender: MN240005005030345466 (НАРАНГЭРЭЛ ЦОГЗОЛМАА)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 98 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 99 — 60,000 MNT
- Memo: `TEMUULEN KHALIUN 2AB (ХААН БАНК МӨНХСАЙХАН ХАЛИУНАА)`
- Sender: MN740005005114456855 (МӨНХСАЙХАН ХАЛИУНАА)
- Tier: **attention** (unbalanced)
- Status: **matched** (1 proposal(s))
  - → Khaliun Temuulen | signals: memo_grade_class, memo_name_full | flags: manual_review
    - (no allocation)

### Row 100 — 120,000 MNT
- Memo: `EB -Жэт сургууль, UBAC тэмцээний төлбөр (ХУДАЛДАА ХӨГЖЛИЙН БАНК НИЙСЛЭЛИЙН ЕРӨНХИЙ БОЛОВСРОЛЫН ЖЭТ )`
- Sender: MN770004000404253542 (НИЙСЛЭЛИЙН ЕРӨНХИЙ БОЛОВСРОЛЫН ЖЭТ)
- Tier: **attention** (not_student)
- Status: **unmatched** (not_student)

### Row 101 — 0 MNT
- Memo: `Өөрийн данс хооронд`
- Sender: MN630034103101855075 (И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ БСБ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 102 — 500,000 MNT
- Memo: `TAETSEG BUTSAALT (ХААН БАНК НАРАНГЭРЭЛ ЦОГЗОЛМАА)`
- Sender: MN240005005030345466 (НАРАНГЭРЭЛ ЦОГЗОЛМАА)
- Tier: **attention** (not_student)
- Status: **unmatched** (not_student)

### Row 103 — 0 MNT
- Memo: `Цэцэг авахад (ХУДАЛДАА ХӨГЖЛИЙН БАНК АЮУШ БАЯРЧУЛУУН)`
- Sender: MN760004000432062587 (АЮУШ БАЯРЧУЛУУН)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 104 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 105 — 39,975,000 MNT
- Memo: `УУГАНБАЯРЫН ЦОГЖАВХЛАН-7D УУГАНБАЯРЫН БАЯРЖАВХЛАН- 5TA  СУРГАЛТЫН ТӨЛБӨР (ГОЛОМТ БАНК АЛИМАА ЧУЛУУНБААТАР)`
- Sender: MN030015001605037597 (АЛИМАА ЧУЛУУНБААТАР)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (2 proposal(s))
  - → Tsogjavkhlan Uuganbayar | signals: memo_grade_class, memo_name_full, fee_hint_explicit | flags: overpayment
    - alloc charge #109 "tuition" 39,975,000 MNT
  - → Bayarjavkhlan Uuganbayar | signals: memo_grade_class, memo_name_full, fee_hint_explicit | flags: overpayment
    - alloc charge #399 "tuition" 39,975,000 MNT

### Row 106 — 0 MNT
- Memo: `Сургалтын төлбөр буцаалт Ө.Нандинмишээл, Ө.Нандингэгээ (ГОЛОМТ БАНК НАРМАНДАХ ГАНБААТАР)`
- Sender: MN290015001205318365 (НАРМАНДАХ ГАНБААТАР)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 107 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 108 — 0 MNT
- Memo: `Сургалтын төлбөр буцаалт Зоригоо Сүлд (ХААН БАНК ЭРДЭНЭБИЛЭГ ӨЛЗИЙСАЙХАН)`
- Sender: MN400005005033132182 (ЭРДЭНЭБИЛЭГ ӨЛЗИЙСАЙХАН)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 109 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 110 — 0 MNT
- Memo: `Сургалтын төлбөр буцаалт Алтангэрэл Дөлгөөнболд`
- Sender: MN690034102200133073 (БОЛОР БАЛГАН)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 111 — 0 MNT
- Memo: `ДОТООД Б/БУС ШИЛЖҮҮЛЭГ ШИМТГЭЛ-EBANK:[100.00MNT] /431209`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 112 — 0 MNT
- Memo: `Сургалтын төлбөр буцаалт Одбаяр Мишээл (ХААН БАНК ЭНХЧУЛУУН СЭЛЭНГЭ)`
- Sender: MN350005005059255536 (ЭНХЧУЛУУН СЭЛЭНГЭ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 113 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 114 — 1,975,000 MNT
- Memo: `EB -IGCSE HURI 10A (ХУДАЛДАА ХӨГЖЛИЙН БАНК RISU NA)`
- Sender: MN450004000457176833 (RISU NA)
- Tier: **attention** (unmatched)
- Status: **unmatched** (no_candidates)

### Row 115 — 400,000 MNT
- Memo: `BAYANMUNKHIIN MUNKHZAYA 3? (ХААН БАНК БААТАР БАЯНМӨНХ)`
- Sender: MN460005005075803732 (БААТАР БАЯНМӨНХ)
- Tier: **attention** (low_confidence)
- Status: **low_confidence** (5 proposal(s))
  - → Munkhjin Bayanmunkh | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Anir-Erdene Munkhzaya | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Ariun-Erdene Munkhzaya | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Temuugei Munkhzaya | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Enkhtulga Bayanmunkh | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)

### Row 116 — 1,000,000 MNT
- Memo: `EB -Ариунгоо Бодьхүү 1мл (ХУДАЛДАА ХӨГЖЛИЙН БАНК БОДЬХҮҮ ЗОРИГТ)`
- Sender: MN720004000419037014 (БОДЬХҮҮ ЗОРИГТ)
- Tier: **confident** (confident)
- Status: **matched** (3 proposal(s))
  - → Ariungoo Bodikhuu | signals: memo_grade_class, memo_name_partial, memo_name_fuzzy, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1178 "tuition" 1,000,000 MNT
  - → Ariungoo Erdenekhuu | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1145 "tuition" 1,000,000 MNT
  - → Ariungoo Ariunbold | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1208 "tuition" 1,000,000 MNT

### Row 117 — 210,000 MNT
- Memo: `UNDRAH 8A VOLLEBALL SURGALT (ХААН БАНК САНДАГДОРЖ ЭНХБААТАР)`
- Sender: MN960005005720676971 (САНДАГДОРЖ ЭНХБААТАР)
- Tier: **confident** (confident)
- Status: **matched** (4 proposal(s))
  - → Undrakh Enkhbaatar | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #64 "tuition" 210,000 MNT
  - → Undrakh Davaasambuu | signals: memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #85 "tuition" 210,000 MNT
  - → Undrakh Batbaatar | signals: memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #984 "tuition" 210,000 MNT
  - → Oyu-Undrakh Mandakh | signals: memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1173 "tuition" 210,000 MNT

### Row 118 — 3,000,000 MNT
- Memo: `AMUU MYAGMARULZII 3? TERM FEE (ХААН БАНК БОР АМАРЖАРГАЛ)`
- Sender: MN910005005300991720 (БОР АМАРЖАРГАЛ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Amuu Myagmar-Ulzii | signals: memo_grade_wildcard, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1138 "tuition" 3,000,000 MNT

### Row 119 — 0 MNT
- Memo: `Сургалтын төлбөр буцаалт Мөнхцолмон Мэнд-Орших (ХААН БАНК БАТСАЙХАН МӨНХЦОЛМОН)`
- Sender: MN930005005220036745 (БАТСАЙХАН МӨНХЦОЛМОН)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 120 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 121 — 0 MNT
- Memo: `Ном хэвлэлтийн төлбөрт (ГОЛОМТ БАНК МӨНХ ПАБЛИШИНГ)`
- Sender: MN690015001405168976 (МӨНХ ПАБЛИШИНГ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 122 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 123 — 400,000 MNT
- Memo: `БАТБЭХ АНХИЛ-ҮЖИН 4 НАС АНГИ (ХААН БАНК БАДАМСҮРЭН ХУЛАН)`
- Sender: MN590005005111189777 (БАДАМСҮРЭН ХУЛАН)
- Tier: **attention** (missing_charge)
- Status: **matched** (3 proposal(s))
  - → Ankhil Ider | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Chig-Ujin Munkhzul | signals: memo_grade_level, memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Enkh-Ujin Batsukh | signals: memo_grade_level, memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)

### Row 124 — 750,000 MNT
- Memo: `BUS FEE, BAT-ERDENE 8B, ANAR 6E (ХААН БАНК ХҮРЭЛБААТАР ДОРЖ)`
- Sender: MN620005005026442569 (ХҮРЭЛБААТАР ДОРЖ)
- Tier: **attention** (multi_student)
- Status: **matched_multi** (total 750,000 MNT)
  - → Bat-Erdene Dorj
    - alloc charge #-1 "?" 375,000 MNT
  - → Anar Dorj
    - alloc charge #-1 "?" 375,000 MNT

### Row 125 — 690,000 MNT
- Memo: `1JB ВҮ ЭНЭРЭЛ HOMEWORK (ХААН БАНК SHI MALETE)`
- Sender: MN380005005307258583 (SHI MALETE)
- Tier: **attention** (unmatched)
- Status: **unmatched** (no_candidates)

### Row 126 — 255,000 MNT
- Memo: `Chamin-Erdene 5KO`
- Sender: MN180034102100083632 (АЛТАНЗУЛ ХИШГЭЭ)
- Tier: **confident** (confident)
- Status: **matched** (3 proposal(s))
  - → Chamin-Erdene Chinzorig | signals: memo_grade_class, memo_name_partial
    - alloc charge #1636 "Art KS2 /Term 4/" 255,000 MNT
  - → Hovor-Erdene Dorjbat | signals: memo_grade_class, memo_name_partial | flags: manual_review
    - (no allocation)
  - → Khash-Erdene Erdenebayar | signals: memo_grade_class, memo_name_partial | flags: manual_review
    - (no allocation)

### Row 127 — 324,000 MNT
- Memo: `Eric, Manduun math`
- Sender: MN050034108801109064 (ТАМИР БОЛДБААТАР)
- Tier: **attention** (low_confidence)
- Status: **low_confidence** (1 proposal(s))
  - → Manduukh Sanaa | signals: memo_name_fuzzy, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 128 — 285,000 MNT
- Memo: `EB -ANONA Tsolmon, 1JA, Ballet (ХУДАЛДАА ХӨГЖЛИЙН БАНК ХУЛАН ДАВААДОРЖ)`
- Sender: MN880004000470036416 (ХУЛАН ДАВААДОРЖ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Anona Tsolmon | signals: memo_grade_class, memo_name_full, fee_hint_explicit
    - alloc charge #1664 "Ballet Mon, Wed Term 4" 285,000 MNT

### Row 129 — 255,000 MNT
- Memo: `KHARAEVA ANGIRA, 7D, VOLLEYBALL (ХААН БАНК KHARAEV ANGRA)`
- Sender: MN390005005035908437 (KHARAEV ANGRA)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Angira Kharaeva | signals: memo_grade_class, memo_name_full, fee_hint_explicit
    - alloc charge #1599 "Volleyball 11 am to 1pm Term 4" 255,000 MNT

### Row 130 — 400,000 MNT
- Memo: `EB -ANONA Tsolmon, 1JA, Taekwondo (ХУДАЛДАА ХӨГЖЛИЙН БАНК ХУЛАН ДАВААДОРЖ)`
- Sender: MN880004000470036416 (ХУЛАН ДАВААДОРЖ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Anona Tsolmon | signals: memo_grade_class, memo_name_full, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #1663 "Taekwondo Term 4 /Grade 1-5/" 400,000 MNT

### Row 131 — 12,100,000 MNT
- Memo: `СУРГАЛТЫН ТӨЛБӨР. 7А ГАНСҮХИЙН ЭРДЭНЭ (ХААН БАНК АЛТАНХҮҮ АМГАЛАН)`
- Sender: MN980005005009355856 (АЛТАНХҮҮ АМГАЛАН)
- Tier: **confident** (confident)
- Status: **matched** (5 proposal(s))
  - → Erdene Gansukh | signals: memo_grade_class, memo_name_full, fee_hint_explicit | flags: partial_payment
    - alloc charge #788 "tuition" 12,100,000 MNT
  - → Amirlan Munkh-Erdene | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #404 "tuition" 12,100,000 MNT
  - → Temuge Molor-Erdene | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #412 "tuition" 12,100,000 MNT
  - → Bilguun Gansukh | signals: memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #814 "tuition" 12,100,000 MNT
  - → Enkhsuld Gansukh | signals: memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1037 "tuition" 12,100,000 MNT

### Row 132 — 690,000 MNT
- Memo: `BAYANMUNKH MUNKHBAYASGALAN.1JA.HOMEWORK (ХААН БАНК БААТАР БАЯНМӨНХ)`
- Sender: MN460005005075803732 (БААТАР БАЯНМӨНХ)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Munkhbayasgalan Bayanmunkh | signals: memo_grade_class, memo_name_full, fee_hint_explicit | flags: overpayment
    - alloc charge #1614 "HW GR1 Term 4" 690,000 MNT

### Row 133 — 4,500,000 MNT
- Memo: `Мөнгөнбаатарын Тэмүүлэн`
- Sender: MN420034102200236185 (МӨНГӨНБААТАР ТУЯАБААТАР)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Temuulen Mungunbaatar | signals: memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #946 "tuition" 4,500,000 MNT

### Row 134 — 4,000,000 MNT
- Memo: `GOOSAR UNURBAT PRESCHOOL 5?B (ХААН БАНК ТӨМӨРТОГОО НАРМАНДАХ)`
- Sender: MN320005005401113854 (ТӨМӨРТОГОО НАРМАНДАХ)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (3 proposal(s))
  - → Erkhembileg Unurbat | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #569 "tuition" 4,000,000 MNT
  - → Goosar Unubat | signals: memo_grade_wildcard, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #878 "tuition" 4,000,000 MNT
  - → Goosar Ganbaatar | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #371 "tuition" 4,000,000 MNT

### Row 135 — 600,000 MNT
- Memo: `3SE,БОДЬДАРЬ,4-Р УЛИРЛЫН БАЛЕТ БҮРТГЭЛ (ГОЛОМТ БАНК LUOJIE JIAXIANG)`
- Sender: MN240015001175109842 (LUOJIE JIAXIANG)
- Tier: **attention** (unmatched)
- Status: **unmatched** (no_candidates)

### Row 136 — 360,000 MNT
- Memo: `Solongo Enkhbaatar, 11A, Math club`
- Sender: MN480034340601737757 (ХОНГОРЗУЛ ЖАНЦАН)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Solongo Enkhbaatar | signals: memo_grade_class, memo_name_full, fee_hint_explicit | flags: overpayment
    - alloc charge #1427 "Math's club /Jamsran/ Term 4 Mon, Wed" 360,000 MNT

### Row 137 — 120,000 MNT
- Memo: `#5754, ISU - UBAC PLAY-OFFS FINAL 8 GAMES (ГОЛОМТ БАНК УЛААНБААТАР ДАХЬ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ ХОЛБОО НҮТББ)`
- Sender: MN750015008115103613 (УЛААНБААТАР ДАХЬ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ ХОЛБОО НҮТББ)
- Tier: **attention** (not_student)
- Status: **unmatched** (not_student)

### Row 138 — 15,000,000 MNT
- Memo: `MUNGUNBAATAR TEMUULEN, 2OB (ХААН БАНК БАЯРАА ОЮУНТУЯА)`
- Sender: MN220005005306822565 (БАЯРАА ОЮУНТУЯА)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Temuulen Mungunbaatar | signals: memo_grade_class, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #946 "tuition" 15,000,000 MNT

### Row 139 — 120,000 MNT
- Memo: `EB -Монтэ Роза Кибер (ХУДАЛДАА ХӨГЖЛИЙН БАНК МОНТЭ РОЗА КИБЕР ХХК)`
- Sender: MN620004000451145843 (МОНТЭ РОЗА КИБЕР ХХК)
- Tier: **attention** (unmatched)
- Status: **unmatched** (no_candidates)

### Row 140 — 300,000 MNT
- Memo: `B.TEMUULEN 4MK (BASKETBALL-4 ULIRAL) 99090605 (ХААН БАНК АДЪЯАБАЗАР УРАНГОО)`
- Sender: MN020005005039067908 (АДЪЯАБАЗАР УРАНГОО)
- Tier: **confident** (confident)
- Status: **matched** (2 proposal(s))
  - → Temuulen Bayarsaikhan | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit
    - alloc charge #1516 "Basketball 3-5 /Term 4/" 300,000 MNT
  - → Temuulen Batzorig | signals: memo_name_initial, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 141 — 360,000 MNT
- Memo: `EB -7D Meng Tsu Taivanbat, Math club tue, thu Joel teacher (ХУДАЛДАА ХӨГЖЛИЙН БАНК БАЯРМАА БАТБАЯР)`
- Sender: MN560004000470001490 (БАЯРМАА БАТБАЯР)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Taivanbat Meng-Tsu | signals: memo_grade_class, memo_name_full, fee_hint_explicit
    - alloc charge #1609 "Math's club /Joel/ Term 4 Tue, Thu" 360,000 MNT

### Row 142 — 617,500 MNT
- Memo: `EB -3CL Bishrel Bayasgalan, soft tennis (ХУДАЛДАА ХӨГЖЛИЙН БАНК НОМИН БАТБААТАР)`
- Sender: MN940004000499430315 (НОМИН БАТБААТАР)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Bishrel Bayasgalan | signals: memo_grade_class, memo_name_full, fee_hint_explicit
    - alloc charge #1499 "Tennis Mon, Wed Term 4" 617,500 MNT

### Row 143 — 690,000 MNT
- Memo: `EB -Тараа Ай-Шуруу, 1JA, гэрийн даалгаварын анги (ХУДАЛДАА ХӨГЖЛИЙН БАНК БАЯРЖАРГАЛ ЖАДАМБА)`
- Sender: MN420004000426121755 (БАЯРЖАРГАЛ ЖАДАМБА)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Ai-Shuruu Taraa | signals: memo_grade_class, memo_name_full, fee_hint_explicit | flags: overpayment
    - alloc charge #1653 "HW GR1 Term 4" 690,000 MNT

### Row 144 — 300,000 MNT
- Memo: `EB -Тараа Ай-Шуруу, 1JA, Уран зураг (ХУДАЛДАА ХӨГЖЛИЙН БАНК БАЯРЖАРГАЛ ЖАДАМБА)`
- Sender: MN420004000426121755 (БАЯРЖАРГАЛ ЖАДАМБА)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Ai-Shuruu Taraa | signals: memo_grade_class, memo_name_full, fee_hint_explicit
    - alloc charge #1652 "Art KS1 /Term 4/" 300,000 MNT

### Row 145 — 400,000 MNT
- Memo: `A NUOJIN(M.ANUJIN) 1JB, TAEKWONDO (ХААН БАНК CHAOGE MANDUHU)`
- Sender: MN770005005107139800 (CHAOGE MANDUHU)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (5 proposal(s))
  - → Anuojin/Anujin - | signals: memo_grade_class, memo_name_fuzzy, fee_hint_explicit, fee_hint_from_amount | flags: multiple_valid_combos
    - alloc charge #1759 "registration" 400,000 MNT
  - → Anu-Ujin Mungunkhulug | signals: memo_name_fuzzy, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #1935 "registration" 400,000 MNT
  - → Anujin Tamir | signals: memo_name_fuzzy, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Anujin Bum-Erdene | signals: memo_name_fuzzy, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Enuujin Chintulga | signals: memo_name_fuzzy, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)

### Row 146 — 4,900,000 MNT
- Memo: `TSETSENGOO TELMEN 4BA (ХААН БАНК ГАНСҮХ ТЭЛМЭН)`
- Sender: MN380005005076304299 (ГАНСҮХ ТЭЛМЭН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Tsetsengoo Telmen | signals: memo_grade_class, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #510 "tuition" 4,900,000 MNT

### Row 147 — 4,900,000 MNT
- Memo: `TSETSENGOO TELMEN 4BA (ХААН БАНК ГАНСҮХ ТЭЛМЭН)`
- Sender: MN380005005076304299 (ГАНСҮХ ТЭЛМЭН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Tsetsengoo Telmen | signals: memo_grade_class, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #510 "tuition" 4,900,000 MNT

### Row 148 — 4,900,000 MNT
- Memo: `TSETSENGOO TELMEN 4BA (ХААН БАНК ГАНСҮХ ТЭЛМЭН)`
- Sender: MN380005005076304299 (ГАНСҮХ ТЭЛМЭН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Tsetsengoo Telmen | signals: memo_grade_class, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #510 "tuition" 4,900,000 MNT

### Row 149 — 4,800,000 MNT
- Memo: `TSETSENGOO TELMEN 4BA (ХААН БАНК ГАНСҮХ ТЭЛМЭН)`
- Sender: MN380005005076304299 (ГАНСҮХ ТЭЛМЭН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Tsetsengoo Telmen | signals: memo_grade_class, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #510 "tuition" 4,800,000 MNT

### Row 150 — 4,900,000 MNT
- Memo: `OYUNGOO TELMEN 2AB (ХААН БАНК ГАНСҮХ ТЭЛМЭН)`
- Sender: MN380005005076304299 (ГАНСҮХ ТЭЛМЭН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Oyungoo Telmen | signals: memo_grade_class, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #486 "tuition" 4,900,000 MNT

### Row 151 — 4,900,000 MNT
- Memo: `OYUNGOO TELMEN 2AB (ХААН БАНК ГАНСҮХ ТЭЛМЭН)`
- Sender: MN380005005076304299 (ГАНСҮХ ТЭЛМЭН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Oyungoo Telmen | signals: memo_grade_class, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #486 "tuition" 4,900,000 MNT

### Row 152 — 4,900,000 MNT
- Memo: `OYUNGOO TELMEN 2AB (ХААН БАНК ГАНСҮХ ТЭЛМЭН)`
- Sender: MN380005005076304299 (ГАНСҮХ ТЭЛМЭН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Oyungoo Telmen | signals: memo_grade_class, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #486 "tuition" 4,900,000 MNT

### Row 153 — 4,800,000 MNT
- Memo: `OYUNGOO TELMEN 2AB (ХААН БАНК ГАНСҮХ ТЭЛМЭН)`
- Sender: MN380005005076304299 (ГАНСҮХ ТЭЛМЭН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Oyungoo Telmen | signals: memo_grade_class, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #486 "tuition" 4,800,000 MNT

### Row 154 — 690,000 MNT
- Memo: `OYU MUNKHERDENE, 2AB, HOMEWORK CLUB (ХААН БАНК ЦОГТБАЯР МӨНХ-ЭРДЭНЭ)`
- Sender: MN840005005064779483 (ЦОГТБАЯР МӨНХ-ЭРДЭНЭ)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (2 proposal(s))
  - → Oyu Munkh-Erdene | signals: memo_grade_class, memo_name_full, fee_hint_explicit | flags: overpayment
    - alloc charge #1619 "HW GR 2 Term 4" 690,000 MNT
  - → Munkh-Erdene Tuvshintur | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: overpayment
    - alloc charge #1554 "HW GR 2 Term 4" 690,000 MNT

### Row 155 — 210,000 MNT
- Memo: `VOLLEYBALL SONDOR.E 8E (ГОЛОМТ БАНК ЭРХЭМБАЯР ДАВААСҮРЭН)`
- Sender: MN460015003455180776 (ЭРХЭМБАЯР ДАВААСҮРЭН)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (2 proposal(s))
  - → Sondor Sain-Od | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Sondor Erkhembayar | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 156 — 300,000 MNT
- Memo: `4MK KHANGAI SAGSAN BUMBUG (ХААН БАНК БАДАМСҮРЭН БАЯРМАА)`
- Sender: MN880005005176542811 (БАДАМСҮРЭН БАЯРМАА)
- Tier: **confident** (confident)
- Status: **matched** (3 proposal(s))
  - → Khangai lkhagvasuren | signals: memo_grade_class, memo_name_partial, fee_hint_explicit
    - alloc charge #1508 "Basketball 3-5 /Term 4/" 300,000 MNT
  - → Yesuijin Khangai | signals: memo_name_partial, fee_hint_explicit
    - alloc charge #1470 "Football GR 3-5 /Term 4/" 300,000 MNT
  - → Khangai Altanshagai | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 157 — 300,000 MNT
- Memo: `4MK KHANGAI HUL BUMBUG (ХААН БАНК БАДАМСҮРЭН БАЯРМАА)`
- Sender: MN830005005062045750 (БАДАМСҮРЭН БАЯРМАА)
- Tier: **confident** (confident)
- Status: **matched** (3 proposal(s))
  - → Khangai lkhagvasuren | signals: memo_grade_class, memo_name_partial, fee_hint_explicit
    - alloc charge #1509 "Football GR 3-5 /Term 4/" 300,000 MNT
  - → Yesuijin Khangai | signals: memo_name_partial, fee_hint_explicit
    - alloc charge #1470 "Football GR 3-5 /Term 4/" 300,000 MNT
  - → Khangai Altanshagai | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 158 — 255,000 MNT
- Memo: `EB -Tsengel TSELMUUN 6C Gar bumbug (ХУДАЛДАА ХӨГЖЛИЙН БАНК ЦЭНГЭЛ ЭНХЦАГ)`
- Sender: MN800004000421035555 (ЦЭНГЭЛ ЭНХЦАГ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Tselmuun Tsengel | signals: memo_grade_class, memo_name_full, fee_hint_explicit
    - alloc charge #1639 "Volleyball 11 am to 1pm Term 4" 255,000 MNT

### Row 159 — 255,000 MNT
- Memo: `GWONEUNSEO,4MK,ART (ХААН БАНК AN YOUNG MI)`
- Sender: MN780005005219084669 (AN YOUNG MI)
- Tier: **attention** (unmatched)
- Status: **unmatched** (no_candidates)

### Row 160 — 120,000 MNT
- Memo: `TENUUN-OD LKHAGVASUREN 1ML ART (ХААН БАНК БАДРАХ БҮРЭНЗАЯА)`
- Sender: MN100005005003718636 (БАДРАХ БҮРЭНЗАЯА)
- Tier: **confident** (confident)
- Status: **matched** (2 proposal(s))
  - → Tenuun-Od Lkhagvasuren | signals: memo_grade_class, memo_name_full, fee_hint_explicit | flags: partial_payment
    - alloc charge #1688 "Art KS2 /Term 4/" 120,000 MNT
  - → Enkhdolgor Lkhagvasuren | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1685 "Art KS1 /Term 4/" 120,000 MNT

### Row 161 — 255,000 MNT
- Memo: `БАТБАЯРЫН МАНДУХАЙ 8D VOLLEYBALL (ХААН БАНК АЛТАНХУЯГ ЗУЛГЭРЭЛ)`
- Sender: MN130005005003624395 (АЛТАНХУЯГ ЗУЛГЭРЭЛ)
- Tier: **confident** (confident)
- Status: **matched** (2 proposal(s))
  - → Mandukhai Batbayar | signals: memo_grade_class, memo_name_full, fee_hint_explicit
    - alloc charge #1592 "Volleyball 1-3pm Term 4" 255,000 MNT
  - → Mandukhai Altanbumba | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 162 — 2,000,000 MNT
- Memo: `5? DAGVA UNUMUNKH 3-R ULIRAL TULBUR (ХААН БАНК НЭРГҮЙ МӨНХТУЯА)`
- Sender: MN970005005037689671 (НЭРГҮЙ МӨНХТУЯА)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Unumunkh Dagva | signals: memo_grade_wildcard, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #879 "tuition" 2,000,000 MNT

### Row 163 — 400,000 MNT
- Memo: `SETSENGUN.LKH 2AB TAEKWONDO (ГОЛОМТ БАНК НАРАНТУЯА ОЧИРХҮҮ)`
- Sender: MN310015002735100382 (НАРАНТУЯА ОЧИРХҮҮ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Setsengun Lkhagva-Ochir | signals: memo_grade_class, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #1624 "Taekwondo Term 4 /Grade 1-5/" 400,000 MNT

### Row 164 — 300,000 MNT
- Memo: `FOOTBALL CLUB’S FEE 5TA KH.MERGEN (ХААН БАНК ДОРЖНАМЖАА МОЖУЛ)`
- Sender: MN520005005076261561 (ДОРЖНАМЖАА МОЖУЛ)
- Tier: **confident** (confident)
- Status: **matched** (5 proposal(s))
  - → Mergen Khashbold | signals: memo_grade_class, memo_name_partial, fee_hint_explicit
    - alloc charge #1582 "Football GR 3-5 /Term 4/" 300,000 MNT
  - → Mergen Saruul | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Julian Enguun Mergen | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Mergen Luvsansambuu | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Jonathan Ermuun Mergen | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 165 — 375,000 MNT
- Memo: `EB -B.Margad 11B bus fee term3 (ХУДАЛДАА ХӨГЖЛИЙН БАНК ГАНБОЛОР ГҮРРАГЧАА)`
- Sender: MN270004000410041947 (ГАНБОЛОР ГҮРРАГЧАА)
- Tier: **attention** (missing_charge)
- Status: **matched** (5 proposal(s))
  - → Margad Bayarsaikhan | signals: memo_grade_class, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Margad Batgerel | signals: memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Margad Anar | signals: memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Margad Batzaya | signals: memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Margad Ganzorig | signals: memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 166 — 600,000 MNT
- Memo: `ENYA.BAO/3SE/BALLET (ГОЛОМТ БАНК XIAOMIN LIAN)`
- Sender: MN400015002725105243 (XIAOMIN LIAN)
- Tier: **confident** (confident)
- Status: **matched** (5 proposal(s))
  - → En Ya Bao | signals: memo_grade_class, memo_name_partial, fee_hint_explicit
    - alloc charge #1478 "Ballet Tue, Thu Term 4" 600,000 MNT
  - → En Qi Bao | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → En Yu Bao | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → BAO HAIRI - | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Mingen Bao | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 167 — 1,000,000 MNT
- Memo: `2OB ANGI DAGVA AMIRLAN TULBUR 99066699 (ХААН БАНК НЭРГҮЙ МӨНХТУЯА)`
- Sender: MN970005005037689671 (НЭРГҮЙ МӨНХТУЯА)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Amirlan Dagva | signals: memo_grade_class, memo_grade_level, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #636 "tuition" 1,000,000 MNT

### Row 168 — 400,000 MNT
- Memo: `EB -M.Oyu-Undrakh 1JB taewkonda (ХУДАЛДАА ХӨГЖЛИЙН БАНК САРУУЛТУЯА ОЮУНСАЙХАН)`
- Sender: MN710004000495057969 (САРУУЛТУЯА ОЮУНСАЙХАН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Oyu-Undrakh Mandakh | signals: memo_grade_class, memo_name_partial, fee_hint_from_amount
    - alloc charge #1770 "registration" 400,000 MNT

### Row 169 — 400,000 MNT
- Memo: `LEE MINWOO KAAN 1ML TAEKWONDO (ХААН БАНК ЭНХЖАРГАЛ ИТГЭЛ)`
- Sender: MN030005005166377868 (ЭНХЖАРГАЛ ИТГЭЛ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Kaan Lee Minwoo | signals: memo_grade_class, memo_name_full, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #1785 "registration" 400,000 MNT

### Row 170 — 255,000 MNT
- Memo: `7A TUGSBILEG VOLLEYBALL (ХААН БАНК ЭНХТАЙВАН ШИЖИРТУЯА)`
- Sender: MN740005005622178038 (ЭНХТАЙВАН ШИЖИРТУЯА)
- Tier: **confident** (confident)
- Status: **matched** (3 proposal(s))
  - → Tugsbileg Yerenbaatar | signals: memo_grade_class, memo_name_partial, fee_hint_explicit
    - alloc charge #1640 "Volleyball 11 am to 1pm Term 4" 255,000 MNT
  - → Tugsbileg Purevdalai | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Tugsbileg Bayarnemekh | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 171 — 255,000 MNT
- Memo: `3LM KHANBILEG ART CLUB (ХААН БАНК ЭНХТАЙВАН ШИЖИРТУЯА)`
- Sender: MN740005005622178038 (ЭНХТАЙВАН ШИЖИРТУЯА)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Khanbileg Yerenbaatar | signals: memo_grade_class, memo_name_partial, fee_hint_explicit
    - alloc charge #1569 "Art KS2 /Term 4/" 255,000 MNT

### Row 172 — 750,000 MNT
- Memo: `З.ОЮУДАРЬ 11A З.НОМИНДАРЬ 8D (ХААН БАНК БАЯРСАЙХАН УУГАНЦЭЦЭГ)`
- Sender: MN670005005070330905 (БАЯРСАЙХАН УУГАНЦЭЦЭГ)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (2 proposal(s))
  - → Nomindari Zolbayar | signals: memo_grade_class, memo_name_fuzzy | flags: manual_review
    - (no allocation)
  - → Oyudari Zolbayar | signals: memo_grade_class, memo_name_fuzzy | flags: manual_review
    - (no allocation)

### Row 173 — 690,000 MNT
- Memo: `EB -unumunkh geriin daalgavariim angi 3VO (ХУДАЛДАА ХӨГЖЛИЙН БАНК ЭНХБАТ БАТБАЯР)`
- Sender: MN090004000411034872 (ЭНХБАТ БАТБАЯР)
- Tier: **attention** (unbalanced)
- Status: **matched** (2 proposal(s))
  - → Unumunkh Enkhbat | signals: memo_grade_class, memo_name_partial | flags: manual_review
    - (no allocation)
  - → Unumunkh Dagva | signals: memo_name_partial | flags: manual_review
    - (no allocation)

### Row 174 — 10,960,000 MNT
- Memo: `EB -No. 325, tution fee iro chitrakshi gautam (ХУДАЛДАА ХӨГЖЛИЙН БАНК EMBASSY OF INDIA)`
- Sender: MN320004000404001085 (EMBASSY OF INDIA)
- Tier: **attention** (unbalanced)
- Status: **matched** (1 proposal(s))
  - → Chitrakshi Gautam | signals: memo_name_full | flags: no_open_charges
    - (no allocation)

### Row 175 — 315,000 MNT
- Memo: `1JB Н.АРЛУНГОО HOMEWORK CLUB 83110069 (ХААН БАНК СҮХБААТАР НЯМЦЭРЭН)`
- Sender: MN970005005163048882 (СҮХБААТАР НЯМЦЭРЭН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Arlungoo Nyamtseren | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1672 "HW GR1 Term 4" 315,000 MNT

### Row 176 — 0 MNT
- Memo: `1 хаалгатай шүүгээ авахад (ГОЛОМТ БАНК ҮРЖИХ ТЭНГИС ХХК)`
- Sender: MN120015002145100261 (ҮРЖИХ ТЭНГИС ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 177 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 178 — 0 MNT
- Memo: `1260203595599  9097392  И Эс Эм олон улсын дунд сургууль 99081655 MN940034106000030702 И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ БСБ`
- Sender: MN120034106000063994 (МТА.ТАТВАР)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 179 — 0 MNT
- Memo: `ТАТВАР ТӨЛӨЛТ 300 /IBANK/:[300.00MNT] /430206`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 180 — 0 MNT
- Memo: `qpay 200000696787103 P260309100111 online 9097392 (ХУДАЛДАА ХӨГЖЛИЙН БАНК ТАТВАР QPAY)`
- Sender: MN320004000495089517 (ТАТВАР QPAY)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 181 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 182 — 2,150,000 MNT
- Memo: `S.ANUJIN,5B ANGI 99706387 (ХААН БАНК ЛУВСАН-ОЧИР САРАНЦЭЦЭГ)`
- Sender: MN810005005062044428 (ЛУВСАН-ОЧИР САРАНЦЭЦЭГ)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Anujin Sarantsetseg | signals: memo_name_initial, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1321 "tuition" 2,150,000 MNT

### Row 183 — 0 MNT
- Memo: `qpay 200000696788422 P260309100137 online 9097392 (ХУДАЛДАА ХӨГЖЛИЙН БАНК ТАТВАР QPAY)`
- Sender: MN320004000495089517 (ТАТВАР QPAY)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 184 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 185 — 0 MNT
- Memo: `1260205696130  9097392  И Эс Эм олон улсын дунд сургууль 99081655 MN940034106000030702 И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ БСБ`
- Sender: MN120034106000063994 (МТА.ТАТВАР)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 186 — 0 MNT
- Memo: `ТАТВАР ТӨЛӨЛТ 300 /IBANK/:[300.00MNT] /430206`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 187 — 0 MNT
- Memo: `qpay 682172653299970 ID:7020070; (ТӨРИЙН САН ТӨРИЙН ҮЙЛЧИЛГЭЭНИЙ ЦАХИМ ТӨЛБӨР)`
- Sender: MN630090010090000000 (ТӨРИЙН ҮЙЛЧИЛГЭЭНИЙ ЦАХИМ ТӨЛБӨР)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 188 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 189 — 0 MNT
- Memo: `qpay 865273116239971 15200320`
- Sender: MN470034343100209164 (ККТТ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 190 — 0 MNT
- Memo: `qpay 917953098165664, AJ2603101520062 АЖД гэрээний төлбөр, CHARGE: 1240.20 ₮`
- Sender: MN100034104400639081 (МӨНХ ДААТГАЛ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 191 — 0 MNT
- Memo: `qpay 849859819438297 MUNKHDAATGAL 124020 TRX: 1240.20 ₮`
- Sender: MN470034343100209164 (ККТТ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 192 — 0 MNT
- Memo: `1260116401240  9097392 Т2400003808 И Эс Эм олон улсын дунд сургууль 99081655 MN940034106000030702 И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ БСБ`
- Sender: MN120034106000063994 (МТА.ТАТВАР)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 193 — 0 MNT
- Memo: `ТАТВАР ТӨЛӨЛТ 300 /IBANK/:[300.00MNT] /430206`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 194 — 360,000 MNT
- Memo: `6D-AnDai-Math&#39;s club (КАПИТРОН БАНК YING XIU)`
- Sender: MN460030008000001827 (YING XIU)
- Tier: **attention** (unmatched)
- Status: **unmatched** (no_candidates)

### Row 195 — 0 MNT
- Memo: `qpay 582121097584345, AJ2603101520063 АЖД гэрээний төлбөр, CHARGE: 1283.04 ₮`
- Sender: MN100034104400639081 (МӨНХ ДААТГАЛ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 196 — 0 MNT
- Memo: `qpay 762674967247100 MUNKHDAATGAL 128304 TRX: 1283.04 ₮`
- Sender: MN470034343100209164 (ККТТ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 197 — 0 MNT
- Memo: `Данс хоорондын гүйлгээ (ГОЛОМТ БАНК И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ ХХК)`
- Sender: MN320015001205100740 (И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 198 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 199 — 300,000 MNT
- Memo: `EB -Altansukh munkhmandakh,4rr,football (ХУДАЛДАА ХӨГЖЛИЙН БАНК САРАНГУА БАТДОРЖ)`
- Sender: MN460004000437011582 (САРАНГУА БАТДОРЖ)
- Tier: **attention** (unbalanced)
- Status: **matched** (1 proposal(s))
  - → Munkhmandakh Altansukh | signals: memo_grade_class, memo_name_full, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 200 — 800,000 MNT
- Memo: `S Saran S Tushig admission fee`
- Sender: MN400034102300024195 (СЭРГЭЛЭН ЦЭДЭНДАМБА)
- Tier: **attention** (unbalanced)
- Status: **matched** (5 proposal(s))
  - → Saran Mariya Erdenetuul | signals: memo_name_partial | flags: manual_review
    - (no allocation)
  - → Tushig Batsaikhan | signals: memo_name_partial | flags: manual_review
    - (no allocation)
  - → Tushig Bayarbat | signals: memo_name_partial | flags: manual_review
    - (no allocation)
  - → Tushig Ganbold | signals: memo_name_partial | flags: manual_review
    - (no allocation)
  - → Tushig Nyamjargal | signals: memo_name_partial | flags: manual_review
    - (no allocation)

### Row 201 — 400,000 MNT
- Memo: `3? АНГИ БАТБОЛД СЭЦЭН 88110576 (ХААН БАНК ЖАРГАЛСАЙХАН БАТБОЛД)`
- Sender: MN380005005167317944 (ЖАРГАЛСАЙХАН БАТБОЛД)
- Tier: **attention** (missing_charge)
- Status: **matched** (5 proposal(s))
  - → Setsen Enkh-Orshikh | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Bilguun Batbold | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Chinguun Batbold | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Odmand Batbold | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Amarbayasgalan Batbold | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)

### Row 202 — 1,625,000 MNT
- Memo: `BATBOLD SETSEN 26-27 (ХААН БАНК ЖАРГАЛСАЙХАН БАТБОЛД)`
- Sender: MN380005005167317944 (ЖАРГАЛСАЙХАН БАТБОЛД)
- Tier: **attention** (flagged)
- Status: **matched** (5 proposal(s))
  - → Setsen Enkh-Orshikh | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #322 "tuition" 1,625,000 MNT
  - → Bilguun Batbold | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #18 "tuition" 1,625,000 MNT
  - → Chinguun Batbold | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #124 "tuition" 1,625,000 MNT
  - → Odmand Batbold | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #488 "tuition" 1,625,000 MNT
  - → Amarbayasgalan Batbold | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #762 "tuition" 1,625,000 MNT

### Row 203 — 400,000 MNT
- Memo: `G.MANDAKHNAR TAEKWONDO (ГОЛОМТ БАНК ГАНТӨМӨР АЛТАНЦЭЦЭГ)`
- Sender: MN710015001175147699 (ГАНТӨМӨР АЛТАНЦЭЦЭГ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Mandakhnar Gantumur | signals: memo_name_initial, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #1555 "Taekwondo Term 4 /Grade 1-5/" 400,000 MNT

### Row 204 — 285,000 MNT
- Memo: `G.MISHEEL BALLET (ГОЛОМТ БАНК ГАНТӨМӨР АЛТАНЦЭЦЭГ)`
- Sender: MN710015001175147699 (ГАНТӨМӨР АЛТАНЦЭЦЭГ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Misheel Gantumur | signals: memo_name_initial, memo_name_partial, fee_hint_explicit
    - alloc charge #1613 "Ballet Mon, Wed Term 4" 285,000 MNT

### Row 205 — 0 MNT
- Memo: `Данс хоорондын гүйлгээ (ХУДАЛДАА ХӨГЖЛИЙН БАНК И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ)`
- Sender: MN680004000457112981 (И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 206 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 207 — 4,000,000 MNT
- Memo: `11C, L.ZOLBAYAR (ГОЛОМТ БАНК ЭНХБАЯР ПҮРЭВЖАВ)`
- Sender: MN520015001105246155 (ЭНХБАЯР ПҮРЭВЖАВ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Zolbayar luvsanjav | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #609 "tuition" 4,000,000 MNT

### Row 208 — 1,030,000 MNT
- Memo: `ДАРИНЧУЛУУН ЭМҮЖИН 10С (ХААН БАНК РАВДАН БАЯСГАЛАН)`
- Sender: MN900005005029222958 (РАВДАН БАЯСГАЛАН)
- Tier: **attention** (flagged)
- Status: **matched** (5 proposal(s))
  - → Emujin Tengis | signals: memo_grade_class, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1034 "tuition" 1,030,000 MNT
  - → Emujin Otgonbaatar | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #70 "tuition" 1,030,000 MNT
  - → Emujin Gombosuren | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #304 "tuition" 1,030,000 MNT
  - → Emujin Khurtsbileg | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #328 "tuition" 1,030,000 MNT
  - → Emujin Enkhbilguun | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #739 "tuition" 1,030,000 MNT

### Row 209 — 400,000 MNT
- Memo: `O.ERDEM/UT20291175/ BURTGELIN HURAAMJ (ХААН БАНК ДАМДИНСҮРЭН ЭНХБОЛД)`
- Sender: MN670005005006484535 (ДАМДИНСҮРЭН ЭНХБОЛД)
- Tier: **attention** (low_confidence)
- Status: **low_confidence** (1 proposal(s))
  - → Erdem Shinebayar | signals: memo_name_fuzzy, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)

### Row 210 — 750,000 MNT
- Memo: `I KHUSLEN I KHULAN AVTOBUS (ХААН БАНК ЛХАГВАСҮРЭН ТУЯА)`
- Sender: MN260005005014349063 (ЛХАГВАСҮРЭН ТУЯА)
- Tier: **attention** (low_confidence)
- Status: **low_confidence** (5 proposal(s))
  - → Khuslen Amarjargal | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Khulan Chinbat | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Khuslen Arvijikh | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Khulan Ganbat | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Khuslen Enkhtuvshin | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 211 — 375,000 MNT
- Memo: `Erdembileg.B, 3CL. Bus (ХАС БАНК ЗЭМҮҮЛХАМ БАДАРЧ)`
- Sender: MN290032005000881343 (ЗЭМҮҮЛХАМ БАДАРЧ)
- Tier: **attention** (missing_charge)
- Status: **matched** (2 proposal(s))
  - → Erdembileg Batmunkh | signals: memo_grade_class, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Erdembileg Ganbayar | signals: memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 212 — 375,000 MNT
- Memo: `Tsetsenbileg.B, 4BA. Bus (ХАС БАНК ЗЭМҮҮЛХАМ БАДАРЧ)`
- Sender: MN290032005000881343 (ЗЭМҮҮЛХАМ БАДАРЧ)
- Tier: **attention** (missing_charge)
- Status: **matched** (2 proposal(s))
  - → Tsetsenbileg Batmunkh | signals: memo_grade_class, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Tsetsenbileg Gankhuyag | signals: memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 213 — 400,000 MNT
- Memo: `TELMEN GEGEEN ?3 (ХААН БАНК ЦЭНД-ОЧИР ЦЭДЭВСҮРЭН)`
- Sender: MN070005005057357459 (ЦЭНД-ОЧИР ЦЭДЭВСҮРЭН)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (5 proposal(s))
  - → Oyungoo Telmen | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #1495 "Taekwondo Term 4 /Grade 1-5/" 400,000 MNT
  - → Tsetsengoo Telmen | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #1505 "Taekwondo Term 4 /Grade 1-5/" 400,000 MNT
  - → Telmen Altankhuyag | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #1864 "registration" 400,000 MNT
  - → Gegeen Amgalan | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)
  - → Gegeen Otgonjargal | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)

### Row 214 — 300,000 MNT
- Memo: `ENKHDOLGOR LKHAGVASUREN, 1WL, ART (ХААН БАНК БАЛДОРЖ ЛХАГВАСҮРЭН)`
- Sender: MN710005005130021141 (БАЛДОРЖ ЛХАГВАСҮРЭН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Enkhdolgor Lkhagvasuren | signals: memo_grade_level, memo_name_full, fee_hint_explicit
    - alloc charge #1685 "Art KS1 /Term 4/" 300,000 MNT

### Row 215 — 255,000 MNT
- Memo: `EB -Molor-Erdene Enkhjargal, 6E, basketball club (ХУДАЛДАА ХӨГЖЛИЙН БАНК ХАЛИУН МӨНХБАЯР)`
- Sender: MN210004000495020457 (ХАЛИУН МӨНХБАЯР)
- Tier: **confident** (confident)
- Status: **matched** (3 proposal(s))
  - → Molor-Erdene Enkhjargal | signals: memo_grade_class, memo_name_full, fee_hint_explicit
    - alloc charge #1476 "basketball GR 6-9 Term 4" 255,000 MNT
  - → Oyu-Erdene Enkhjargal | signals: memo_name_full, fee_hint_explicit
    - alloc charge #1447 "Art KS2 /Term 4/" 255,000 MNT
  - → Undral Bolor-erdene | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 216 — 255,000 MNT
- Memo: `EB -Oyu-Erdene Enkhjargal, 4MK, Art club (ХУДАЛДАА ХӨГЖЛИЙН БАНК ХАЛИУН МӨНХБАЯР)`
- Sender: MN210004000495020457 (ХАЛИУН МӨНХБАЯР)
- Tier: **confident** (confident)
- Status: **matched** (4 proposal(s))
  - → Oyu-Erdene Enkhjargal | signals: memo_grade_class, memo_name_full, fee_hint_explicit
    - alloc charge #1447 "Art KS2 /Term 4/" 255,000 MNT
  - → Molor-Erdene Enkhjargal | signals: memo_name_full, fee_hint_explicit | flags: multiple_valid_combos
    - alloc charge #1477 "football GR 6-9 Term 4" 255,000 MNT
  - → Sodon-erdene Oyun-Erdene | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Erkhsetsen Nandin-Erdene | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 217 — 400,000 MNT
- Memo: `Б. ЭЛБЭРЭЛ 3, БҮРТГЭЛИЙН ХУРААМЖ (ХААН БАНК БАТБАЯР БИЛЭГТ)`
- Sender: MN550005005077069808 (БАТБАЯР БИЛЭГТ)
- Tier: **attention** (unmatched)
- Status: **unmatched** (no_candidates)

### Row 218 — 255,000 MNT
- Memo: `KHUSLEN AMARJARGAL, 7C, VOLLEYBALL (ГОЛОМТ БАНК АМАРЖАРГАЛ РАГЧААСҮРЭН)`
- Sender: MN830015003005117182 (АМАРЖАРГАЛ РАГЧААСҮРЭН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Khuslen Amarjargal | signals: memo_grade_class, memo_name_full, fee_hint_explicit
    - alloc charge #1393 "Volleyball 11 am to 1pm Term 4" 255,000 MNT

### Row 219 — 360,000 MNT
- Memo: `KHUSLEN AMARJARGAL, 7C, MATH’S CLUB (ГОЛОМТ БАНК АМАРЖАРГАЛ РАГЧААСҮРЭН)`
- Sender: MN830015003005117182 (АМАРЖАРГАЛ РАГЧААСҮРЭН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Khuslen Amarjargal | signals: memo_grade_class, memo_name_full, fee_hint_explicit
    - alloc charge #1392 "Math's club /Oliver/ Term 4 Tue, Thu" 360,000 MNT

### Row 220 — 0 MNT
- Memo: `Summer flight allowance  (ХУДАЛДАА ХӨГЖЛИЙН БАНК CAROL LAU)`
- Sender: MN930004000457182468 (CAROL LAU)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 221 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 222 — 0 MNT
- Memo: `Түрээсийн төлбөр (ХААН БАНК ЧИМЭДДОРЖ АНУДАРЬ)`
- Sender: MN220005005007836167 (ЧИМЭДДОРЖ АНУДАРЬ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 223 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 224 — 0 MNT
- Memo: `Түрээсийн төлбөрт`
- Sender: MN850034104400058641 (ЭНХБАЯР СҮХЭЭ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 225 — 0 MNT
- Memo: `ДОТООД Б/БУС ШИЛЖҮҮЛЭГ ШИМТГЭЛ-EBANK:[100.00MNT] /431209`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 226 — 0 MNT
- Memo: `Түрээсийн төлбөрт`
- Sender: MN230034104400286640 (БОЛОРЦОМ ЦАГААНХҮҮ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 227 — 0 MNT
- Memo: `ДОТООД Б/БУС ШИЛЖҮҮЛЭГ ШИМТГЭЛ-EBANK:[100.00MNT] /431209`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 228 — 0 MNT
- Memo: `Түрээсийн төлбөр  (ХУДАЛДАА ХӨГЖЛИЙН БАНК ЭРДЭНЭЦЭЦЭГ САНДАГ)`
- Sender: MN750004000413003754 (ЭРДЭНЭЦЭЦЭГ САНДАГ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 229 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 230 — 0 MNT
- Memo: `Түрээсийн төлбөр  (ХУДАЛДАА ХӨГЖЛИЙН БАНК АЛТАНЦЭЦЭГ МӨНХЖАРГАЛ)`
- Sender: MN850004000475017614 (АЛТАНЦЭЦЭГ МӨНХЖАРГАЛ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 231 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 232 — 0 MNT
- Memo: `Түрээсийн төлбөр`
- Sender: MN230034104400286640 (БОЛОРЦОМ ЦАГААНХҮҮ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 233 — 0 MNT
- Memo: `ДОТООД Б/БУС ШИЛЖҮҮЛЭГ ШИМТГЭЛ-EBANK:[100.00MNT] /431209`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 234 — 0 MNT
- Memo: `Түрээсийн төлбөрт (ХААН БАНК СҮХБААТАР ТЭЛМҮҮН)`
- Sender: MN270005005062046855 (СҮХБААТАР ТЭЛМҮҮН)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 235 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 236 — 0 MNT
- Memo: `Түрээсийн төлбөр Daniil Ilarianal (ХААН БАНК ДАМДИНСҮРЭН АМАРЗАЯА)`
- Sender: MN870005005114116636 (ДАМДИНСҮРЭН АМАРЗАЯА)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 237 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 238 — 0 MNT
- Memo: `Түрээсийн төлбөрт (ХУДАЛДАА ХӨГЖЛИЙН БАНК УНДРАХ БААТАРЦОГТ)`
- Sender: MN690004000426096631 (УНДРАХ БААТАРЦОГТ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 239 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 240 — 375,000 MNT
- Memo: `EB -caitlyn obrien 7b bus fee (ХУДАЛДАА ХӨГЖЛИЙН БАНК JEFFREY OBRIEN)`
- Sender: MN020004000441007610 (JEFFREY OBRIEN)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Caitlyn Az Ujin O'Brien | signals: memo_grade_class, memo_name_partial, memo_name_fuzzy, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 241 — 0 MNT
- Memo: `Гишгүүр авахад (ХААН БАНК ЧУЛУУНДАВАА ДАШЛХАГВА)`
- Sender: MN750005005003506879 (ЧУЛУУНДАВАА ДАШЛХАГВА)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 242 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 243 — 0 MNT
- Memo: `Зүлэг авахад (ХААН БАНК MA BAQUAN)`
- Sender: MN200005005157080888 (MA BAQUAN)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 244 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 245 — 0 MNT
- Memo: `Нэрийн хуудас хэвлүүлэхэд (ГОЛОМТ БАНК ГАЛАКСИ ДИЗАЙН ХХК)`
- Sender: MN780015001415139541 (ГАЛАКСИ ДИЗАЙН ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 246 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 247 — 0 MNT
- Memo: `Микрофон түрээслэхэд (ГОЛОМТ БАНК ЖЕНИСИС ВИШН РЕКОРДИНГ ХХК)`
- Sender: MN490015002720001038 (ЖЕНИСИС ВИШН РЕКОРДИНГ ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 248 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 249 — 0 MNT
- Memo: `Connor тизний төлбөрт (ХУДАЛДАА ХӨГЖЛИЙН БАНК ДИ ЭЙЧ ЭЛ ГЛОБАЛ ФОРВАРДИНГ МОНГОЛ ХХК)`
- Sender: MN940004000499437590 (ДИ ЭЙЧ ЭЛ ГЛОБАЛ ФОРВАРДИНГ МОНГОЛ ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 250 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 251 — 645,000 MNT
- Memo: `MATH TEST ODMANDAKH 12B (ГОЛОМТ БАНК ЭЛИТСЕРВИС ХХК)`
- Sender: MN730015002105016435 (ЭЛИТСЕРВИС ХХК)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (2 proposal(s))
  - → Odmandakh Galsansar | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Test Test | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 252 — 0 MNT
- Memo: `00 цаас, гарын цаас авахад (ХУДАЛДАА ХӨГЖЛИЙН БАНК ХӨГЖИЛТРЕЙД ХХК)`
- Sender: MN040004000405004278 (ХӨГЖИЛТРЕЙД ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 253 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 254 — 0 MNT
- Memo: `Канон засварт  (ХААН БАНК ЮУ БИ ТИ КЭЙ)`
- Sender: MN350005005030097045 (ЮУ БИ ТИ КЭЙ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 255 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 256 — 0 MNT
- Memo: `3-р сарын цалингийн гүйлгээ`
- Sender: MN830034385300044839 (И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ БСБ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 257 — 0 MNT
- Memo: `ДОТООД Б/БУС ШИЛЖҮҮЛЭГ ШИМТГЭЛ-EBANK:[100.00MNT] /431209`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 258 — 650,000 MNT
- Memo: `EB-INDRA.E 1JK TENNIS (ХААН БАНК ЧОЙЖИЛСҮРЭН МӨНХСАРУУЛ)`
- Sender: MN730005005101030036 (ЧОЙЖИЛСҮРЭН МӨНХСАРУУЛ)
- Tier: **confident** (confident)
- Status: **matched** (4 proposal(s))
  - → Indra Enkhbaatar | signals: memo_grade_class, memo_name_partial, fee_hint_explicit
    - alloc charge #1541 "Tennis Tue, Thu Term 4" 650,000 MNT
  - → Indra Enkhtuvshin | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Indra Badral | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Indra Azjargal | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 259 — 360,000 MNT
- Memo: `EB-ENEREL.E 8B MATH-JOEL (ХААН БАНК ЧОЙЖИЛСҮРЭН МӨНХСАРУУЛ)`
- Sender: MN730005005101030036 (ЧОЙЖИЛСҮРЭН МӨНХСАРУУЛ)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (2 proposal(s))
  - → Enerel Enkhbaatar | signals: memo_grade_class, memo_name_partial, fee_hint_explicit
    - alloc charge #1379 "Math's club /Joel/ Term 4 Tue, Thu" 360,000 MNT
  - → Enerel Lkhagvasuren | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 260 — 342,000 MNT
- Memo: `ANKHILUUN 12C MATH-JAMSRAN (ХААН БАНК ЧОЙЖИЛСҮРЭН МӨНХСАРУУЛ)`
- Sender: MN730005005101030036 (ЧОЙЖИЛСҮРЭН МӨНХСАРУУЛ)
- Tier: **confident** (confident)
- Status: **matched** (5 proposal(s))
  - → Ankhiluun Enkhbaatar | signals: memo_grade_class, memo_name_partial, fee_hint_explicit
    - alloc charge #1426 "Math's club /Jamsran/ Term 4 Mon, Wed" 342,000 MNT
  - → Ankhiluun Soyol-Erdene | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Ankhiluun Jany Badarch | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Ankhiluun Gankhuu | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Ankhiluun-Erdene Oyun-Erdene | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 261 — 285,000 MNT
- Memo: `INDRA.E 1JK BALLET (ХААН БАНК ЧОЙЖИЛСҮРЭН МӨНХСАРУУЛ)`
- Sender: MN730005005101030036 (ЧОЙЖИЛСҮРЭН МӨНХСАРУУЛ)
- Tier: **confident** (confident)
- Status: **matched** (4 proposal(s))
  - → Indra Enkhbaatar | signals: memo_grade_class, memo_name_partial, fee_hint_explicit
    - alloc charge #1540 "Ballet Mon, Wed Term 4" 285,000 MNT
  - → Indra Enkhtuvshin | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Indra Badral | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Indra Azjargal | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 262 — 255,000 MNT
- Memo: `ENEREL.E 8B VOLLEYBALL 13-15 (ХААН БАНК ЧОЙЖИЛСҮРЭН МӨНХСАРУУЛ)`
- Sender: MN730005005101030036 (ЧОЙЖИЛСҮРЭН МӨНХСАРУУЛ)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (2 proposal(s))
  - → Enerel Enkhbaatar | signals: memo_grade_class, memo_name_partial, fee_hint_explicit
    - alloc charge #1380 "Volleyball 11 am to 1pm Term 4" 255,000 MNT
  - → Enerel Lkhagvasuren | signals: memo_grade_class, memo_name_partial, fee_hint_explicit
    - alloc charge #1382 "Volleyball 1-3pm Term 4" 255,000 MNT

### Row 263 — 5,000,000 MNT
- Memo: `1PB GOOGERELT (ХААН БАНК ЭНХБАТ УНДРАА)`
- Sender: MN360005005003958340 (ЭНХБАТ УНДРАА)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Googerelt Ulsbold | signals: memo_grade_class, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #683 "tuition" 5,000,000 MNT

### Row 264 — 10,000,000 MNT
- Memo: `М.БЭСҮДЭЙ 9Б ҮЛДЭГДЭЛ ТӨЛБӨР (ХААН БАНК ЦЭРЭНДОРЖ БОЛОР)`
- Sender: MN770005005312564945 (ЦЭРЭНДОРЖ БОЛОР)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Besudei Munkh-Ochir | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #844 "tuition" 10,000,000 MNT

### Row 265 — 400,000 MNT
- Memo: `ДӨЛГӨӨН ЕГҮН 1ВО ТАЕКВОНДО (ХААН БАНК ГАНТӨМӨР БАТЦЭЦЭГ)`
- Sender: MN870005005720979385 (ГАНТӨМӨР БАТЦЭЦЭГ)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Yegun Dulguun | signals: memo_grade_level, memo_name_full, fee_hint_explicit, fee_hint_from_amount | flags: multiple_valid_combos
    - alloc charge #1728 "registration" 400,000 MNT

### Row 266 — 400,000 MNT
- Memo: `EB -Хосбаярын Ананд, 1JK, Таеквондо (ХУДАЛДАА ХӨГЖЛИЙН БАНК ХОСБАЯР БААСАНДОРЖ)`
- Sender: MN340004000419017037 (ХОСБАЯР БААСАНДОРЖ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Anand Khosbayar | signals: memo_grade_class, memo_name_full, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #1657 "Taekwondo Term 4 /Grade 1-5/" 400,000 MNT

### Row 267 — 0 MNT
- Memo: `Шивэлтийн үнэ РД9097392 (ГОЛОМТ БАНК ДИ ЭЙЧ ЭЛ ГЕЙТВЭЙ ХХК)`
- Sender: MN730015001905020283 (ДИ ЭЙЧ ЭЛ ГЕЙТВЭЙ ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 268 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 269 — 0 MNT
- Memo: `12209103826I0088501/100900000504`
- Sender: MN350034106000050873 (ГЕГ.ИМПОРТЫН ГААЛИЙН АЛБАН ТАТВАР)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 270 — 0 MNT
- Memo: `12209103826I0088501/100900000505`
- Sender: MN120034106000050899 (ГЕГ.ИМПОРТЫН БАРААНЫ НӨАТ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 271 — 0 MNT
- Memo: `12209103826I0088501/100900000502`
- Sender: MN670034106000033710 (ГЕГ.ГААЛИЙН БУСАД ТАТВАР)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 272 — 0 MNT
- Memo: `12209103826I0088501/100900011003`
- Sender: MN550034106000033732 (ГААЛИЙН ЕРӨНХИЙ ГАЗАР)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 273 — 0 MNT
- Memo: `ГЯЛС БАНК ГААЛЬ ЦЭСНИЙ ХУРААМЖ /100/`
- Sender: 1060004312090006 (ГЯЛС БАНК ТӨЛБӨР ЦЭСНИЙ ХУРААМЖ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 274 — 255,000 MNT
- Memo: `EB -Anand Zorigt 8e basketball (ХУДАЛДАА ХӨГЖЛИЙН БАНК УНДАРЪЯА ТӨМӨРСҮХ)`
- Sender: MN440004000452540348 (УНДАРЪЯА ТӨМӨРСҮХ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Anand Zorigt | signals: memo_grade_class, memo_name_full, fee_hint_explicit
    - alloc charge #1659 "basketball GR 6-9 Term 4" 255,000 MNT

### Row 275 — 2,025,000 MNT
- Memo: `EB -Өлзийбаяр Баттүшиг 3 (ХУДАЛДАА ХӨГЖЛИЙН БАНК ЗОЛБОО ДАМДИНСҮРЭН)`
- Sender: MN190004000463007389 (ЗОЛБОО ДАМДИНСҮРЭН)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (5 proposal(s))
  - → Sodmagnai Ulziibayar | signals: memo_grade_level, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #493 "tuition" 2,025,000 MNT
  - → Odjargal Ulziibayar | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #831 "tuition" 2,025,000 MNT
  - → Battuvshin Battushig | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #75 "tuition" 2,025,000 MNT
  - → Battushig Shagdarsuren | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #120 "tuition" 2,025,000 MNT
  - → Battushig Bilegt | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #566 "tuition" 2,025,000 MNT

### Row 276 — 5,000,000 MNT
- Memo: `Б.ЭЛБЭРЭЛ 3 , 2026.09САРД СУРГАЛЫНТӨЛБӨР (ХААН БАНК БАТБАЯР БИЛЭГТ)`
- Sender: MN550005005077069808 (БАТБАЯР БИЛЭГТ)
- Tier: **attention** (unmatched)
- Status: **unmatched** (no_candidates)

### Row 277 — 30,000 MNT
- Memo: `SANDAGSUREN LKHAMDEGD VOLLEYBALL CLUB 3TERM (ХААН БАНК ОЮУНБААТАР ЦЭНДЗЭСЭМ)`
- Sender: MN960005005131200696 (ОЮУНБААТАР ЦЭНДЗЭСЭМ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Lkhamdegd Sandagsuren | signals: memo_name_full, fee_hint_explicit | flags: partial_payment
    - alloc charge #1388 "Volleyball 1-3pm Term 4" 30,000 MNT

### Row 278 — 285,000 MNT
- Memo: `EB -ballet 1JK Misheel Enkhtuvshin (ХУДАЛДАА ХӨГЖЛИЙН БАНК УЯНГА ЭНХЖАРГАЛ)`
- Sender: MN840004000499176161 (УЯНГА ЭНХЖАРГАЛ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Misheel Enkhtuvshin | signals: memo_grade_class, memo_name_full, fee_hint_explicit
    - alloc charge #1546 "Ballet Mon, Wed Term 4" 285,000 MNT

### Row 279 — 0 MNT
- Memo: `Цэцэрлэг цайны төлбөрт (ХААН БАНК  ТӨГРӨГ ТАМГАТ)`
- Sender: MN710005005263588880 (ТӨГРӨГ ТАМГАТ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 280 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 281 — 0 MNT
- Memo: `Afterschool meal (ХААН БАНК  ТӨГРӨГ ТАМГАТ)`
- Sender: MN710005005263588880 (ТӨГРӨГ ТАМГАТ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 282 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 283 — 0 MNT
- Memo: `Бага ангийн үдийн цайны төлбөрт (ХААН БАНК  ТӨГРӨГ ТАМГАТ)`
- Sender: MN710005005263588880 (ТӨГРӨГ ТАМГАТ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 284 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 285 — 0 MNT
- Memo: `Цэвэрлэгээний бараа авахад  (ГОЛОМТ БАНК КОСМО ТРЕЙД ХХК)`
- Sender: MN240015001102813123 (КОСМО ТРЕЙД ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 286 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 287 — 0 MNT
- Memo: `Цэвэрлэгээний хошуу бодис авахад (ХААН БАНК АЛМАЗ ЭНЕРЖИ )`
- Sender: MN450005005653135916 (АЛМАЗ ЭНЕРЖИ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 288 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 289 — 0 MNT
- Memo: `Сургалтын төлбөр буцаалт М.Үжин (БОГД БАНК МӨНХ-ЭРДЭНЭ БАТСҮХ)`
- Sender: MN800038008140000721 (МӨНХ-ЭРДЭНЭ БАТСҮХ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 290 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 291 — 400,000 MNT
- Memo: `EB -Ариунболдын Нандинбэлэг-1р анги (ХУДАЛДАА ХӨГЖЛИЙН БАНК БАЙГАЛХҮҮ БАТБОЛД)`
- Sender: MN580004000809012380 (БАЙГАЛХҮҮ БАТБОЛД)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Nandinbeleg Ariunbold | signals: memo_name_full, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)

### Row 292 — 2,000,000 MNT
- Memo: `EB -Ариунболдын Нандинбэлэг-1angi tuition (ХУДАЛДАА ХӨГЖЛИЙН БАНК БАЙГАЛХҮҮ БАТБОЛД)`
- Sender: MN580004000809012380 (БАЙГАЛХҮҮ БАТБОЛД)
- Tier: **attention** (unbalanced)
- Status: **matched** (1 proposal(s))
  - → Nandinbeleg Ariunbold | signals: memo_name_full, fee_hint_explicit | flags: no_open_charges
    - (no allocation)

### Row 293 — 275,000 MNT
- Memo: `SORSARAANA 1JK VLDEGDEL (ГОЛОМТ БАНК УРАНЗОРИГТ ПҮРЭВ-ОЧИР)`
- Sender: MN770015005275100620 (УРАНЗОРИГТ ПҮРЭВ-ОЧИР)
- Tier: **attention** (unbalanced)
- Status: **matched** (1 proposal(s))
  - → Sorsaraanaa Uranzorigt | signals: memo_grade_class, memo_name_fuzzy | flags: manual_review
    - (no allocation)

### Row 294 — 0 MNT
- Memo: `House тэмцээний медаль (ХАС БАНК МЭЖИККРОУН ХХК)`
- Sender: MN610032005000443685 (МЭЖИККРОУН ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 295 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 296 — 285,000 MNT
- Memo: `1PM TSETSEN TS BALETIIN DUGUILANGIIN TULBURT (ХААН БАНК МИЖИД ИЧИНХОРЛОО)`
- Sender: MN230005005753764112 (МИЖИД ИЧИНХОРЛОО)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (3 proposal(s))
  - → Tsetsen Tselmeg | signals: memo_grade_level, memo_name_partial
    - alloc charge #1612 "Ballet Mon, Wed Term 4" 285,000 MNT
  - → Tsetsen Naranbaatar | signals: memo_name_partial | flags: manual_review
    - (no allocation)
  - → Tsetsen Erdem | signals: memo_name_partial | flags: manual_review
    - (no allocation)

### Row 297 — 650,000 MNT
- Memo: `EB -Enerel Munkh-Erdene 1ML tennis (ХУДАЛДАА ХӨГЖЛИЙН БАНК МӨНХ-ЭРДЭНЭ АМАРСАНАА)`
- Sender: MN180004000436001055 (МӨНХ-ЭРДЭНЭ АМАРСАНАА)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (5 proposal(s))
  - → Enerel Munkh-Erdene | signals: memo_grade_class, memo_name_full, fee_hint_explicit
    - alloc charge #1692 "Tennis Tue, Thu Term 4" 650,000 MNT
  - → Anand Munkh-Orgil | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Tsets-Erdene Azkhuu | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Enerel Bolor-Erdene | signals: memo_name_full, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Munkh-Enerel Ganbold | signals: memo_name_full, fee_hint_explicit | flags: no_open_charges
    - (no allocation)

### Row 298 — 345,000 MNT
- Memo: `EB -Enerel Munkh-Erdene 1ML homework (ХУДАЛДАА ХӨГЖЛИЙН БАНК МӨНХ-ЭРДЭНЭ АМАРСАНАА)`
- Sender: MN180004000436001055 (МӨНХ-ЭРДЭНЭ АМАРСАНАА)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (5 proposal(s))
  - → Enerel Munkh-Erdene | signals: memo_grade_class, memo_name_full, fee_hint_explicit | flags: partial_payment
    - alloc charge #1691 "HW GR1 Term 4" 345,000 MNT
  - → Anand Munkh-Orgil | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1684 "HW GR1 Term 4" 345,000 MNT
  - → Tsets-Erdene Azkhuu | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Enerel Bolor-Erdene | signals: memo_name_full, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Munkh-Enerel Ganbold | signals: memo_name_full, fee_hint_explicit | flags: no_open_charges
    - (no allocation)

### Row 299 — 375,000 MNT
- Memo: `EB -caitlyn obrien 7b bus fee term 4 (ХУДАЛДАА ХӨГЖЛИЙН БАНК JEFFREY OBRIEN)`
- Sender: MN020004000441007610 (JEFFREY OBRIEN)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Caitlyn Az Ujin O'Brien | signals: memo_grade_class, memo_name_partial, memo_name_fuzzy, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 300 — 510,000 MNT
- Memo: `ОЮУНБААТАР ХАДААН 1PB (ХААН БАНК РАДНАА БАЯРСАЙХАН)`
- Sender: MN280005005037210181 (РАДНАА БАЯРСАЙХАН)
- Tier: **attention** (unbalanced)
- Status: **matched** (3 proposal(s))
  - → Khadaan Oyunbaatar | signals: memo_grade_class, memo_name_partial, memo_name_fuzzy | flags: manual_review
    - (no allocation)
  - → Misheel Khadaan | signals: memo_name_partial | flags: manual_review
    - (no allocation)
  - → Khadaan Turjargal | signals: memo_name_partial | flags: manual_review
    - (no allocation)

### Row 301 — 617,500 MNT
- Memo: `JAVKHLAN UJIN 2LB (ХААН БАНК СОДНОМДОРЖ ЖАВХЛАН)`
- Sender: MN670005005003855447 (СОДНОМДОРЖ ЖАВХЛАН)
- Tier: **confident** (confident)
- Status: **matched** (2 proposal(s))
  - → Ujin Javkhlan | signals: memo_grade_class, memo_name_full
    - alloc charge #1627 "Tennis Mon, Wed Term 4" 617,500 MNT
  - → Namu-Ujin Munguntulga | signals: memo_grade_class, memo_name_partial | flags: manual_review
    - (no allocation)

### Row 302 — 400,000 MNT
- Memo: `JAVKHLAN UJIN 2LB (ХААН БАНК СОДНОМДОРЖ ЖАВХЛАН)`
- Sender: MN670005005003855447 (СОДНОМДОРЖ ЖАВХЛАН)
- Tier: **confident** (confident)
- Status: **matched** (2 proposal(s))
  - → Ujin Javkhlan | signals: memo_grade_class, memo_name_full, fee_hint_from_amount
    - alloc charge #1626 "Taekwondo Term 4 /Grade 1-5/" 400,000 MNT
  - → Namu-Ujin Munguntulga | signals: memo_grade_class, memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)

### Row 303 — 11,450,000 MNT
- Memo: `EB -3SE ууганбямба Мишээл (ХУДАЛДАА ХӨГЖЛИЙН БАНК УЯНГА ЭНХБААТАР)`
- Sender: MN680004000427071111 (УЯНГА ЭНХБААТАР)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Misheel Uuganbyamba | signals: memo_grade_class, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #738 "tuition" 11,450,000 MNT

### Row 304 — 0 MNT
- Memo: `Түрээсийн төлбөрт (ХААН БАНК ГАЛСАНДОРЖ ДОРЖХАНД)`
- Sender: MN180005005029732049 (ГАЛСАНДОРЖ ДОРЖХАНД)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 305 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 306 — 9,189,688 MNT
- Memo: `EB -цахилгааны төлбөрт (ХУДАЛДАА ХӨГЖЛИЙН БАНК БАДАЧИТРЕЙД ХХК)`
- Sender: MN730004000499020868 (БАДАЧИТРЕЙД ХХК)
- Tier: **attention** (not_student)
- Status: **unmatched** (not_student)

### Row 307 — 0 MNT
- Memo: `Турба авахад (ХУДАЛДАА ХӨГЖЛИЙН БАНК ТАЙШИРТӨМӨР ХХК)`
- Sender: MN620004000421008525 (ТАЙШИРТӨМӨР ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 308 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 309 — 0 MNT
- Memo: `Гадаа будаг авахад (ХААН БАНК ОРДКОНСТРАКШН)`
- Sender: MN700005005124062449 (ОРДКОНСТРАКШН)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 310 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 311 — 1,000,000 MNT
- Memo: `EB -28 46 tootiin butsaalt (ХУДАЛДАА ХӨГЖЛИЙН БАНК ЦЭРЭНБАНЗАД НҮРЭНЗЭДГОМБО)`
- Sender: MN730004000800010995 (ЦЭРЭНБАНЗАД НҮРЭНЗЭДГОМБО)
- Tier: **attention** (not_student)
- Status: **unmatched** (not_student)

### Row 312 — 255,000 MNT
- Memo: `EB -6А Б.Мөнхбилгүүн сагс (ХУДАЛДАА ХӨГЖЛИЙН БАНК СУГАРСҮРЭН МООНОН)`
- Sender: MN760004000452545301 (СУГАРСҮРЭН МООНОН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Munkhbilguun Batbileg | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit
    - alloc charge #1407 "basketball GR 6-9 Term 4" 255,000 MNT

### Row 313 — 4,857,142 MNT
- Memo: `CHELE 5?B ТӨЛБӨР (ХААН БАНК HASI GAOWA)`
- Sender: MN560005005570123312 (HASI GAOWA)
- Tier: **attention** (unmatched)
- Status: **unmatched** (no_candidates)

### Row 314 — 400,000 MNT
- Memo: `CHELE 5?B БҮРТГЭЛ (ХААН БАНК HASI GAOWA)`
- Sender: MN560005005570123312 (HASI GAOWA)
- Tier: **attention** (unmatched)
- Status: **unmatched** (no_candidates)

### Row 315 — 40,000,000 MNT
- Memo: `кассаас`
- Sender: 10315674
- Tier: **attention** (not_student)
- Status: **unmatched** (not_student)

### Row 316 — 255,000 MNT
- Memo: `BOLOR NAIDAN 5MA ART (ГОЛОМТ БАНК ХУЛАН ЭНХСАЙХАН)`
- Sender: MN570015002109079374 (ХУЛАН ЭНХСАЙХАН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Bolor Naidan | signals: memo_grade_class, memo_name_full, fee_hint_explicit
    - alloc charge #1637 "Art KS2 /Term 4/" 255,000 MNT

### Row 317 — 1,000,000 MNT
- Memo: `unurbayariin tsetsuun. 5-iin TA.surgaltiin tulbur`
- Sender: MN350034103300416422 (ӨНӨРБАЯР ГОМБОСҮРЭН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Tsetsuun Unurbayar | signals: memo_name_full, fee_hint_explicit | flags: partial_payment
    - alloc charge #632 "tuition" 1,000,000 MNT

### Row 318 — 2,652,860 MNT
- Memo: `4BA ERHEHONGGEER (ГОЛОМТ БАНК HEXIGEBAYAER  XXX)`
- Sender: MN150015001205257604 (HEXIGEBAYAER  XXX)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Erhehonggeer Hangen | signals: memo_grade_class, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #769 "tuition" 2,652,860 MNT

### Row 319 — 4,500,000 MNT
- Memo: `BATTSAIZ  MARALGOO  5+B`
- Sender: 34316208
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Maralgoo Battsaiz | signals: memo_grade_class, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1155 "tuition" 4,500,000 MNT

### Row 320 — 360,000 MNT
- Memo: `12D МӨНХБАЯР МИШЭЭЛ (ХААН БАНК ПҮРЭВЖАВ МӨНХБАЯР)`
- Sender: MN230005005020937260 (ПҮРЭВЖАВ МӨНХБАЯР)
- Tier: **attention** (unbalanced)
- Status: **matched** (2 proposal(s))
  - → Misheel Munkhbayar | signals: memo_grade_class, memo_name_full | flags: manual_review
    - (no allocation)
  - → Misheel Uranchimeg | signals: memo_grade_class, memo_name_partial | flags: manual_review
    - (no allocation)

### Row 321 — 0 MNT
- Memo: `Талх талхан бүтээгдэхүүн авахад (ХУДАЛДАА ХӨГЖЛИЙН БАНК ТАЛХ ЧИХЭР ХК)`
- Sender: MN460004000499011945 (ТАЛХ ЧИХЭР ХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 322 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 323 — 0 MNT
- Memo: `Автобусны түрээсийн төлбөрт (ХУДАЛДАА ХӨГЖЛИЙН БАНК БАТ ИТГЭЛ ТРЭВЕЛ ХХК)`
- Sender: MN050004000416015021 (БАТ ИТГЭЛ ТРЭВЕЛ ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 324 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 325 — 0 MNT
- Memo: `Автобусны түрээсийн төлбөрт (ХУДАЛДАА ХӨГЖЛИЙН БАНК БАТ ИТГЭЛ ТРЭВЕЛ ХХК)`
- Sender: MN050004000416015021 (БАТ ИТГЭЛ ТРЭВЕЛ ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 326 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 327 — 0 MNT
- Memo: `Спорт өмсгөл авахад (ГОЛОМТ БАНК УРАН СЭНТИЙ ХХК)`
- Sender: MN310015001165017545 (УРАН СЭНТИЙ ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 328 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 329 — 0 MNT
- Memo: `Гиншүүнчлэлийн төлбөр /И Эс Эм олон улсын дунд сургууль/ (ХААН БАНК  МОНГОЛЫН ХУВИЙН СУРГУУЛИУДЫН ХОЛБОО)`
- Sender: MN170005005134324063 (МОНГОЛЫН ХУВИЙН СУРГУУЛИУДЫН ХОЛБОО)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 330 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 331 — 0 MNT
- Memo: `Геодези хэмжилт хийлгэхэд  (ГОЛОМТ БАНК ЭРХЭМ ГАЗАР)`
- Sender: MN400015001205231449 (ЭРХЭМ ГАЗАР)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 332 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 333 — 0 MNT
- Memo: `Энгэр зүүлт авахад (ХУДАЛДАА ХӨГЖЛИЙН БАНК НИМУСПЛАС ХХК)`
- Sender: MN410004000406106793 (НИМУСПЛАС ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 334 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 335 — 0 MNT
- Memo: `Сургалтын төлбөр буцаалт KimSohee Kim Nayun  (ХААН БАНК ГӨРӨӨЧ ОЮУН-ЭРДЭНЭ)`
- Sender: MN140005005077501808 (ГӨРӨӨЧ ОЮУН-ЭРДЭНЭ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 336 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 337 — 8,025,000 MNT
- Memo: `EB -Батбаяр Хулан 5ia анги төлбөр (ХУДАЛДАА ХӨГЖЛИЙН БАНК БАТБАЯР ЦЭРЭНДАМБА)`
- Sender: MN480004000472052602 (БАТБАЯР ЦЭРЭНДАМБА)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Khulan Batbayar | signals: memo_grade_class, memo_grade_level, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #837 "tuition" 8,025,000 MNT

### Row 338 — 4,900,000 MNT
- Memo: `EZLEN 1-Р АНГИ 88115699 (ХААН БАНК ЧОЙЖИЛ МЯГМАРДОРЖ)`
- Sender: MN270005005309592310 (ЧОЙЖИЛ МЯГМАРДОРЖ)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Ezlen Enkhmanlai | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #287 "tuition" 4,900,000 MNT

### Row 339 — 960,000 MNT
- Memo: `NARANMANDAKH.A-4BA,BALLET PAYMENT OF 2ND AND 3RD TERM (ХААН БАНК АМГАЛАН УРАНТӨГС)`
- Sender: MN800005005374371836 (АМГАЛАН УРАНТӨГС)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Naranmandakh Altantugs | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: overpayment
    - alloc charge #1456 "Ballet Tue, Thu Term 4" 960,000 MNT

### Row 340 — 210,000 MNT
- Memo: `Enuujin7 C volleyball`
- Sender: MN030034340702063921 (СЭЛЭНГЭ БАТСАЙХАН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Enuujin Chintulga | signals: memo_grade_level, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1532 "Volleyball 11 am to 1pm Term 4" 210,000 MNT

### Row 341 — 375,000 MNT
- Memo: `TANAKA KANON 8E BUS (TERM4) (ХААН БАНК ЖАРГАЛСАЙХАН УЛАМБАЯР)`
- Sender: MN460005005014344532 (ЖАРГАЛСАЙХАН УЛАМБАЯР)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Kanon Tanaka | signals: memo_grade_class, memo_name_full, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 342 — 0 MNT
- Memo: `Сандал (ХААН БАНК MA BAQUAN)`
- Sender: MN200005005157080888 (MA BAQUAN)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 343 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 344 — 0 MNT
- Memo: `Сандал (ХААН БАНК MA BAQUAN)`
- Sender: MN200005005157080888 (MA BAQUAN)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 345 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 346 — 0 MNT
- Memo: `Сандал (ХААН БАНК MA BAQUAN)`
- Sender: MN200005005157080888 (MA BAQUAN)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 347 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 348 — 0 MNT
- Memo: `Сандал (ХААН БАНК MA BAQUAN)`
- Sender: MN200005005157080888 (MA BAQUAN)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 349 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 350 — 400,000 MNT
- Memo: `SETSENGUNJ LKHAGVA-OCHIR 4BA TAEKWONDO (ГОЛОМТ БАНК НАРАНТУЯА ОЧИРХҮҮ)`
- Sender: MN310015002735100382 (НАРАНТУЯА ОЧИРХҮҮ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Setsengunj Lkhagva-Ochir | signals: memo_grade_class, memo_name_full, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #1513 "Taekwondo Term 4 /Grade 1-5/" 400,000 MNT

### Row 351 — 210,000 MNT
- Memo: `ХОНГОРЗРЛ 8В ВОЛЛЕЙБОЛ (ГОЛОМТ БАНК БАТ-ОТГОН ЛХАГВАЖАВ)`
- Sender: MN780015002800000296 (БАТ-ОТГОН ЛХАГВАЖАВ)
- Tier: **attention** (unbalanced)
- Status: **matched** (1 proposal(s))
  - → Khongorzol Gan-Ochir | signals: memo_grade_class, memo_name_fuzzy | flags: manual_review
    - (no allocation)

### Row 352 — 3,000,000 MNT
- Memo: `185C10 N.ENEREL 12A (ХААН БАНК ЖАМБАЖАВ БАДАМЦЭРЭН)`
- Sender: MN600005005064245736 (ЖАМБАЖАВ БАДАМЦЭРЭН)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Enerel Nasanjargal | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #201 "tuition" 3,000,000 MNT

### Row 353 — 10,000,000 MNT
- Memo: `М.АРИУНХҮСЛЭН М.МӨНХХҮСЛЭН (ХААН БАНК ЦЭНГЭЛ ЦАЦРАЛ)`
- Sender: MN740005005062038152 (ЦЭНГЭЛ ЦАЦРАЛ)
- Tier: **attention** (low_confidence)
- Status: **low_confidence** (1 proposal(s))
  - → Ariunkhuslen Yondonpurev | signals: memo_name_fuzzy, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #905 "tuition" 10,000,000 MNT

### Row 354 — 0 MNT
- Memo: `Данс хоорондын гүйлгээ (ХУДАЛДАА ХӨГЖЛИЙН БАНК И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ)`
- Sender: MN940004000457217661 (И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 355 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 356 — 210,000 MNT
- Memo: `БОЛД НОМИН ЭРДЭНЭ (ХААН БАНК ДОРЖ БОЛД)`
- Sender: MN900005005006516422 (ДОРЖ БОЛД)
- Tier: **attention** (unbalanced)
- Status: **matched** (5 proposal(s))
  - → Nomin-Erdene Bold | signals: memo_name_full | flags: manual_review
    - (no allocation)
  - → Nomin-erdene Ariunjargal | signals: memo_name_full | flags: manual_review
    - (no allocation)
  - → Nomin-Erdene Zolboo | signals: memo_name_full | flags: manual_review
    - (no allocation)
  - → Nomin-Erdene Enkhbaatar | signals: memo_name_full | flags: manual_review
    - (no allocation)
  - → Nomun-Erdene Bold-Erdene | signals: memo_name_full | flags: manual_review
    - (no allocation)

### Row 357 — 0 MNT
- Memo: `Шилжүүлэг (АРИГ БАНК ТЭМҮҮЖИН ЭРДЭНЭБАТ)`
- Sender: MN450021002108000941 (ТЭМҮҮЖИН ЭРДЭНЭБАТ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 358 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 359 — 0 MNT
- Memo: `Kargo (ХААН БАНК ГАЛМАНДАХ МӨНГӨНГЭРЭЛ)`
- Sender: MN700005005018549535 (ГАЛМАНДАХ МӨНГӨНГЭРЭЛ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 360 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 361 — 210,000 MNT
- Memo: `EB -8E - Enerel Voleyball payment (ХУДАЛДАА ХӨГЖЛИЙН БАНК ГАНБАТ ЧУЛУУНБААТАР)`
- Sender: MN720004000426000838 (ГАНБАТ ЧУЛУУНБААТАР)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (2 proposal(s))
  - → Enerel Ganbat | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1642 "Volleyball 1-3pm Term 4" 210,000 MNT
  - → Munkh-Enerel Ganbold | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: no_open_charges
    - (no allocation)

### Row 362 — 0 MNT
- Memo: `Хэвлэлийн төлбөрт (ГОЛОМТ БАНК МАНЛАЙ ХАСАР ПРИНТ)`
- Sender: MN560015003455170023 (МАНЛАЙ ХАСАР ПРИНТ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 363 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 364 — 0 MNT
- Memo: `Calligraphy дугуйлан төлбөрт (ГОЛОМТ БАНК ЭЛ БИЗНЕС КОРНЕР ХХК)`
- Sender: MN180015002105220543 (ЭЛ БИЗНЕС КОРНЕР ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 365 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 366 — 0 MNT
- Memo: `Засварын мөтериал авахад (ХУДАЛДАА ХӨГЖЛИЙН БАНК ЭРЧИМХҮҮ ХХК)`
- Sender: MN860004000473051212 (ЭРЧИМХҮҮ ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 367 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 368 — 420,866 MNT
- Memo: `РС74070108 (КАПИТРОН БАНК БЗД НДГ ТЭТГЭМЖ)`
- Sender: MN040030003022020007 (БЗД НДГ ТЭТГЭМЖ)
- Tier: **attention** (not_student)
- Status: **unmatched** (not_student)

### Row 369 — 573,396 MNT
- Memo: `ГП91042608 (КАПИТРОН БАНК БЗД НДГ ТЭТГЭМЖ)`
- Sender: MN040030003022020007 (БЗД НДГ ТЭТГЭМЖ)
- Tier: **attention** (not_student)
- Status: **unmatched** (not_student)

### Row 370 — 0 MNT
- Memo: `#941144 домайн нэр (ХУДАЛДАА ХӨГЖЛИЙН БАНК АЙТҮҮЛС ХК)`
- Sender: MN220004000499204437 (АЙТҮҮЛС ХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 371 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 372 — 0 MNT
- Memo: `Веб хуудас байршуулах үйлчилгээний төлбөрт (ГОЛОМТ БАНК ХОББИСТНЕТВОРК ХХК)`
- Sender: MN290015002205047798 (ХОББИСТНЕТВОРК ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 373 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 374 — 0 MNT
- Memo: `5100580 Цахилгааны төлбөр`
- Sender: MN590034102100001220 (УБЦТС)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 375 — 0 MNT
- Memo: `ДОТООД Б/БУС ШИЛЖҮҮЛЭГ ШИМТГЭЛ-EBANK:[100.00MNT] /431209`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 376 — 0 MNT
- Memo: `Багцын төлбөрт # INV-113590 (ГОЛОМТ БАНК КОЛЛПРО ХХК)`
- Sender: MN520015001410016178 (КОЛЛПРО ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 377 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 378 — 0 MNT
- Memo: `10119126; 11451230 утасны төлбөрт`
- Sender: MN910034100000999990 (МЦХ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 379 — 0 MNT
- Memo: `ДОТООД Б/БУС ШИЛЖҮҮЛЭГ ШИМТГЭЛ-EBANK:[100.00MNT] /431209`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 380 — 0 MNT
- Memo: `24036800 усны төлбөр`
- Sender: MN140034102100001060 (УС СУВГИЙН УДИРДАХ ГАЗАР)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 381 — 0 MNT
- Memo: `ДОТООД Б/БУС ШИЛЖҮҮЛЭГ ШИМТГЭЛ-EBANK:[100.00MNT] /431209`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 382 — 0 MNT
- Memo: `0107 халаалт халуун усны төлбөрт`
- Sender: MN690034241800119907 (УБ ДУЛААНЫ СҮЛЖЭЭ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 383 — 0 MNT
- Memo: `ДОТООД Б/БУС ШИЛЖҮҮЛЭГ ШИМТГЭЛ-EBANK:[100.00MNT] /431209`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 384 — 0 MNT
- Memo: `2260302016488  9097392  Элит стэри 99081655 MN940034106000030702 И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ БСБ`
- Sender: MN120034106000063994 (МТА.ТАТВАР)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 385 — 0 MNT
- Memo: `ТАТВАР ТӨЛӨЛТ 300 /IBANK/:[300.00MNT] /430206`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 386 — 26,516,250 MNT
- Memo: `М.АРИУНХҮСЛЭН М.МӨНХХҮСЛЭН (ХААН БАНК ЦЭНГЭЛ ЦАЦРАЛ)`
- Sender: MN740005005062038152 (ЦЭНГЭЛ ЦАЦРАЛ)
- Tier: **attention** (low_confidence)
- Status: **low_confidence** (1 proposal(s))
  - → Ariunkhuslen Yondonpurev | signals: memo_name_fuzzy | flags: overpayment
    - alloc charge #905 "tuition" 18,000,000 MNT
    - alloc charge #1616 "Art KS1 /Term 4/" 300,000 MNT

### Row 387 — 384,000 MNT
- Memo: `EB -Egshiglen, Tselmeg.G ballet payment (ХУДАЛДАА ХӨГЖЛИЙН БАНК ГАНБАТ ЧУЛУУНБААТАР)`
- Sender: MN740004000426088490 (ГАНБАТ ЧУЛУУНБААТАР)
- Tier: **attention** (low_confidence)
- Status: **low_confidence** (5 proposal(s))
  - → Egshiglen Ganbat | signals: memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1628 "Ballet Tue, Thu Term 4" 384,000 MNT
  - → Egshiglen Oyun-Erdene | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Egshiglen Burenjargal | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Egshiglen Odbayar | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Egshiglen Nyamdorj | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 388 — 31,500,000 MNT
- Memo: `HYEOKJAE JANG_11B (ХААН БАНК LEE WON KYUNG)`
- Sender: MN460005005920342089 (LEE WON KYUNG)
- Tier: **attention** (unbalanced)
- Status: **matched** (1 proposal(s))
  - → Hyeokjae Jang | signals: memo_grade_class, memo_name_full | flags: overpayment
    - alloc charge #812 "tuition" 25,000,000 MNT

### Row 389 — 3,000,000 MNT
- Memo: `3LM М.ЯВУУДАЙ ТӨЛБӨР (ХААН БАНК БААТАР АРИУНЦЭЦЭГ)`
- Sender: MN820005005700181608 (БААТАР АРИУНЦЭЦЭГ)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Yvuudai Myagmardorj | signals: memo_grade_class, memo_name_fuzzy, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #497 "tuition" 3,000,000 MNT

### Row 390 — 3,087,500 MNT
- Memo: `4?A М.ЧИНГҮДЭЙ ТӨЛБӨР (ХААН БАНК БААТАР АРИУНЦЭЦЭГ)`
- Sender: MN820005005700181608 (БААТАР АРИУНЦЭЦЭГ)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Chingudei Myagmardorj | signals: memo_grade_wildcard, memo_name_initial, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1302 "tuition" 3,087,500 MNT

### Row 391 — 120,000 MNT
- Memo: `РОЯАЛЬ БДС-C САГСНЫ ХУРААМЖ (ХААН БАНК ГАНБОЛД БАЯРМАА)`
- Sender: MN220005005076134837 (ГАНБОЛД БАЯРМАА)
- Tier: **attention** (unmatched)
- Status: **unmatched** (no_candidates)

### Row 392 — 2,000,000 MNT
- Memo: `Б.ДӨЛГӨӨН 12D СУРГАЛТЫН ТӨЛБӨР (ГОЛОМТ БАНК БАТЗОРИГ РЭГЗЭН)`
- Sender: MN370015002705100793 (БАТЗОРИГ РЭГЗЭН)
- Tier: **confident** (confident)
- Status: **matched** (3 proposal(s))
  - → Dulguun Batzorig | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #186 "tuition" 2,000,000 MNT
  - → Dulguun Battushig | signals: memo_name_initial, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #705 "tuition" 2,000,000 MNT
  - → Dulguun Batsaikhan | signals: memo_name_initial, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #798 "tuition" 2,000,000 MNT

### Row 393 — 300,000 MNT
- Memo: `ХАНГАЙН EСҮЙЖИН 5IA ХӨЛБӨМБӨГ (ХААН БАНК РЭГДЭЛ ХАНГАЙ)`
- Sender: MN260005005037108949 (РЭГДЭЛ ХАНГАЙ)
- Tier: **confident** (confident)
- Status: **matched** (2 proposal(s))
  - → Yesuijin Khangai | signals: memo_grade_class, memo_name_fuzzy, fee_hint_explicit
    - alloc charge #1470 "Football GR 3-5 /Term 4/" 300,000 MNT
  - → Khangai Altanshagai | signals: memo_grade_class, memo_name_fuzzy, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 394 — 4,350,000 MNT
- Memo: `EB -Л. Амир, 5 В, 4-р улирал (ХУДАЛДАА ХӨГЖЛИЙН БАНК AMIR LAILA)`
- Sender: MN170004000423020242 (AMIR LAILA)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (2 proposal(s))
  - → Amir Dilshad | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #580 "tuition" 4,350,000 MNT
  - → Amir Laila | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1157 "tuition" 4,350,000 MNT

### Row 395 — 2,500,000 MNT
- Memo: `ARUUKHAN 1BO TUITION (ХААН БАНК БАЛДАНГОМБО ОЮУНГЭРЭЛ)`
- Sender: MN170005005021334874 (БАЛДАНГОМБО ОЮУНГЭРЭЛ)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (2 proposal(s))
  - → Yi Bo / Tergel Gong | signals: memo_grade_level, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #689 "tuition" 2,500,000 MNT
  - → Aruukhan Ganbayar | signals: memo_grade_level, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1184 "tuition" 2,500,000 MNT

### Row 396 — 400,000 MNT
- Memo: `БЭЛТГЭЛ П.ГЭГЭЭН (ХААН БАНК БАТ-ЭРДЭНЭ БҮЖИНЛХАМ)`
- Sender: MN660005005720864818 (БАТ-ЭРДЭНЭ БҮЖИНЛХАМ)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Gegeen Purevsuren | signals: memo_name_initial, memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)

### Row 397 — 1,250,000 MNT
- Memo: `БЭЛТГЭЛ СУР ТӨЛ П.ГЭГЭЭН (ХААН БАНК БАТ-ЭРДЭНЭ БҮЖИНЛХАМ)`
- Sender: MN660005005720864818 (БАТ-ЭРДЭНЭ БҮЖИНЛХАМ)
- Tier: **attention** (unbalanced)
- Status: **matched** (1 proposal(s))
  - → Gegeen Purevsuren | signals: memo_name_initial, memo_name_partial, fee_hint_explicit | flags: no_open_charges
    - (no allocation)

### Row 398 — 5,000,000 MNT
- Memo: `Б.ЭНХ-ҮЖИН 4SA СУРГАЛТЫН ТӨЛБӨР 80777744 (ХААН БАНК ДОРЖПҮРЭВ АМИНДАВАА)`
- Sender: MN650005005022192848 (ДОРЖПҮРЭВ АМИНДАВАА)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Enkh-Ujin Batsukh | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #533 "tuition" 5,000,000 MNT

### Row 399 — 1,000,000 MNT
- Memo: `2OB DAGVA AMIRLAN TULBUR 99066699 (ХААН БАНК НЭРГҮЙ МӨНХТУЯА)`
- Sender: MN970005005037689671 (НЭРГҮЙ МӨНХТУЯА)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Amirlan Dagva | signals: memo_grade_class, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #636 "tuition" 1,000,000 MNT

### Row 400 — 15,000,000 MNT
- Memo: `Х.ЕСҮЙ, Х.ЕСҮХЭЙ ТӨЛБӨР (ГОЛОМТ БАНК БААСАНСҮРЭН БАТМӨНХ)`
- Sender: MN520015002105003621 (БААСАНСҮРЭН БАТМӨНХ)
- Tier: **attention** (unbalanced)
- Status: **matched** (1 proposal(s))
  - → Yesui Kherlen | signals: memo_name_initial, memo_name_partial, memo_name_fuzzy | flags: overpayment
    - alloc charge #1364 "tuition" 10,987,429 MNT
    - alloc charge #1960 "registration" 400,000 MNT

### Row 401 — 0 MNT
- Memo: `Түрээсийн төлбөр Samuel Soldan`
- Sender: MN040034103100425193 (RUDOLPH CHARLES)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 402 — 0 MNT
- Memo: `ДОТООД Б/БУС ШИЛЖҮҮЛЭГ ШИМТГЭЛ-EBANK:[100.00MNT] /431209`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 403 — 0 MNT
- Memo: `#941949 сервер түрээсийн төлбөрт Р:9097392 (ХУДАЛДАА ХӨГЖЛИЙН БАНК АЙТҮҮЛС ХК)`
- Sender: MN220004000499204437 (АЙТҮҮЛС ХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 404 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 405 — 0 MNT
- Memo: `Аудитын төлбөрт (ГОЛОМТ БАНК ТЭД-АУДИТ ХХК)`
- Sender: MN830015001165124182 (ТЭД-АУДИТ ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 406 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 407 — 198,000 MNT
- Memo: `KHANGAIBAZAR NARANTUYA 11A MATH CLUB PAYMENT (ХААН БАНК БОЛДБААТАР НАРАНТУЯА)`
- Sender: MN430005005028367100 (БОЛДБААТАР НАРАНТУЯА)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Khangaibazar Narantuya | signals: memo_grade_class, memo_name_full, fee_hint_explicit | flags: partial_payment
    - alloc charge #1418 "Math's club /Jamsran/ Term 4 Mon, Wed" 198,000 MNT

### Row 408 — 0 MNT
- Memo: `MANAGEMENT SERVICE`
- Sender: 3499102621090002 (SWIFT- ИЛГЭЭХ ГҮЙЛГЭЭНИЙ ӨГЛӨГ /ҮНДСЭН ДҮН/)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 409 — 0 MNT
- Memo: `SWIFT ХУРААМЖ:[30000.00MNT] /430801`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 410 — 0 MNT
- Memo: `SWIFT  CHARGE OUR:[30.00USD] /262110`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 411 — 375,000 MNT
- Memo: `Э. ЭРХЭМБИЛЭГ 11D 99141591 АВТОБУСНЫ ТӨЛБӨР (ХААН БАНК ЯНЖАВ ЗОЛЗАЯА)`
- Sender: MN850005005589032649 (ЯНЖАВ ЗОЛЗАЯА)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Erkhembileg Enkhbold | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 412 — 200,000 MNT
- Memo: `Ц. ОЮУНБИЛГҮҮН ТӨЛБӨР ҮЛДЭГДЭЛ-8Д (ХААН БАНК БӨХХУЯГ ХИШИГЖАРГАЛ)`
- Sender: MN610005005058097373 (БӨХХУЯГ ХИШИГЖАРГАЛ)
- Tier: **attention** (unbalanced)
- Status: **matched** (1 proposal(s))
  - → Oyunbilguun Tserenjamts | signals: memo_grade_class, memo_name_fuzzy | flags: manual_review
    - (no allocation)

### Row 413 — 375,000 MNT
- Memo: `EB -ABTOБУС - Молор-Эрдэнэ Тэмүгэ 7A (ХУДАЛДАА ХӨГЖЛИЙН БАНК САРУУЛ БАЯР)`
- Sender: MN720004000499156880 (САРУУЛ БАЯР)
- Tier: **attention** (missing_charge)
- Status: **matched** (3 proposal(s))
  - → Temuge Molor-Erdene | signals: memo_grade_class, memo_name_full, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Amirlan Munkh-Erdene | signals: memo_grade_class, memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Erdene Gansukh | signals: memo_grade_class, memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 414 — 5,000,000 MNT
- Memo: `ITGELT TENGIS, 1PB (ГОЛОМТ БАНК ТЭНГИС ЭРДЭНЭБАТ)`
- Sender: MN280015001605115814 (ТЭНГИС ЭРДЭНЭБАТ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Itgelt Tengis | signals: memo_grade_class, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #692 "tuition" 5,000,000 MNT

### Row 415 — 10,000,000 MNT
- Memo: `EB -Билэгтийн Ринчен 8c (ХУДАЛДАА ХӨГЖЛИЙН БАНК БИЛЭГТ БАТБОЛД)`
- Sender: MN790004000471028888 (БИЛЭГТ БАТБОЛД)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Rinchen Bilegt | signals: memo_grade_class, memo_name_partial, memo_name_fuzzy, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #585 "tuition" 10,000,000 MNT

### Row 416 — 3,000,000 MNT
- Memo: `ANU UJIN LUCAS 3? (ХААН БАНК ЗОРИГТ АРИУНЖАРГАЛ)`
- Sender: MN360005005011253613 (ЗОРИГТ АРИУНЖАРГАЛ)
- Tier: **confident** (confident)
- Status: **matched** (4 proposal(s))
  - → Lukas Anu-Ujin | signals: memo_grade_wildcard, memo_name_full, memo_name_fuzzy, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1135 "tuition" 3,000,000 MNT
  - → Anu-Ujin Altansukh | signals: memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1075 "tuition" 3,000,000 MNT
  - → Anu-Ujin Bayart | signals: memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1322 "tuition" 3,000,000 MNT
  - → Anu-Ujin Mungunkhulug | signals: memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1339 "tuition" 3,000,000 MNT

### Row 417 — 4,500,000 MNT
- Memo: `B GOO UJIN 5? (ХААН БАНК ЗОРИГТ АРИУНЖАРГАЛ)`
- Sender: MN360005005011253613 (ЗОРИГТ АРИУНЖАРГАЛ)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (5 proposal(s))
  - → Goo-Ujin Boldbaatar | signals: memo_grade_wildcard, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1154 "tuition" 4,500,000 MNT
  - → Qing Na Guo | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #678 "tuition" 4,500,000 MNT
  - → Goo-Ujin Yeruult | signals: memo_name_full | flags: no_open_charges
    - (no allocation)
  - → Tselmuun-Ujin Enkh-Amgalan | signals: memo_grade_wildcard, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #880 "tuition" 4,500,000 MNT
  - → Anu-Ujin Bayart | signals: memo_grade_wildcard, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1322 "tuition" 4,500,000 MNT

### Row 418 — 3,607,142 MNT
- Memo: `ПҮРЭВСҮРЭН ГЭГЭЭН. БЭЛТГЭЛ (ХААН БАНК БАТ-ЭРДЭНЭ БҮЖИНЛХАМ)`
- Sender: MN660005005720864818 (БАТ-ЭРДЭНЭ БҮЖИНЛХАМ)
- Tier: **attention** (unbalanced)
- Status: **matched** (2 proposal(s))
  - → Gegeen Purevsuren | signals: memo_name_full | flags: no_open_charges
    - (no allocation)
  - → Amartugs Purevsuren | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1028 "tuition" 3,607,142 MNT

### Row 419 — 0 MNT
- Memo: `9360000035419`
- Sender: MN110034343100204768 (ПЕТРОСТАР)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 420 — 0 MNT
- Memo: `ДОТООД Б/БУС ШИЛЖҮҮЛЭГ ШИМТГЭЛ-EBANK:[100.00MNT] /431209`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 421 — 375,000 MNT
- Memo: `8D M.BUYANDARI BUS N9 (ХААН БАНК РАДНАА ЭНХЗАЯА)`
- Sender: MN370005005003751130 (РАДНАА ЭНХЗАЯА)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Buyandari Megddorj | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 422 — 2,500,000 MNT
- Memo: `EB -Education conference (ХУДАЛДАА ХӨГЖЛИЙН БАНК УЛААНБААТАР ДАХЬ АМЕРИК ЕРӨНХИЙ БОЛ)`
- Sender: MN940004000404197752 (УЛААНБААТАР ДАХЬ АМЕРИК ЕРӨНХИЙ БОЛ)
- Tier: **attention** (not_student)
- Status: **unmatched** (not_student)

### Row 423 — 0 MNT
- Memo: `Дохиололын төлбөр (ГОЛОМТ БАНК ОУЛ ЭМ ЭН ЖИ ХХК)`
- Sender: MN540015003155106961 (ОУЛ ЭМ ЭН ЖИ ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 424 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 425 — 0 MNT
- Memo: `Данс хоорондын гүйлгээ (ХУДАЛДАА ХӨГЖЛИЙН БАНК И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ)`
- Sender: MN680004000457112981 (И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 426 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 427 — 0 MNT
- Memo: `3-р сарын цалингийн гүйлгээ`
- Sender: MN830034385300044839 (И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ БСБ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 428 — 0 MNT
- Memo: `ДОТООД Б/БУС ШИЛЖҮҮЛЭГ ШИМТГЭЛ-EBANK:[100.00MNT] /431209`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 429 — 0 MNT
- Memo: `Kargo (ХААН БАНК MA BAQUAN)`
- Sender: MN200005005157080888 (MA BAQUAN)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 430 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 431 — 0 MNT
- Memo: `3-р сарын цалингийн гүйлгээ`
- Sender: MN830034385300044839 (И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ БСБ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 432 — 0 MNT
- Memo: `ДОТООД Б/БУС ШИЛЖҮҮЛЭГ ШИМТГЭЛ-EBANK:[100.00MNT] /431209`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 433 — 0 MNT
- Memo: `Давс авахад`
- Sender: MN460034101400099700 (ХУД ТОХИЖИЛТ ҮЙЛЧИЛГЭЭ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 434 — 0 MNT
- Memo: `ДОТООД Б/БУС ШИЛЖҮҮЛЭГ ШИМТГЭЛ-EBANK:[100.00MNT] /431209`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 435 — 0 MNT
- Memo: `Afterschool tennis (ХАС БАНК ГРАНД ТИГРЭ КЛУБ ХХК)`
- Sender: MN170032005005832730 (ГРАНД ТИГРЭ КЛУБ ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 436 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 437 — 0 MNT
- Memo: `Хэвлэлийн төлбөр болон хүргэлт ESM`
- Sender: MN350034109090915327 (МОНГОЛ ШУУДАН)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 438 — 0 MNT
- Memo: `ДОТООД Б/БУС ШИЛЖҮҮЛЭГ ШИМТГЭЛ-EBANK:[100.00MNT] /431209`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 439 — 0 MNT
- Memo: `Цэвэрлэгээний бараа авахад (ХААН БАНК ДЭМБЭРЭЛ БАТСҮХ)`
- Sender: MN220005005035199576 (ДЭМБЭРЭЛ БАТСҮХ)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 440 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 441 — 5,000,000 MNT
- Memo: `ORGIL NEGUN PRESCHOOL5? /88786688/ (ХААН БАНК ОТГОНЖАРГАЛ ҮҮРЦАЙХ)`
- Sender: MN950005005304223494 (ОТГОНЖАРГАЛ ҮҮРЦАЙХ)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (2 proposal(s))
  - → Negun Zorigtbaatar | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #534 "tuition" 5,000,000 MNT
  - → Negun Sergelen | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #665 "tuition" 5,000,000 MNT

### Row 442 — 390,000 MNT
- Memo: `EB -UNURTUVSHIN ENHNOMIN 4 (ХУДАЛДАА ХӨГЖЛИЙН БАНК ӨНӨРТҮВШИН БАЛТ)`
- Sender: MN590004000457113919 (ӨНӨРТҮВШИН БАЛТ)
- Tier: **attention** (unbalanced)
- Status: **matched** (1 proposal(s))
  - → Enkhnomin Unurtuvshin | signals: memo_name_full | flags: manual_review
    - (no allocation)

### Row 443 — 1,600,000 MNT
- Memo: `EB -А.Эрхэмбэлэг 9b-3 сар 2026 (ХУДАЛДАА ХӨГЖЛИЙН БАНК БАЙГАЛХҮҮ БАТБОЛД)`
- Sender: MN580004000809012380 (БАЙГАЛХҮҮ БАТБОЛД)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Erkhembeleg Ariunbold | signals: memo_grade_class, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #147 "tuition" 1,600,000 MNT

### Row 444 — 700,000 MNT
- Memo: `EB -surgaltiin tulbur G.Maitsetseg (ХУДАЛДАА ХӨГЖЛИЙН БАНК ГЭРЭЛ ЖАРГАЛСАЙХАН)`
- Sender: MN480004000417022756 (ГЭРЭЛ ЖАРГАЛСАЙХАН)
- Tier: **attention** (unmatched)
- Status: **unmatched** (no_candidates)

### Row 445 — 5,000,000 MNT
- Memo: `12C Б.ТӨГСЦОГТ СУРГАЛТЫН ТӨЛБӨР (ХААН БАНК ГОНЧИГ ОЮУНЦЭЦЭГ)`
- Sender: MN360005005003294569 (ГОНЧИГ ОЮУНЦЭЦЭГ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Tugstsogt Bat-orshikh | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #345 "tuition" 5,000,000 MNT

### Row 446 — 4,000,000 MNT
- Memo: `12C Б.ТӨГСЦОГТ СУРГАЛТЫН ТӨЛБӨР (ХААН БАНК ГОНЧИГ ОЮУНЦЭЦЭГ)`
- Sender: MN360005005003294569 (ГОНЧИГ ОЮУНЦЭЦЭГ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Tugstsogt Bat-orshikh | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #345 "tuition" 4,000,000 MNT

### Row 447 — 3,000,000 MNT
- Memo: `12C Б.ТӨГСЦОГТ СУРГАЛТЫН ТӨЛБӨР (ХААН БАНК ГОНЧИГ ОЮУНЦЭЦЭГ)`
- Sender: MN360005005003294569 (ГОНЧИГ ОЮУНЦЭЦЭГ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Tugstsogt Bat-orshikh | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #345 "tuition" 3,000,000 MNT

### Row 448 — 3,428,571 MNT
- Memo: `EB -эрдэнэ овогтой номгүн - 3 (ХУДАЛДАА ХӨГЖЛИЙН БАНК ЭРДЭНЭ ТУЛГА)`
- Sender: MN340004000417193728 (ЭРДЭНЭ ТУЛГА)
- Tier: **attention** (unbalanced)
- Status: **matched** (1 proposal(s))
  - → Nomgun Erdene | signals: memo_name_full | flags: no_open_charges
    - (no allocation)

### Row 449 — 3,000,000 MNT
- Memo: `БЯМБАЖАРГАЛЫН ГЭГЭЭ, ?3 ЦЭЦЭРЛЭГ (ХААН БАНК УРАНЦЭЦЭГ БЯМБАЖАРГАЛ)`
- Sender: MN340005005751227170 (УРАНЦЭЦЭГ БЯМБАЖАРГАЛ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Gegee Byambajargal | signals: memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1137 "tuition" 3,000,000 MNT

### Row 450 — 3,087,500 MNT
- Memo: `UNURZOLBOO NANDINGEGEE 4? (ГОЛОМТ БАНК НАРМАНДАХ ГАНБААТАР)`
- Sender: MN290015001205318365 (НАРМАНДАХ ГАНБААТАР)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Nandingegee Unurzolboo | signals: memo_grade_wildcard, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #872 "tuition" 3,087,500 MNT

### Row 451 — 4,000,000 MNT
- Memo: `UUGANBAATAR SHINESARAN 5C? (ХААН БАНК МИХЛАЙ ЭНХЧИМЭГ)`
- Sender: MN420005005307106027 (МИХЛАЙ ЭНХЧИМЭГ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Shinesaran Uuganbaatar | signals: memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1359 "tuition" 4,000,000 MNT

### Row 452 — 400,000 MNT
- Memo: `EB -эрдэнэ овогтой номгүн - 3 бүртгэлийн хураамж (ХУДАЛДАА ХӨГЖЛИЙН БАНК ЭРДЭНЭ ТУЛГА)`
- Sender: MN340004000417193728 (ЭРДЭНЭ ТУЛГА)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Nomgun Erdene | signals: memo_name_full, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 400,000 MNT
    - proposes NEW charge "registration" 400,000 MNT (fee_hint_explicit)

### Row 453 — 2,500,000 MNT
- Memo: `GRADE 12 E.TEMUULEN (ХААН БАНК ДҮГЭРСҮРЭН ӨЛЗИЙХҮҮ)`
- Sender: MN690005005664215018 (ДҮГЭРСҮРЭН ӨЛЗИЙХҮҮ)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Temuulen Enkhbat | signals: memo_grade_level, memo_name_initial, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #251 "tuition" 2,500,000 MNT

### Row 454 — 4,250,000 MNT
- Memo: `EB -Nasanbat Alimansaran,5 A (ХУДАЛДАА ХӨГЖЛИЙН БАНК СОСОРБАРАМ ЗУНДУЙ)`
- Sender: MN750004000458155411 (СОСОРБАРАМ ЗУНДУЙ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Alimansaran Nasanbat | signals: memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1309 "tuition" 4,250,000 MNT

### Row 455 — 375,000 MNT
- Memo: `АВТОБУС-Б.МАНДУХАЙ 8D АНГИ (ХААН БАНК АЛТАНХУЯГ ЗУЛГЭРЭЛ)`
- Sender: MN130005005003624395 (АЛТАНХУЯГ ЗУЛГЭРЭЛ)
- Tier: **attention** (missing_charge)
- Status: **matched** (2 proposal(s))
  - → Mandukhai Batbayar | signals: memo_grade_class, memo_grade_level, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Mandukhai Altanbumba | signals: memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 456 — 375,000 MNT
- Memo: `BUS 4SA ODMAA OYUTDARI (ГОЛОМТ БАНК ARIUNJARGAL PUREVDORJ)`
- Sender: MN130015001605272060 (ARIUNJARGAL PUREVDORJ)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Oyutdari Odmaa | signals: memo_grade_class, memo_name_full, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 457 — 375,000 MNT
- Memo: `BUS - ENERELT ENKHBAYAR 9C (ХААН БАНК БАЯРСАЙХАН ЭНХБАЯР)`
- Sender: MN180005005000903164 (БАЯРСАЙХАН ЭНХБАЯР)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Enerelt Enkhbayar | signals: memo_grade_class, memo_name_full, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 458 — 375,000 MNT
- Memo: `WILLIAM SHATWELL 5MA (ХААН БАНК ОЮУН ЗОЛЗАЯА)`
- Sender: MN790005005112440814 (ОЮУН ЗОЛЗАЯА)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → William Shatwell | signals: memo_grade_class, memo_name_full, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 459 — 375,000 MNT
- Memo: `LEWIS SHATWELL 8E (ХААН БАНК ОЮУН ЗОЛЗАЯА)`
- Sender: MN790005005112440814 (ОЮУН ЗОЛЗАЯА)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Lewis Shatwell | signals: memo_grade_class, memo_name_full, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 460 — 375,000 MNT
- Memo: `#4 АВТАБУС 5TA O.TUGULDUR (ХААН БАНК РАДНАА ОДОНЧИМЭГ)`
- Sender: MN480005005030563187 (РАДНАА ОДОНЧИМЭГ)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Tuguldur Odonchimeg | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 461 — 1,700,000 MNT
- Memo: `TUGULDUR TSELMEG 3? 2026-2027, REGIST FEE (ХААН БАНК ТӨМӨРХҮҮ ЦЭЛМЭГ)`
- Sender: MN200005005003801682 (ТӨМӨРХҮҮ ЦЭЛМЭГ)
- Tier: **attention** (low_confidence)
- Status: **low_confidence** (2 proposal(s))
  - → Tselmeg Delgerdalai | signals: memo_grade_wildcard, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #715 "tuition" 1,700,000 MNT
  - → Tuguldur-Uils Munkhbadrakh | signals: memo_grade_wildcard, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1142 "tuition" 1,700,000 MNT

### Row 462 — 375,000 MNT
- Memo: `АВТОБУС - Б.ЭРХСОЁРХУУН 10С (ГОЛОМТ БАНК БАТЗОРИГ ЭНХБОЛД)`
- Sender: MN050015002705014845 (БАТЗОРИГ ЭНХБОЛД)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Erkhsoyorkhuun Batzorig | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 463 — 375,000 MNT
- Memo: `АВТОБУС - Б.ЭРХМАНДУУН 8E (ГОЛОМТ БАНК БАТЗОРИГ ЭНХБОЛД)`
- Sender: MN050015002705014845 (БАТЗОРИГ ЭНХБОЛД)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Erkhmanduun Batzorig | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 464 — 375,000 MNT
- Memo: `АВТОБУС - Б.ЭРХНОМУУН 5CB (ГОЛОМТ БАНК БАТЗОРИГ ЭНХБОЛД)`
- Sender: MN050015002705014845 (БАТЗОРИГ ЭНХБОЛД)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Erkhnomuun Batzorig | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 465 — 5,000,000 MNT
- Memo: `12С НОМИН ЧОЙЖАЛБУУ (ХААН БАНК МОЛОМЖАМЦ ЧОЙЖАЛБУУ)`
- Sender: MN320005005060004236 (МОЛОМЖАМЦ ЧОЙЖАЛБУУ)
- Tier: **confident** (confident)
- Status: **matched** (2 proposal(s))
  - → Nomin Choijalbuu | signals: memo_grade_class, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1042 "tuition" 5,000,000 MNT
  - → Nomin-erdene Ariunjargal | signals: memo_grade_class, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #342 "tuition" 5,000,000 MNT

### Row 466 — 0 MNT
- Memo: `Эм хангамж авахад  (ГОЛОМТ БАНК МОНОС УЛААНБААТАР ХХК)`
- Sender: MN340015001601178961 (МОНОС УЛААНБААТАР ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 467 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[200.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 468 — 375,000 MNT
- Memo: `BUS 3SE DAVAA-OCHIR (ХААН БАНК САМБУУДОРЖ ЗОЛЗАЯА)`
- Sender: MN710005005020815049 (САМБУУДОРЖ ЗОЛЗАЯА)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Davaa-Ochir Ariunbayar | signals: memo_grade_class, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 469 — 255,000 MNT
- Memo: `MINA CHUNG, 4MK, ART CLUB (ХААН БАНК SHIN SE HYUN)`
- Sender: MN220005005107139141 (SHIN SE HYUN)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Mina Chung | signals: memo_grade_class, memo_name_full, fee_hint_explicit
    - alloc charge #1453 "Art KS2 /Term 4/" 255,000 MNT

### Row 470 — 360,000 MNT
- Memo: `E.ANIRLAN 6E ANGI MATEMATICK DUGUILAN (M BANK СҮХБААТАР ГАНЧИМЭГ)`
- Sender: MN380039008888888666 (СҮХБААТАР ГАНЧИМЭГ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Anirlan Erdenebayar | signals: memo_grade_class, memo_grade_level, memo_name_initial, memo_name_partial
    - alloc charge #1403 "Math's club /Oliver/ Term 4 Tue, Thu" 360,000 MNT

### Row 471 — 255,000 MNT
- Memo: `EANIRLAN 6E ANGI GAR BUMBUG DUGUILAN (M BANK СҮХБААТАР ГАНЧИМЭГ)`
- Sender: MN380039008888888666 (СҮХБААТАР ГАНЧИМЭГ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Anirlan Erdenebayar | signals: memo_grade_class, memo_grade_level, memo_name_fuzzy, fee_hint_explicit
    - alloc charge #1404 "Volleyball 11 am to 1pm Term 4" 255,000 MNT

### Row 472 — 375,000 MNT
- Memo: `BUS- 9B Б.СҮНЖИДМАА (ХААН БАНК ЭНХТАЙВАН ОДМАА)`
- Sender: MN110005005006297169 (ЭНХТАЙВАН ОДМАА)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Sunjidmaa Batsaikhan | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 473 — 0 MNT
- Memo: `Данс хоорондын гүйлгээ (ГОЛОМТ БАНК И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ ХХК)`
- Sender: MN320015001205100740 (И ЭС ЭМ ОЛОН УЛСЫН ДУНД СУРГУУЛЬ ХХК)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 474 — 0 MNT
- Memo: `БАНК ХООРОНД БЭЛЭН БУС ГҮЙЛГЭЭНИЙ ШИМТГЭЛ/ IBANK/:[400.00MNT] /431208`
- Sender: FEE
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 475 — 375,000 MNT
- Memo: `EB -bus Sarnai 5MA (ХУДАЛДАА ХӨГЖЛИЙН БАНК ОРГИЛМАА ДАШНЯМ)`
- Sender: MN780004000432015118 (ОРГИЛМАА ДАШНЯМ)
- Tier: **attention** (missing_charge)
- Status: **matched** (2 proposal(s))
  - → Sarnai Bat-Orshikh | signals: memo_grade_class, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Sarnai Sainbileg | signals: memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 476 — 375,000 MNT
- Memo: `EB-BUS B.CHINHUSEL 5CB (ХААН БАНК МЯДАГСҮРЭН ЭРДЭНЭБИЛЭГ)`
- Sender: MN350005005427022015 (МЯДАГСҮРЭН ЭРДЭНЭБИЛЭГ)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Chinkhusel Battushig | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 477 — 35,850,000 MNT
- Memo: `Сургалтын төлбөр Б.Ананд Б.Намулан (КАПИТРОН БАНК МГБИ ХХК)`
- Sender: MN670030003026049999 (МГБИ ХХК)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (4 proposal(s))
  - → Namulan Battuvshin | signals: memo_name_initial, memo_name_partial, fee_hint_explicit | flags: overpayment
    - alloc charge #433 "tuition" 35,850,000 MNT
  - → Anand Battuvshin | signals: memo_name_initial, memo_name_partial, fee_hint_explicit | flags: overpayment
    - alloc charge #297 "tuition" 35,850,000 MNT
  - → Anand Bayarsaikhan | signals: memo_name_initial, memo_name_partial, fee_hint_explicit | flags: overpayment
    - alloc charge #366 "tuition" 35,850,000 MNT
  - → Anand Battogtokh | signals: memo_name_initial, memo_name_partial, fee_hint_explicit | flags: overpayment
    - alloc charge #420 "tuition" 35,850,000 MNT

### Row 478 — 35,850,000 MNT
- Memo: `Сургалтын төлбөр Б.Батул Б.Жамул (КАПИТРОН БАНК МГБИ ХХК)`
- Sender: MN670030003026049999 (МГБИ ХХК)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (2 proposal(s))
  - → Jamul Batjargal | signals: memo_name_initial, memo_name_partial, fee_hint_explicit | flags: overpayment
    - alloc charge #23 "tuition" 35,850,000 MNT
  - → Batul Batjargal | signals: memo_name_initial, memo_name_partial, fee_hint_explicit | flags: overpayment
    - alloc charge #314 "tuition" 35,850,000 MNT

### Row 479 — 375,000 MNT
- Memo: `EB -BUS, Ariuntengis.A, 4MK (ХУДАЛДАА ХӨГЖЛИЙН БАНК ХИШИГЖАРГАЛ ПҮРЭВ)`
- Sender: MN510004000499139313 (ХИШИГЖАРГАЛ ПҮРЭВ)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Ariuntengis Ariunbold | signals: memo_grade_class, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 480 — 300,000 MNT
- Memo: `EB -Ariuntengis A, 4MK, Basketball club term4 (ХУДАЛДАА ХӨГЖЛИЙН БАНК ХИШИГЖАРГАЛ ПҮРЭВ)`
- Sender: MN510004000499139313 (ХИШИГЖАРГАЛ ПҮРЭВ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Ariuntengis Ariunbold | signals: memo_grade_class, memo_name_partial, fee_hint_explicit
    - alloc charge #1503 "Basketball 3-5 /Term 4/" 300,000 MNT

### Row 481 — 375,000 MNT
- Memo: `4SA, BAT-ORGIL.YO (ГОЛОМТ БАНК СУВДАА ЭРДЭНЭБАЯР)`
- Sender: MN070015002025105337 (СУВДАА ЭРДЭНЭБАЯР)
- Tier: **attention** (missing_charge)
- Status: **matched** (5 proposal(s))
  - → Bat-Orgil Yondonnorov | signals: memo_grade_class, memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Thea Peh Yu Ting, Ninjin Odgerel | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → En Yu Bao | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Sorshur Bat-Orgil | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Giisem Bat-Orgil | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 482 — 375,000 MNT
- Memo: `5MA, NARANBAATAR.YO (ГОЛОМТ БАНК СУВДАА ЭРДЭНЭБАЯР)`
- Sender: MN070015002025105337 (СУВДАА ЭРДЭНЭБАЯР)
- Tier: **attention** (missing_charge)
- Status: **matched** (5 proposal(s))
  - → Naranbaatar Yondonnorov | signals: memo_grade_class, memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Thea Peh Yu Ting, Ninjin Odgerel | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → En Yu Bao | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Sara Yu | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Enkhujin Naranbaatar | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 483 — 375,000 MNT
- Memo: `АВТОБУС, ODKHUU NOMINZUL 8A (ГОЛОМТ БАНК ОДХҮҮ ЭНХТАЙВАН)`
- Sender: MN870015002205104178 (ОДХҮҮ ЭНХТАЙВАН)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Nominzul Odkhuu | signals: memo_grade_class, memo_name_full, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 484 — 2,400,000 MNT
- Memo: `EB -Бодьхүү овогтой Ариунгоо 1-р анги (ХУДАЛДАА ХӨГЖЛИЙН БАНК БОДЬХҮҮ ЗОРИГТ)`
- Sender: MN720004000419037014 (БОДЬХҮҮ ЗОРИГТ)
- Tier: **attention** (flagged)
- Status: **matched** (4 proposal(s))
  - → Ariungoo Bodikhuu | signals: memo_grade_level, memo_name_partial, memo_name_fuzzy, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1178 "tuition" 2,400,000 MNT
  - → Ariungoo Erdenekhuu | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1145 "tuition" 2,400,000 MNT
  - → Ariungoo Ariunbold | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1208 "tuition" 2,400,000 MNT
  - → Zalaa Boldkhuu | signals: memo_grade_level, memo_name_fuzzy, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1066 "tuition" 2,400,000 MNT

### Row 485 — 300,000 MNT
- Memo: `YI JI DA ER HAN（EDA）/5TA/FOOTBALL (ГОЛОМТ БАНК MENGGENQIQIGE XXX)`
- Sender: MN240015001205256569 (MENGGENQIQIGE XXX)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (3 proposal(s))
  - → Yi Bo / Tergel Gong | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Cha yi ru ma /Tsakhirmaa Bai wu en qi | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Yi Ergui . | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 486 — 375,000 MNT
- Memo: `BUS- TS. OYUNBILGUUN-8D (ХААН БАНК БӨХХУЯГ ХИШИГЖАРГАЛ)`
- Sender: MN610005005058097373 (БӨХХУЯГ ХИШИГЖАРГАЛ)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Oyunbilguun Tserenjamts | signals: memo_grade_class, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 487 — 1,125,000 MNT
- Memo: `BUS12 Х. ЕСҮХЭЙ, ЕСҮЙ, ЕСҮТЭЙ (ХААН БАНК БАТМӨНХ БААСАНСҮРЭН)`
- Sender: MN150005005653323375 (БАТМӨНХ БААСАНСҮРЭН)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (5 proposal(s))
  - → Yesui Kherlen | signals: memo_name_partial, memo_name_fuzzy, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1364 "tuition" 1,125,000 MNT
  - → Esutei Kherlen | signals: memo_name_fuzzy, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1362 "tuition" 1,125,000 MNT
  - → Yesui Ichinnorov | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #111 "tuition" 1,125,000 MNT
  - → Yesui Batsukh | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1033 "tuition" 1,125,000 MNT
  - → Yesui Munkh-Erdene | signals: memo_name_partial | flags: no_open_charges
    - (no allocation)

### Row 488 — 375,000 MNT
- Memo: `3TM B.GUNBILIG BUS (ГОЛОМТ БАНК ХАНДМАА ЁНДОН)`
- Sender: MN820015002105106289 (ХАНДМАА ЁНДОН)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Gunbilig Batsaikhan | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 489 — 300,000 MNT
- Memo: `ENKHTUVSHIN ENERLEN 3SE BASKETBALL (ХААН БАНК ЮРА УЯНГА)`
- Sender: MN470005005102081014 (ЮРА УЯНГА)
- Tier: **attention** (unbalanced)
- Status: **matched** (3 proposal(s))
  - → Enerlen Enkhtuvshin | signals: memo_grade_class, memo_name_full, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Biligt Enkhtuvshin | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Azjargal Enkhtuvshin | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 490 — 300,000 MNT
- Memo: `TUGULDUR.JAMSRANJAV BASKETBALL (ХААН БАНК ГАНБААТАР БАЯРЧИМЭГ)`
- Sender: MN500005005954217424 (ГАНБААТАР БАЯРЧИМЭГ)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (2 proposal(s))
  - → Tuguldur Jamsranjav | signals: memo_name_full, fee_hint_explicit
    - alloc charge #1504 "Basketball 3-5 /Term 4/" 300,000 MNT
  - → Temuulen Jamsranjav | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 491 — 12,350,000 MNT
- Memo: `ERKHEMBILEG Burenjargal 4RR grade_TUITION FEE`
- Sender: MN290034340702073250 (УРАН БАТХУЯГ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Erkhembileg Burenjargal | signals: memo_grade_class, memo_grade_level, memo_name_full, fee_hint_explicit | flags: partial_payment
    - alloc charge #368 "tuition" 12,350,000 MNT

### Row 492 — 375,000 MNT
- Memo: `МӨНГӨНХӨЛӨГ АНУ-ҮЖИН 11Д АНГИ (ХААН БАНК ПАЛАМ ДУЛАМСҮРЭН)`
- Sender: MN020005005077297451 (ПАЛАМ ДУЛАМСҮРЭН)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Anu-Ujin Mungunkhulug | signals: memo_grade_class, memo_grade_level, memo_name_full, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 493 — 375,000 MNT
- Memo: `EB -9 D Anir (ХУДАЛДАА ХӨГЖЛИЙН БАНК БАТСАЙХАН АНАНД)`
- Sender: MN030004000495019908 (БАТСАЙХАН АНАНД)
- Tier: **attention** (missing_charge)
- Status: **matched** (5 proposal(s))
  - → Anir Batsaikhan | signals: memo_grade_class, memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Anir-Erdene Munkhzaya | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Anir Otgonchuluun | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Anir Bum-Erdene | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Anir Batbayar | signals: memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 494 — 5,000,000 MNT
- Memo: `Lkhagvadorj Misheel 10A-angi (ХАС БАНК ЛХАГВАДОРЖ ЧУЛУУНБАТ)`
- Sender: MN550032005005734367 (ЛХАГВАДОРЖ ЧУЛУУНБАТ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Misheel lkhagvadorj | signals: memo_grade_class, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #840 "tuition" 5,000,000 MNT

### Row 495 — 255,000 MNT
- Memo: `ЧАМИН-ЭРДЭНЭ 5КО 99101969 (ХААН БАНК ХИШГЭЭ АЛТАНЗУЛ)`
- Sender: MN180005005400906138 (ХИШГЭЭ АЛТАНЗУЛ)
- Tier: **confident** (confident)
- Status: **matched** (3 proposal(s))
  - → Chamin-Erdene Chinzorig | signals: memo_grade_class, memo_name_partial
    - alloc charge #1636 "Art KS2 /Term 4/" 255,000 MNT
  - → Hovor-Erdene Dorjbat | signals: memo_grade_class, memo_name_partial | flags: manual_review
    - (no allocation)
  - → Khash-Erdene Erdenebayar | signals: memo_grade_class, memo_name_partial | flags: manual_review
    - (no allocation)

### Row 496 — 1,505,715 MNT
- Memo: `GAQIURI 3PER 4D SEASON (ХААН БАНК TE RIGELE)`
- Sender: MN770005005664561067 (TE RIGELE)
- Tier: **attention** (low_confidence)
- Status: **low_confidence** (1 proposal(s))
  - → Qiuri Ga | signals: memo_name_fuzzy, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1369 "tuition" 1,505,715 MNT

### Row 497 — 285,000 MNT
- Memo: `Ё.ЭНГҮҮН 2GS БАЛЕТ ДУГУЙЛАН (ХААН БАНК ЖООНГОЙ АЛТАНТУЯА)`
- Sender: MN900005005026505406 (ЖООНГОЙ АЛТАНТУЯА)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (5 proposal(s))
  - → Enguun Yondonbat | signals: memo_grade_class, memo_name_partial, fee_hint_explicit
    - alloc charge #1695 "Ballet Mon, Wed Term 4" 285,000 MNT
  - → Thea Peh Yu Ting, Ninjin Odgerel | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → En Yu Bao | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Sara Yu | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Julian Enguun Mergen | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 498 — 375,000 MNT
- Memo: `С.ОЧИР-ЭРДЭНЭ 7-Р АНГИ 4-Р УЛИРАЛ АВТОБУСНЫ ТӨЛБӨР (ХААН БАНК ЛХАГВАСҮРЭН СҮМБАНД)`
- Sender: MN680005005116018081 (ЛХАГВАСҮРЭН СҮМБАНД)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Ochir-erdene Sumband | signals: memo_grade_level, memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 499 — 255,000 MNT
- Memo: `EB -YiErgui-6B，volleyball (ХУДАЛДАА ХӨГЖЛИЙН БАНК TANG HAI)`
- Sender: MN020004000821054192 (TANG HAI)
- Tier: **attention** (unmatched)
- Status: **unmatched** (no_candidates)

### Row 500 — 375,000 MNT
- Memo: `AMAR GUNJINLKHAM 12D (ХААН БАНК НУУРХҮҮ АМАР)`
- Sender: MN680005005361028441 (НУУРХҮҮ АМАР)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Gunjinlkham Amar | signals: memo_grade_class, memo_name_full, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 501 — 375,000 MNT
- Memo: `12C AMIRLIN.M TERM 4 BUS (ХААН БАНК ҮҮРЦАЙХ МӨНХБАТ)`
- Sender: MN400005005070457491 (ҮҮРЦАЙХ МӨНХБАТ)
- Tier: **attention** (missing_charge)
- Status: **matched** (2 proposal(s))
  - → Amirlin Munkhbat | signals: memo_grade_class, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Amirlin Munkhbayar | signals: memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 502 — 300,000 MNT
- Memo: `art club. Tsegts`
- Sender: MN130034103100322696 (АЛТАНГАДАС ЭРДЭНЭБАЛ)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (2 proposal(s))
  - → Tsegts Munkhtsooj | signals: memo_name_partial, fee_hint_explicit
    - alloc charge #1545 "Art KS1 /Term 4/" 300,000 MNT
  - → Tsegts Chinzorigt | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 503 — 690,000 MNT
- Memo: `DORJCHIMID MISHEEL 3VO HOMEWORK CLUB (ХААН БАНК МӨНХБАЯР СОЛОНГО)`
- Sender: MN150005005003523964 (МӨНХБАЯР СОЛОНГО)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Dorjchimid Misheel | signals: memo_grade_class, memo_name_full, fee_hint_explicit | flags: overpayment
    - alloc charge #1496 "HW GR 3-5 Term 4" 690,000 MNT

### Row 504 — 342,000 MNT
- Memo: `KIM MINA 11C (ХААН БАНК KIM JONG OK)`
- Sender: MN530005005111170970 (KIM JONG OK)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (5 proposal(s))
  - → Min A Kim | signals: memo_grade_class, memo_name_partial
    - alloc charge #1425 "Math's club /Jamsran/ Term 4 Mon, Wed" 342,000 MNT
  - → Mina Chung | signals: memo_name_partial | flags: manual_review
    - (no allocation)
  - → Mina Urantuya | signals: memo_name_partial | flags: manual_review
    - (no allocation)
  - → JuHan Kim | signals: memo_name_partial | flags: manual_review
    - (no allocation)
  - → Yowon Kim | signals: memo_name_partial | flags: manual_review
    - (no allocation)

### Row 505 — 375,000 MNT
- Memo: `6A CHULUUNBAATAR ENEREL BUS TULBUR (ХААН БАНК ХУТАГ ЧАНЦАЛ)`
- Sender: MN790005005920040407 (ХУТАГ ЧАНЦАЛ)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Enerel Chuluunbaatar | signals: memo_grade_class, memo_name_full, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 506 — 690,000 MNT
- Memo: `O.MERGEN 2OB ГЭРИЙН ДААЛГАВАР (ХААН БАНК ГАНЗОРИГ ОРГИЛЦЭЦЭГ)`
- Sender: MN110005005026382959 (ГАНЗОРИГ ОРГИЛЦЭЦЭГ)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Mergen Orgiltsetseg | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit | flags: overpayment
    - alloc charge #1713 "HW GR 2 Term 4" 690,000 MNT

### Row 507 — 750,000 MNT
- Memo: `АВТОБУС-Ч.ЭНЭРЛИН 6B, Ч.ГЭГЭЭЛИН 2GS (ГОЛОМТ БАНК БОЛОР-ЭРДЭНЭ ЛХАГВАДОРЖ)`
- Sender: MN130015005270001997 (БОЛОР-ЭРДЭНЭ ЛХАГВАДОРЖ)
- Tier: **attention** (multi_student)
- Status: **matched_multi** (total 750,000 MNT)
  - → Enerlin Chinbat
    - alloc charge #-1 "?" 375,000 MNT
  - → Gegeelin Chinbat
    - alloc charge #-1 "?" 375,000 MNT

### Row 508 — 1,000,000 MNT
- Memo: `Б.ТӨГСЦОГТ 12C ТӨЛБӨРИЙН ҮЛДЭГДЭЛ (ХААН БАНК ГОНЧИГ ОЮУНЦЭЦЭГ)`
- Sender: MN360005005003294569 (ГОНЧИГ ОЮУНЦЭЦЭГ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Tugstsogt Bat-orshikh | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #345 "tuition" 1,000,000 MNT

### Row 509 — 500,000 MNT
- Memo: `TUITION 10C М.ТӨГӨЛДӨР 91918882 (ХААН БАНК БАТ-ЭРДЭНЭ ОЮУ-ЭРДЭНЭ)`
- Sender: MN870005005021615108 (БАТ-ЭРДЭНЭ ОЮУ-ЭРДЭНЭ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Tuguldur Munkhbat | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1131 "tuition" 500,000 MNT

### Row 510 — 375,000 MNT
- Memo: `АВТОБУС АЗЖАРГАЛЫН АНАНД 8 В АНГИ (ХААН БАНК ЛХАГВАЖАВ АЗЖАРГАЛ)`
- Sender: MN630005005029629292 (ЛХАГВАЖАВ АЗЖАРГАЛ)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Anand Azjargal | signals: memo_grade_class, memo_grade_level, memo_name_full, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 511 — 375,000 MNT
- Memo: `АВТОБУС АЗЖАРГАЛЫН АНАР 9 D АНГИ (ХААН БАНК ЛХАГВАЖАВ АЗЖАРГАЛ)`
- Sender: MN630005005029629292 (ЛХАГВАЖАВ АЗЖАРГАЛ)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Anar Azjargal | signals: memo_grade_class, memo_grade_level, memo_name_full, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 512 — 375,000 MNT
- Memo: `АВТОБУС АЗЖАРГАЛЫН ИНДРА 5 CB АНГИ (ХААН БАНК ЛХАГВАЖАВ АЗЖАРГАЛ)`
- Sender: MN630005005029629292 (ЛХАГВАЖАВ АЗЖАРГАЛ)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Indra Azjargal | signals: memo_grade_class, memo_grade_level, memo_name_full, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 513 — 375,000 MNT
- Memo: `АВТОБУС АЗЖАРГАЛЫН АРИУНЗУЛ 3 SE (ХААН БАНК ЛХАГВАЖАВ АЗЖАРГАЛ)`
- Sender: MN630005005029629292 (ЛХАГВАЖАВ АЗЖАРГАЛ)
- Tier: **attention** (missing_charge)
- Status: **matched** (2 proposal(s))
  - → Ariunzul Azjargal | signals: memo_grade_class, memo_name_full, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Azjargal Enkhtuvshin | signals: memo_grade_class, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 514 — 375,000 MNT
- Memo: `EB -О.Бэхболд 11D (ХУДАЛДАА ХӨГЖЛИЙН БАНК ОДГЭРЭЛ ПҮРЭВДОЛГОР)`
- Sender: MN840004000499148322 (ОДГЭРЭЛ ПҮРЭВДОЛГОР)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Bekhbold Odgerel | signals: memo_grade_class, memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 515 — 375,000 MNT
- Memo: `EB -Isabella Ujin 8B bus payment (ХУДАЛДАА ХӨГЖЛИЙН БАНК ЭРДЭНЭТУЯА БАДАМРАА)`
- Sender: MN700004000452070303 (ЭРДЭНЭТУЯА БАДАМРАА)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Isabella Ujin Guy | signals: memo_grade_class, memo_name_full, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 516 — 690,000 MNT
- Memo: `2LB MUNKHDUL ENGUUNGOO HOMEWORK CLUB (ХААН БАНК ХЭНЗБАТ БАТ-ОЮУН)`
- Sender: MN200005005001432263 (ХЭНЗБАТ БАТ-ОЮУН)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Enguungoo Munkhdul | signals: memo_grade_class, memo_name_full, fee_hint_explicit | flags: overpayment
    - alloc charge #1629 "HW GR 2 Term 4" 690,000 MNT

### Row 517 — 375,000 MNT
- Memo: `D.SUGARGEREL 10B ANGI (ХААН БАНК БИЛЭГТ ДАШДАВАА)`
- Sender: MN550005005174035664 (БИЛЭГТ ДАШДАВАА)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Sugargerel Dashdavaa | signals: memo_grade_class, memo_grade_level, memo_name_initial, memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 518 — 375,000 MNT
- Memo: `АВТОБУС - ХАДААН МИШЭЭЛ, 5MA - 4Р УЛИРАЛ (ХААН БАНК ДАВААСАМБУУ ХАДААН)`
- Sender: MN070005005028627999 (ДАВААСАМБУУ ХАДААН)
- Tier: **attention** (missing_charge)
- Status: **matched** (3 proposal(s))
  - → Misheel Khadaan | signals: memo_grade_class, memo_name_full, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Khadaan Turjargal | signals: memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Khadaan Oyunbaatar | signals: memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 519 — 300,000 MNT
- Memo: `EB -B.Michidbaatar. 4 BE. Сагсан бөмбөг дугуйлан (ХУДАЛДАА ХӨГЖЛИЙН БАНК НАРАНЦЭЦЭГ ОЮУНГЭРЭЛ)`
- Sender: MN270004000495106485 (НАРАНЦЭЦЭГ ОЮУНГЭРЭЛ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Michidbaatar Battogtokh | signals: memo_grade_level, memo_name_partial, fee_hint_explicit
    - alloc charge #1520 "Basketball 3-5 /Term 4/" 300,000 MNT

### Row 520 — 690,000 MNT
- Memo: `1JA D. Ariunjargal home work`
- Sender: MN160034109000110768 (БАЯРМАА МИШИГДОРЖ)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Ariunjargal Dashdendev | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit | flags: overpayment
    - alloc charge #1665 "HW GR1 Term 4" 690,000 MNT

### Row 521 — 375,000 MNT
- Memo: `EB -Bus-Enerel Demiddoo 4RR (ХУДАЛДАА ХӨГЖЛИЙН БАНК ДЭМИДДОО ЦЭДЭВСҮРЭН)`
- Sender: MN050004000423047133 (ДЭМИДДОО ЦЭДЭВСҮРЭН)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Enerel Demiddo | signals: memo_grade_class, memo_name_partial, memo_name_fuzzy, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 522 — 50,000 MNT
- Memo: `Э.УХААНЗАЯА 5TA (ХААН БАНК ӨЛЗИЙСАЙХАН ЭРДЭНЭСАЙХАН)`
- Sender: MN230005005027778767 (ӨЛЗИЙСАЙХАН ЭРДЭНЭСАЙХАН)
- Tier: **attention** (unbalanced)
- Status: **matched** (1 proposal(s))
  - → Ukhaanzaya Erdenesaikhan | signals: memo_grade_class, memo_name_fuzzy | flags: manual_review
    - (no allocation)

### Row 523 — 375,000 MNT
- Memo: `EB -автус. 6E Баатарын Адъяа (ХУДАЛДАА ХӨГЖЛИЙН БАНК БӨРТЭ-ҮЖИН БАДРАЛ)`
- Sender: MN620004000472078734 (БӨРТЭ-ҮЖИН БАДРАЛ)
- Tier: **attention** (missing_charge)
- Status: **matched** (2 proposal(s))
  - → Adiya Baatar | signals: memo_grade_class, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Baatar Boldtseren | signals: memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 524 — 690,000 MNT
- Memo: `ANKHILUUN MORSAL SHAH MOHAMMAD 2ABHOMEWORK CLUB (ХААН БАНК ДАЯНЖАВ ЛХАГВА)`
- Sender: MN650005005042341300 (ДАЯНЖАВ ЛХАГВА)
- Tier: **attention** (unbalanced)
- Status: **matched** (1 proposal(s))
  - → Ankhiluun Morsal Shakh Mokhammad | signals: memo_grade_class, memo_name_full | flags: manual_review
    - (no allocation)

### Row 525 — 600,000 MNT
- Memo: `EB -T.Nandin-Erdene 1JA Ballet (ХУДАЛДАА ХӨГЖЛИЙН БАНК ТҮШИГ ЭРХЭМБАЯР)`
- Sender: MN350004000411034598 (ТҮШИГ ЭРХЭМБАЯР)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (5 proposal(s))
  - → Nandin-Erdene Tushig | signals: memo_grade_class, memo_name_partial, fee_hint_explicit
    - alloc charge #1490 "Ballet Tue, Thu Term 4" 600,000 MNT
  - → Amin-Erdene Erdenejargal | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Nandin-Erdene Sukhbaatar | signals: memo_name_partial, fee_hint_explicit | flags: overpayment
    - alloc charge #1429 "Volleyball 11 am to 1pm Term 4" 255,000 MNT
  - → Erkhtsolmon Nandin-Erdene | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Nandin-Erdene Enkhbayar | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 526 — 3,000,000 MNT
- Memo: `АРУУХАН 1BO TUITION (ГОЛОМТ БАНК ОЮУНГЭРЭЛ БАЛДАНГОМБО)`
- Sender: MN570015001175147175 (ОЮУНГЭРЭЛ БАЛДАНГОМБО)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (2 proposal(s))
  - → Yi Bo / Tergel Gong | signals: memo_grade_level, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #689 "tuition" 3,000,000 MNT
  - → Aruukhan Ganbayar | signals: memo_grade_level, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1184 "tuition" 3,000,000 MNT

### Row 527 — 375,000 MNT
- Memo: `EB -bus 6D Enkh-Enerel 4r uliral (ХУДАЛДАА ХӨГЖЛИЙН БАНК ОЮУМАА СҮРЭНЖАВ)`
- Sender: MN680004000821021188 (ОЮУМАА СҮРЭНЖАВ)
- Tier: **attention** (missing_charge)
- Status: **matched** (3 proposal(s))
  - → Enkh-Enerel Ankhbayar | signals: memo_grade_class, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Enerel Enkhjargal | signals: memo_grade_class, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Tugs-Enerel Damdinpurev | signals: memo_grade_class, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 528 — 800,000 MNT
- Memo: `1JK JARGALAN O, 3TM GALDAN O (ГОЛОМТ БАНК БОЛОР ЧОЙДОГЖАМЦ)`
- Sender: MN930015002705105411 (БОЛОР ЧОЙДОГЖАМЦ)
- Tier: **attention** (multi_student)
- Status: **matched_multi** (total 800,000 MNT)
  - → Jargalan Otgonsuren
    - alloc charge #1494 "Taekwondo Term 4 /Grade 1-5/" 400,000 MNT
  - → Galdan Otgonsuren
    - alloc charge #1500 "Taekwondo Term 4 /Grade 1-5/" 400,000 MNT

### Row 529 — 342,000 MNT
- Memo: `EB -Sheroz Saidkhadzhaev, 7C, Math’s Club Joel teacher (ХУДАЛДАА ХӨГЖЛИЙН БАНК FIRUZ SAIDKHADZHAEV)`
- Sender: MN300004000404341591 (FIRUZ SAIDKHADZHAEV)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Sheroz Saidkhadzhaev | signals: memo_grade_class, memo_name_full, fee_hint_explicit
    - alloc charge #1706 "Math's club /Joel/ Term 4 Mon, Wed" 342,000 MNT

### Row 530 — 375,000 MNT
- Memo: `TSOGJARGAL BATDELGER 5IA (ХААН БАНК НЯМХҮҮ БАТДЭЛГЭР)`
- Sender: MN420005005169648103 (НЯМХҮҮ БАТДЭЛГЭР)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Tsogjargal Batdelger | signals: memo_grade_class, memo_name_full, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 531 — 255,000 MNT
- Memo: `Э.СОЛОНГОО- 4SA /УРАН ЗУРАГ/ 99805775 (ХААН БАНК БАЯНМӨНХ ЦОЛМОНЧИМЭГ)`
- Sender: MN070005005306892384 (БАЯНМӨНХ ЦОЛМОНЧИМЭГ)
- Tier: **confident** (confident)
- Status: **matched** (2 proposal(s))
  - → Sodongoo Enkh-Amgalan | signals: memo_grade_class, memo_name_fuzzy, fee_hint_explicit
    - alloc charge #1511 "Art KS2 /Term 4/" 255,000 MNT
  - → Solongo Enkhbaatar | signals: memo_name_fuzzy, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 532 — 342,000 MNT
- Memo: `Ч. ТОДСАРАН 12В МАТ (ХААН БАНК ЦЭДЭНДАМБА АЛТАНЦЭЦЭГ)`
- Sender: MN390005005019169438 (ЦЭДЭНДАМБА АЛТАНЦЭЦЭГ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Todsaran Chinbat | signals: memo_grade_class, memo_name_partial
    - alloc charge #1423 "Math's club /Jamsran/ Term 4 Mon, Wed" 342,000 MNT

### Row 533 — 750,000 MNT
- Memo: `Ч. ТОДСАРАН 12В, Ч.ХУЛАН 8А BUS (ХААН БАНК ЦЭДЭНДАМБА АЛТАНЦЭЦЭГ)`
- Sender: MN390005005019169438 (ЦЭДЭНДАМБА АЛТАНЦЭЦЭГ)
- Tier: **attention** (multi_student)
- Status: **matched_multi** (total 750,000 MNT)
  - → Todsaran Chinbat
    - alloc charge #-1 "?" 375,000 MNT
  - → Khulan Chinbat
    - alloc charge #-1 "?" 375,000 MNT

### Row 534 — 375,000 MNT
- Memo: `EB -Tsengel TSELMUUN 6C bus fee (ХУДАЛДАА ХӨГЖЛИЙН БАНК ЦЭНГЭЛ ЭНХЦАГ)`
- Sender: MN800004000421035555 (ЦЭНГЭЛ ЭНХЦАГ)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Tselmuun Tsengel | signals: memo_grade_class, memo_name_full, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 535 — 375,000 MNT
- Memo: `EB -Bus- A.Khaidu 7a -4th term (ХУДАЛДАА ХӨГЖЛИЙН БАНК АНУНАРАН АЛТАНГЭРЭЛ)`
- Sender: MN690004000452566476 (АНУНАРАН АЛТАНГЭРЭЛ)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Khaidu Anunaran | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 536 — 375,000 MNT
- Memo: `АВТОБУС 5IA O.AZJARGAL 99171130 (ХААН БАНК СҮХЭЭ БОЛОРСҮХ)`
- Sender: MN410005005021647946 (СҮХЭЭ БОЛОРСҮХ)
- Tier: **attention** (missing_charge)
- Status: **matched** (2 proposal(s))
  - → Azjargal Odkhuu | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Azjargal Ulziikhuu | signals: memo_name_initial, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 537 — 375,000 MNT
- Memo: `АВТОБУС А.ИРМҮҮНТҮШИГ 2AB (ХААН БАНК БАТЧУЛУУН ГАНЧИМЭГ)`
- Sender: MN640005005447409826 (БАТЧУЛУУН ГАНЧИМЭГ)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Irmuuntushig Ariunaa | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 538 — 375,000 MNT
- Memo: `BYEKBOL-12A (ГОЛОМТ БАНК КҮМИСЖАН ХАЛАМ)`
- Sender: MN760015001131000484 (КҮМИСЖАН ХАЛАМ)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Byekbol Tsengel | signals: memo_grade_class, memo_name_partial, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 539 — 3,250,000 MNT
- Memo: `EB -5348218 Amjiltiin ezed-s Ch.Bat-Amgalan 4 (ХУДАЛДАА ХӨГЖЛИЙН БАНК АМЖИЛТЫН ЭЗЭД ХХК)`
- Sender: MN880004000409023416 (АМЖИЛТЫН ЭЗЭД ХХК)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (5 proposal(s))
  - → Soyon Bat-Amgalan | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #148 "tuition" 3,250,000 MNT
  - → Bat-Amgalan Chultemsuren | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1053 "tuition" 3,250,000 MNT
  - → Sodongoo Enkh-Amgalan | signals: memo_grade_level, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #518 "tuition" 3,250,000 MNT
  - → Sonor Munkh-Amgalan | signals: memo_grade_level, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #964 "tuition" 3,250,000 MNT
  - → Gegeen Amgalan | signals: memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #286 "tuition" 3,250,000 MNT

### Row 540 — 750,000 MNT
- Memo: `EB -Н. Баясгалан 12В/ Н. Түшиг 9В автобус (ХУДАЛДАА ХӨГЖЛИЙН БАНК НАРАНДАШ ДАШДАВАА)`
- Sender: MN220004000404216896 (НАРАНДАШ ДАШДАВАА)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (3 proposal(s))
  - → Tushig Narandash | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Bayasgalan Narandash | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Tushig Nyamjargal | signals: memo_name_initial, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 541 — 3,000,000 MNT
- Memo: `9A Ш.ЭРДЭМ СУРГАЛТЫН ТӨЛБӨР (ГОЛОМТ БАНК САЙНБИЛЭГ ЭНХТӨМӨР)`
- Sender: MN380015001105218762 (САЙНБИЛЭГ ЭНХТӨМӨР)
- Tier: **confident** (confident)
- Status: **matched** (5 proposal(s))
  - → Erdem Shinebayar | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #144 "tuition" 3,000,000 MNT
  - → Tsetsen Erdem | signals: memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #532 "tuition" 3,000,000 MNT
  - → Erdem-Agi Bayarbaatar | signals: memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #709 "tuition" 3,000,000 MNT
  - → Erdem-Ochir Munkh-Erdene | signals: memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #869 "tuition" 3,000,000 MNT
  - → Sod-Erdem Anartuguldur | signals: memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #979 "tuition" 3,000,000 MNT

### Row 542 — 10,000 MNT
- Memo: `EB -Amar 12B ID (ХУДАЛДАА ХӨГЖЛИЙН БАНК САРАНТУЯА БААСАНХҮҮ)`
- Sender: MN720004000457026870 (САРАНТУЯА БААСАНХҮҮ)
- Tier: **attention** (unbalanced)
- Status: **matched** (5 proposal(s))
  - → Amar Baasanbat | signals: memo_grade_class, memo_name_partial | flags: manual_review
    - (no allocation)
  - → Amar Anand | signals: memo_name_partial | flags: manual_review
    - (no allocation)
  - → Amar Righu | signals: memo_name_partial | flags: manual_review
    - (no allocation)
  - → Tsogt-Amar Demberel | signals: memo_name_partial | flags: manual_review
    - (no allocation)
  - → Amar Burenjargal | signals: memo_name_partial | flags: manual_review
    - (no allocation)

### Row 543 — 5,000,000 MNT
- Memo: `1PB.ULSBOLD GOOGERELT (ХААН БАНК ОРГИЛ УЛСБОЛД)`
- Sender: MN540005005058576388 (ОРГИЛ УЛСБОЛД)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Googerelt Ulsbold | signals: memo_grade_class, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #683 "tuition" 5,000,000 MNT

### Row 544 — 394,000 MNT
- Memo: `Home work 2 T.MunhkErdene`
- Sender: MN110034312600044882 (ТҮВШИНТӨР МАНДУУЛ)
- Tier: **attention** (low_confidence)
- Status: **low_confidence** (1 proposal(s))
  - → Munkh-Erdene Tuvshintur | signals: memo_grade_level, memo_name_fuzzy, fee_hint_explicit | flags: partial_payment
    - alloc charge #1554 "HW GR 2 Term 4" 394,000 MNT

### Row 545 — 3,134,000 MNT
- Memo: `3? LEE HYEOK TUITION TERM4 (ГОЛОМТ БАНК HOGEUN LEE)`
- Sender: MN750015002705186245 (HOGEUN LEE)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → HYEOK LEE | signals: memo_grade_wildcard, memo_name_full, fee_hint_explicit | flags: partial_payment
    - alloc charge #1231 "tuition" 3,134,000 MNT

### Row 546 — 3,250,000 MNT
- Memo: `DAVAADORJ TSENGUUN 4?B (ХААН БАНК ГАНБААТАР МӨНХЗУЛ)`
- Sender: MN500005005028660302 (ГАНБААТАР МӨНХЗУЛ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Tsenguun Davaadorj | signals: memo_grade_wildcard, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1319 "tuition" 3,250,000 MNT

### Row 547 — 342,000 MNT
- Memo: `EB -E.Enerel 6D math’s club (ХУДАЛДАА ХӨГЖЛИЙН БАНК МӨНХЖАРГАЛ БАЯРСАЙХАН)`
- Sender: MN510004000499202363 (МӨНХЖАРГАЛ БАЯРСАЙХАН)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (3 proposal(s))
  - → Enerel Enkhjargal | signals: memo_grade_class, memo_name_partial, fee_hint_explicit
    - alloc charge #1406 "Math's club /Joel/ Term 4 Mon, Wed" 342,000 MNT
  - → Tugs-Enerel Damdinpurev | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Enkh-Enerel Ankhbayar | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 548 — 4,000,000 MNT
- Memo: `ТӨГӨЛДӨР ТЭМҮҮЖИН ЦЭЦЭРЛЭГ 5?C 99098772 (ХААН БАНК ШАТАР ПҮРЭВДУЛАМ)`
- Sender: MN040005005032392914 (ШАТАР ПҮРЭВДУЛАМ)
- Tier: **attention** (flagged)
- Status: **matched** (1 proposal(s))
  - → Temuujin Tuguldur | signals: memo_grade_wildcard, memo_name_full, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #1345 "tuition" 4,000,000 MNT

### Row 549 — 375,000 MNT
- Memo: `YANJINLKHAM.Z 11C AVTOBUS TULBURT (ГОЛОМТ БАНК ПҮРЭВДУЛАМ БЯМБАСҮРЭН)`
- Sender: MN580015001109135844 (ПҮРЭВДУЛАМ БЯМБАСҮРЭН)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Yanjinlkham Zolbayar | signals: memo_grade_class, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 550 — 510,000 MNT
- Memo: `1JB,E.NARANGOO, HOMEWORK (ХААН БАНК ГАНБОЛД ЭНХ-УЧРАЛ)`
- Sender: MN640005005009314467 (ГАНБОЛД ЭНХ-УЧРАЛ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Narangoo Enkh-Uchral | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1673 "HW GR1 Term 4" 510,000 MNT

### Row 551 — 615,000 MNT
- Memo: `Б.ХУЛАН (ГЭРИЙН ДААЛГАВАР) 99106866 (ХААН БАНК ГАЛСАНДОВЖОО БАТЦЭЦЭГ)`
- Sender: MN970005005035105688 (ГАЛСАНДОВЖОО БАТЦЭЦЭГ)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (2 proposal(s))
  - → Khulan Bat-Orshikh | signals: memo_name_initial, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1575 "HW GR1 Term 4" 615,000 MNT
  - → Khulan Batbayar | signals: memo_name_initial, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 552 — 300,000 MNT
- Memo: `EB -4BA Munkhbadrakh Munkhkhuyag, Football Q4 (ХУДАЛДАА ХӨГЖЛИЙН БАНК МӨНХХУЯГ ГАНХУЯГ)`
- Sender: MN920004000410036121 (МӨНХХУЯГ ГАНХУЯГ)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Munkhbadrakh Munkhkhuyag | signals: memo_grade_class, memo_name_full, fee_hint_explicit
    - alloc charge #1521 "Football GR 3-5 /Term 4/" 300,000 MNT

### Row 553 — 375,000 MNT
- Memo: `12B ENKHBAYAR ENEREL AVTOBUS (ХААН БАНК БОЛД БАДАМ)`
- Sender: MN230005005169119407 (БОЛД БАДАМ)
- Tier: **attention** (missing_charge)
- Status: **matched** (2 proposal(s))
  - → Enerel Enkhbayar | signals: memo_grade_class, memo_name_full, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)
  - → Enkhbayar Otgonbayar | signals: memo_grade_class, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 554 — 315,000 MNT
- Memo: `EB -D.Ninjin, 2LB, homework club (ХУДАЛДАА ХӨГЖЛИЙН БАНК ЭНХТУЯА МӨНХБАТ)`
- Sender: MN110004000842001859 (ЭНХТУЯА МӨНХБАТ)
- Tier: **confident** (confident)
- Status: **matched** (5 proposal(s))
  - → Ninjin Davgadorj | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: partial_payment
    - alloc charge #1668 "HW GR 2 Term 4" 315,000 MNT
  - → Thea Peh Yu Ting, Ninjin Odgerel | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Ninjin Tengis | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Ninjin Khosbayar | signals: memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)
  - → Ninjin Manlaibayar | signals: memo_name_partial, fee_hint_explicit | flags: no_open_charges
    - (no allocation)

### Row 555 — 375,000 MNT
- Memo: `AVTOBUS #8, B.NAMUDARI 7B (ГОЛОМТ БАНК БАТБАЯР ГҮРБАЗАР)`
- Sender: MN340015001105092055 (БАТБАЯР ГҮРБАЗАР)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Namudari Batbayar | signals: memo_grade_class, memo_name_fuzzy, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 556 — 555,000 MNT
- Memo: `HOMEWORK ERKHEMBAYAR IVEEL 1JK (ХААН БАНК ЗУЛХҮҮ АРИУНЖАРГАЛ)`
- Sender: MN420005005176173487 (ЗУЛХҮҮ АРИУНЖАРГАЛ)
- Tier: **confident** (confident)
- Status: **matched** (2 proposal(s))
  - → Iveel Erkhembayar | signals: memo_grade_class, memo_name_full, fee_hint_explicit | flags: partial_payment
    - alloc charge #1646 "HW GR 2 Term 4" 555,000 MNT
  - → Erkhembayar Otgonkhuyag | signals: memo_grade_class, memo_name_partial, fee_hint_explicit | flags: manual_review
    - (no allocation)

### Row 557 — 375,000 MNT
- Memo: `EB -Bus fee B.Tumurbold 10A 9999-0720 (ХУДАЛДАА ХӨГЖЛИЙН БАНК БОЛОР-ЭРДЭНЭ ОТГОНХҮҮ)`
- Sender: MN020004000440000362 (БОЛОР-ЭРДЭНЭ ОТГОНХҮҮ)
- Tier: **attention** (missing_charge)
- Status: **matched** (1 proposal(s))
  - → Tumurbold Bolor-Erdene | signals: memo_grade_class, memo_name_initial, memo_name_partial, fee_hint_explicit, fee_hint_from_amount
    - alloc charge #-1 "?" 375,000 MNT
    - proposes NEW charge "bus" 375,000 MNT (fee_hint_explicit)

### Row 558 — 15,880,000 MNT
- Memo: `2AB Б.БИЛИГТБӨХ, 1JA Б.АЛТАНГҮНЖ ТӨЛБӨР (ХААН БАНК МӨНХЖАРГАЛ БАДАМХАТАН)`
- Sender: MN840005005031657475 (МӨНХЖАРГАЛ БАДАМХАТАН)
- Tier: **attention** (multi_student)
- Status: **matched_multi** (total 15,880,000 MNT)
  - → Biligtbukh Battuvshin
    - alloc charge #951 "tuition" 7,940,000 MNT
  - → Altangunj Battuvshin
    - alloc charge #906 "tuition" 7,940,000 MNT

### Row 559 — 10,000,000 MNT
- Memo: `Б.СОРШҮР, Б.ГИЙСЭМ ТӨЛБӨР (ГОЛОМТ БАНК ОТГОНЧИМЭГ АЛТАНГЭРЭЛ)`
- Sender: MN210015002209262883 (ОТГОНЧИМЭГ АЛТАНГЭРЭЛ)
- Tier: **attention** (multi_student)
- Status: **matched_multi** (total 10,000,000 MNT)
  - → Sorshur Bat-Orgil
    - alloc charge #87 "tuition" 5,000,000 MNT
  - → Giisem Bat-Orgil
    - alloc charge #113 "tuition" 5,000,000 MNT

### Row 560 — 7,500,000 MNT
- Memo: `Б.СОНДОР Б.АНИР 6819974 БАЙГУУЛЛАГААР (ХААН БАНК БАТБОЛД БАТБАЯР)`
- Sender: MN070005005751168292 (БАТБОЛД БАТБАЯР)
- Tier: **attention** (multiple_candidates)
- Status: **matched** (5 proposal(s))
  - → Sondor Batzorig | signals: memo_name_initial, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #489 "tuition" 7,500,000 MNT
  - → Anir Bum-Erdene | signals: memo_name_initial, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #587 "tuition" 7,500,000 MNT
  - → Sondor Batbayar | signals: memo_name_initial, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #763 "tuition" 7,500,000 MNT
  - → Anir Batbayar | signals: memo_name_initial, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #811 "tuition" 7,500,000 MNT
  - → Sondor Batzaya | signals: memo_name_initial, memo_name_partial, fee_inferred_from_amount | flags: fee_inferred_from_amount, partial_payment
    - alloc charge #855 "tuition" 7,500,000 MNT

### Row 561 — 225,000 MNT
- Memo: `9D CHINGUUN (ХААН БАНК ЧОЙДОРЖ МӨНХЗУЛ)`
- Sender: MN320005005006555393 (ЧОЙДОРЖ МӨНХЗУЛ)
- Tier: **attention** (unbalanced)
- Status: **matched** (4 proposal(s))
  - → Chinguun Munkhzul | signals: memo_grade_class, memo_name_partial | flags: manual_review
    - (no allocation)
  - → Chinguun Togtuun | signals: memo_name_partial | flags: manual_review
    - (no allocation)
  - → Chinguun Batbold | signals: memo_name_partial | flags: manual_review
    - (no allocation)
  - → Chinguun Batgerel | signals: memo_name_partial | flags: manual_review
    - (no allocation)

### Row 562 — 255,000 MNT
- Memo: `BAIGUULSAN 7A FOOTBALL (ГОЛОМТ БАНК ADULECAO XXX)`
- Sender: MN550015001175176893 (ADULECAO XXX)
- Tier: **confident** (confident)
- Status: **matched** (1 proposal(s))
  - → Baiguulsan Altan-Uul | signals: memo_grade_class, memo_name_partial, fee_hint_explicit
    - alloc charge #1598 "football GR 6-9 Term 4" 255,000 MNT

### Row 563 — 896,375,713 MNT
- Memo: ``
- Sender: (none)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 564 — 0 MNT
- Memo: ``
- Sender: (none)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)

### Row 565 — 0 MNT
- Memo: ``
- Sender: (none)
- Tier: **filtered** (filtered)
- Status: **unmatched** (filtered)