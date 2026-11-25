# How to write level files

The game reads every `.md` file in the `levels` folder, puts them in filename order, and plays them as workdays at a pixel-art law-office desk. To add, change or remove content, edit the files in `levels`, then double-click **`build.cmd`**. It rebuilds **`Grammar Guide Game.html`** (the one file you hand in) and opens it.

You never need to touch the `engine` folder.

---

## 1. How a day plays

1. **Morning:** each lesson file for the day lands on the desk. The player reads it and files it in the **rulebook** (the blue binder, bottom right).
2. **Clock in:** the shift clock starts (9:00 a.m. by default) and the inbox fills with the day's test items.
3. **Sticky notes** are your multiple-choice questions. A wrong answer costs time.
4. **Documents** are your proofreading passages. The player corrects each wrong word and stamps **RETURN**, or stamps **APPROVE** if nothing is wrong.
5. **End of day:** when the inbox is empty or the clock reaches 5:00 p.m., the player gets a **pay slip** with a score, stars and a note from the boss.

Every player starts each day with **3 hearts**. A wrong stamp loses a heart: approving a document with errors, returning a clean one, or returning one with errors still missed. Losing every heart means "You're fired!", and the player must replay the day. A day is passed with 50% or more (you can change this).

---

## 2. File names

```
00A Tutorial - Welcome.md      ← lesson
00B Tutorial - Practice.md     ← test
01A Fewer vs less.md
01B Fewer vs less - Test.md
...
08B Final boss - Affidavit.md
```

- **The number** is the day. The lowest number is Day 1, the next is Day 2, and so on. Gaps are fine.
- **The letter** sets the order inside a day: `A` before `B` before `C`. By convention, **A = lesson, B = test**. A day can have several lessons or tests. They play in letter order, and all test items go into one inbox.
- Anything after the number and letter is just for you.
- To add a day, add new files (for example `09A`, `09B`). To remove one, delete its files.
- `game.md` holds the game's settings (see section 6). It isn't a day.
- Pictures go in `levels/images`. Use them like this: `![Express-lane sign](images/express-lane.jpg)`. Don't put spaces in picture file names.

---

## 3. The settings block (top of every file)

```
---
Title: Fewer vs. Less
Level: The Supply Order
Document: Email
From: Dana Whitfield, Office Manager
To: You
Subject: Before you place the supply order
---
```

| Line | What it does |
|---|---|
| `Title:` | The lesson's name, shown in the rulebook. |
| `Level:` | The day's name (only needed in one file per day). The game shows "Day 2: The Supply Order". |
| `Document:` | How a lesson looks: `Email`, `Memo`, `Letter` or `Court filing`. |
| `Pass:` | (Tests, optional) Score needed to pass the day, such as `Pass: 70%`. |
| `Note 3:` `Note 2:` `Note 1:` `Note fail:` | (Tests, optional) The boss's note on the pay slip for 3, 2 or 1 stars, or a failed day. `Note:` alone covers every passing score. |
| `Shift start:` `Shift end:` | (Tests, optional) A different shift for this day, such as `Shift end: 12:00 p.m.` |
| Anything else | Shown as a header line on the document (`From:`, `To:`, `Subject:`, `Date:`, `Re:` …), in the order you write them. |

---

## 4. Lesson files (A)

After the settings block, write normally:

| You type | You get |
|---|---|
| `## Heading` | a heading |
| `**bold**`, `*italics*`, `~~crossed out~~` | **bold**, *italics*, ~~crossed out~~ |
| a line starting with `✓` or `✗` | a green or red example line |
| `- item` or `1. item` | a list |
| `> text` | a highlighted box (good for the rule) |
| a table with `|` | a table |

A new line in your file is a new line in the game. A blank line starts a new paragraph.

---

## 5. Test files (B)

Text before the first `## ` line appears on the "Your shift" card when the player clocks in. After that, each block starts with a line beginning `## `. There are three kinds.

### Sticky note (multiple choice)

```
## Question
The firm received ___ applications this year than last year.

A) less
B) fewer
C) lesser
Answer: B
Feedback A: Applications can be counted (two applications), so it takes fewer.
Feedback C: Lesser means lower in importance, as in a lesser charge.
Hint: Can you put a number in front of applications?
Explain: You can say three applications, so the answer is fewer.
```

- Options are a capital letter and `)`, one per line (`A)` to `H)`). `Answer:` is the right letter.
- `Feedback X:` is shown when a player picks wrong option X. `Hint:` and `Explain:` are optional.
- If the heading is something other than "Question" (for example `## From Priya`), it's shown as who left the note.
- Your Word pages' layout (`Question:` / `Options: A) … · B) …` / `Correct answer:` / `Feedback:` then `B) …` lines) also works.

