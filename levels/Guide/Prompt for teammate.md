I'm working on a team project for ENGL 205 Grammar and Proofreading (SAIT Legal Assistant program). You can't see our files, so everything you need is below. I'm writing Level(s) [FILL IN: e.g., 3 and 4]. Help me write them the same way my teammate wrote Level 1, so all pages match.

## The project
- The assignment is a Grammar Guide: about one page per grammar topic, at least ten topics. It must be "grammatically perfect", written for readers who have never taken a grammar class, use our course terms, take a "unique approach", and cite every source we quote or paraphrase (APA).
- Our guide comes with a game: the player is a new legal assistant/proofreader at the law firm Fewster & Lessing LLP. Each level is one workday: a lesson, then multiple-choice questions, an inspect passage, and a mini-boss memo from Ms. Fewster (Managing Partner) due at 5 p.m. The final boss (Day 8: Filing Day) is a court affidavit with one error from every level.
- Days: 1 The Supply Order (Words) = fewer/less · 2 The Exhibit List (Phrases) = subject–verb agreement · 3 The Client Update (Verbs) = good/well, bad/badly · 4 Between You and Me (Roles) = she and I / between you and me · 5 The Witness (Clauses) = who/whom/whoever · 6 Where It's At (Word Order) = ending with prepositions · 7 A Matter of Commas (Punctuation) = commas that change meaning.

## The AI rule (important)
Our instructor said AI use cannot be more than 20% of the project, and the authorship declaration can zero the whole team. So: do NOT write my prose for me. For each section, give me only the points/facts it must cover, let me write it, then check my version for grammar errors, accuracy, course terms, and Canadian spelling. You may do small fixes (punctuation, italics, consistency, citation format) when I ask. Never invent sources; I cite only what I have opened myself.

## Course terms (use the course's terms, not general grammar terms)
Head, dependent, modifier, phrase, clause, noun, nominal, pronoun, determiner, adjective, adjectival, adverb, adverbial, preposition, object, subject, modifying noun, predicative complement (the brief says "predicating"), transitive verb, intransitive verb, linking verb, verb string, finite verb, non-finite verb, displacement. Define any term the first time a reader meets it. Level 1 uses noun (countable/non-countable) and determiner; head and dependent are introduced in Level 2.

## Page template (every level page must look exactly like this)
```
## Level N: Topic

***Day N: Level name (Unit)***
*Topic: x vs. y*

### The question
(1–2 sentences: the confusing choice, set in the law office)

### The rule
- (one bullet per word/form) (citation)

### Example
- Correct Use: ...
- **Incorrect Use: ... → fix**

### Explanation
(one test question line, e.g., Ask yourself, "How many?" or "How much?")

| Ask | Use | Example |
|---|---|---|
| ... | ... | ... |

- (bullets with the ENGL 205 terms)

### Tricky cases
- (bullets, examples as nested bullets in italics)

### Unique approach
(our own idea, e.g., a short office dialogue, a drawing, a photo we took)

### Skeptic's corner
(is the rule justified? where did it come from? with a cited source)

### Practice
1. Question with ___.
   - (A) ...
   - (B) ...
   - **Answer: X.** Why.
(4 questions)

### Inspect passage
*Email from [name], [role]. Subject: ... There are N errors.*

> (plain-text passage with the errors in it)

**Answer key**
1. *wrong* → *right*: why.
- Trap: *word* is correct, because ...

### Mini-boss
(same as the inspect passage, from Ms. Fewster, 4–6 sentences, 3 errors + 1 trap)

### Sources
- (APA, only sources actually used and cited in the text)
```
Style: Canadian spelling; words used as words in italics; curly apostrophes; one term for each idea throughout.

## Game files (I'll send these to my teammate, who builds the game)
Lesson file `0NA Topic.md`:
```
---
Title: Topic
Level: Level name
Document: Email
From: Name, Role
To: You
Subject: ...
---
(the rule, ✓/✗ example lines, the table, tricky cases; Markdown is fine)
```
Test file `0NB Topic - Test.md`:
```
---
Title: Topic: Test
---
## Question
Sentence with ___.

A) option
B) option
Answer: A
Feedback B: why B is wrong.
Hint: (optional) a guiding question.

## Inspect: Title
Document: Email
From: Name, Role
To: You
Subject: ...
Hint: There are two errors.
Passage:
Text with {wrong => right | why} for each error and {word => word | Correct: why} for each trap.

## Mini-boss: Title
Document: Memo
To: You
From: Ms. Fewster, Managing Partner
Re: ...
Penalty: 10
Hint: There are three errors.
(one line: why it's due at 5 p.m.)
Passage:
Text with marked errors and one trap.
```
Every word not in {brackets} must be correct. `{word => }` means "delete it"; `{a => b // c}` means two accepted fixes.

## How to work with me
Go section by section in template order. Give me bullet points for one or two sections, wait for my draft, then check it. One question at a time.