### Document to stamp (proofreading)

Any block with a `Passage:` line is a document.

```
## Mini-boss: The supply memo
Document: Memo
To: You
From: Ms. Fewster, Partner
Re: Supply order
Penalty: 10
Hint: There are three errors.
Ms. Fewster needs this before it goes out.
Passage:
Please order {less => fewer | Binders can be counted.} binders this month.
We need {fewer => less | Paper is an amount.} paper in the bins.
That leaves {less => less | Correct: money is an amount.} than $50 in petty cash.
```

**Marking errors.** Put each error in curly brackets: `{wrong => right | feedback}`.

| You write | Meaning |
|---|---|
| `{less => fewer}` | *less* is wrong; the fix is *fewer*. |
| `{less => fewer \| Binders can be counted.}` | Same, with a line shown after it's fixed or missed. |
| `{Fewer => fewer // Fewer}` | More than one accepted fix: separate them with `//`. |
| `{at => }` | The fix is to **delete** the word. |
| `{Jamal and myself => Jamal and me}` | A phrase works too. |
| `{whom => whom \| Correct: we hired him.}` | A **trap**: a correct word that looks wrong. Clicking it costs time and money and shows your line. |

Every word not in brackets is correct, and clicking it costs time and a $10 fine.

**Clean documents:** a passage with no errors marked is correct as written, so the right stamp is APPROVE. Mix a few in so players can't assume every document is broken.

**Other lines above `Passage:`:**

| Line | Meaning |
|---|---|
| `Penalty: 10` | Minutes lost for each mistake on this document (default 10). |
| `Hint:` | Shown when the player presses Hint. |
| `Success:` | Replaces the message for a perfect stamp. |
| A line without a colon | Shown as a short instruction at the top of the document. |
| Any other `Label: value` | Shown in the document's header. A label is one to three words, then a colon and a space. |

### Note from the boss

A block with no options and no passage becomes a note from the boss with an **OK** button. It doesn't count toward the score.

---

## 6. Settings in `game.md`

| Line | Default | What it does |
|---|---|---|
| `Title:` `Firm:` `Subtitle:` | | Title screen and pay slips. |
| `Start:` | Start your first day | The first button's text. |
| `Boss:` | Ms. Fewster, Managing Partner | Who speaks and signs notes (the part before the comma is used in speech bubbles). |
| `Reviewer:` `Ending:` | | Who signs the final performance review, and its closing text. |
| `Pass:` | 50% | Score needed to pass a day. |
| `Hearts:` | 3 | Hearts per day (1 to 5). |
| `Shift start:` `Shift end:` | 9:00 a.m., 5:00 p.m. | The workday. |
| `Speed:` | 80 | Game minutes per real minute (80 = about 6 real minutes per day). |
| `Note penalty:` | 5 | Minutes lost for a wrong sticky-note answer. |
| `Pay note:` `Pay hint:` `Pay document:` `Pay fix:` `Fine:` | 20, 10, 50, 10, 10 | Dollars for a sticky note right on the first try, a right answer after a hint, a correct stamp, each error corrected, and each correct word changed. |
| `Note 3:` `Note 2:` `Note 1:` `Note fail:` | | Default pay-slip notes. |
| `Line start:` `Line right:` `Line wrong:` `Line over:` `Line approvebad:` `Line returnclean:` `Line missed:` `Line clean:` `Line hurry:` `Line closing:` `Line fired:` `Line done:` | built in | What the boss says at those moments. Separate several versions with `//` and one is picked at random. |

---

## 7. Scores

- A sticky note right on the first try is worth 1 (0.75 with a hint, 0 after a wrong answer).
- A document is worth (errors corrected + 1 for the right stamp) ÷ (errors + 1 + mistakes).
- Anything still in the inbox at 5:00 p.m. is worth 0.
- The day's score is the average. 90% or more = 3 stars, 70% = 2 stars, otherwise 1 star.

---

## 8. Checking your files

If the game can't understand a line (a missing `Answer:`, a bracket without `=>`, a file name without a number), the title screen lists the problem with the file name. Fix it and run `build.cmd` again.

Progress is saved in the browser. On the title screen, under **Options**, **Unlock every day** lets your instructor open any day, and **Reset progress** starts over.

---

## 9. The font

The game looks best with the Pixelify Sans pixel font (free, Open Font License). Put the font file in `engine/fonts` (for example `PixelifySans-Regular.ttf`) and run `build.cmd`, and it's packed into the game. Without it, the game uses a plain monospace font.
