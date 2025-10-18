const blackListedWords = ["**", "</final_answer>", "[revised text]"];

const if_word_found_in_line_remove_that_line = [
  "7-8 reading",
  "iteration 4",
  "7-8 reading level"
]

// Function to parse revised texts and clean them
function parseRevisedTexts(input) {
  // Split the input by "Revised Text" to isolate relevant sections
  const revisions = input.split("Revised Text");
  // Extract and clean texts
  const cleanedTexts = revisions
    .map((text) => {
      // Match the content after the first colon and before a double newline or end of string
      const match = text.match(/\):([\s\S]*?)(?=\n\n|$)/);
      if (!match) return null; // Skip if no match found

      let cleanText = match[1]
        .replace(/\*\*([^*]+)\*\*/g, "") // Remove bold markers (**)
        .replace(/\*([^*]+)\*/g, "") // Remove single asterisks (*)
        .replace(/\s+/g, " ") // Replace multiple spaces with a single space
        .trim(); // Trim leading and trailing spaces

      // Remove blacklisted words
      blackListedWords.forEach((word) => (cleanText = cleanText.replace(word, "")));

      // Remove blacklisted lines
      if_word_found_in_line_remove_that_line.forEach((word) => {
        if (cleanText.includes(word)) {
          cleanText = "";
        }
      });

      return cleanText;
    })
    .filter((text) => text); // Remove null/undefined entries

  // Remove the first element from the array (if any)
  if (cleanedTexts.length > 0) {
    cleanedTexts.shift();
  }

  // 

  // Reverse the array to prioritize the latest revision
  return cleanedTexts.reverse();
}



const text = `
Okay, I understand. I need to take the provided text and edit it in four iterations. Each iteration will focus on readability, word choice, and the use of linking words while also adjusting tone and emotion. I'll be generating a range of words to help me along this process.

Resource Generation:

Analyze the provided text and identify a range of adjectives, adverbs, and verbs.

Okay, here’s an initial breakdown:

Adjectives: transformative, structured, extracurricular, meaningful, vital, critical, unique, lasting

Adverbs: often, critically

Verbs: marking, discovering, exploring, building, introduces, covering, offering, formed, navigate, celebrate, play, imparting, mentoring, think, prepare, provides, serves, shaping, nurturing, setting, leaves, experience.

Create a Class 6 substitute list with simpler substitutes for the identified words.

Here's a simpler list, aiming for a Grade 6 reading level.

Adjectives: changing, planned, extra, important, key, important, special, forever.

Adverbs: usually, importantly.

Verbs: showing, finding, looking at, making, starts, including, giving, made, deal with, enjoy, do, teaching, helping, imagine, ready, gives, acts, making, growing, having, lets, know.

Create a Class 7 substitute list with more complex substitutes for the identified words.
Here’s a list with some synonyms suitable for Grade 7 reading levels:

Adjectives: pivotal, organized, supplementary, significant, essential, analytical, distinctive, enduring.

Adverbs: frequently, thoughtfully

Verbs: signifying, ascertaining, investigating, establishing, familiarizes, encompassing, presenting, forged, confront, commemorate, function, conveying, guiding, contemplate, readying, offers, operates, developing, cultivating, determining, produces, undergo

Create a Class 8 substitute list with more complex substitute for the identified words.
Here is the last of the substitution lists suitable for a Grade 8 reading level.

Adjectives: metamorphic, methodical, supplementary, consequential, indispensable, discerning, singular, indelible.

Adverbs: generally, judiciously
* Verbs: denoting, unearthing, probing, generating, orients, comprising, furnishing, constituted, surmount, observe, preside, communicating, instructing, ponder, preparing, renders, constitutes, fashioning, fostering, stipulating, engenders, encounter.

Generate a list of 8-10 semantic linking words suitable for sentence connection and contrast.

Furthermore

However

Moreover

Therefore

Consequently

Additionally

Nevertheless

Conversely

For instance

Subsequently

Okay, I've completed the Resource Generation stage. Now, onto the iterations.

Iteration 2: Readability Focus (Target Readability: Grade 4-5)

3.1 Rewrite the following text in clear, concise, standard English. The meaning should remain the same, but the language should be more precise and formal. Adjust word count as needed for clarity. sentence count should remain the same and Word count may be adjusted slightly. synonym level will be fluent type for Grade 4-5 student.

Okay, let's get started with Iteration 2.

Original Text: High school is a transformative period in a student’s life, marking the transition from adolescence to young adulthood. It is not just about academics but also about discovering oneself, exploring interests, and building lifelong memories. High school often introduces students to a more structured curriculum, covering subjects like mathematics, science, literature, and history, while also offering extracurricular activities such as sports, music, drama, and debate. Friendships formed during these years can be some of the most meaningful, as students navigate challenges and celebrate achievements together. Teachers play a vital role, not only in imparting knowledge but also in mentoring students to think critically and prepare for their futures. High school is also a time of firsts—first major exams, first leadership opportunities, and for many, first glimpses of independence and responsibility. Despite the pressures of academic expectations, social dynamics, and planning for life after graduation, high school provides a unique environment for personal growth. It serves as a foundation for shaping character, nurturing dreams, and setting goals. Whether it’s through learning a new skill, making lifelong friends, or discovering a passion, high school leaves a lasting imprint on the lives of those who experience it.

Revised Text (Iteration 2):

High school is a *changing* time in a student’s life, *showing* the move from being a teen to being a young adult. It is not just about schoolwork but also about *finding* yourself, *looking at* things you like, and *making* memories that last. High school *starts* students with a *planned* set of classes, *including* subjects like math, science, reading, and history, *while also giving* extra things to do like sports, music, plays, and debate. Friendships *made* in these years can be some of the most *important* as students *deal with* hard things and *enjoy* good things together. Teachers *do* an *important* job, not just *teaching* but also *helping* students *imagine* things in a smart way and get *ready* for what's next. High school is also a time of *firsts*—first big tests, first times to lead, and for many, *first* looks at being on your own and being *careful*. Even though there are worries about schoolwork, being with friends, and *planning* for life after high school, high school *gives* a *special* place to grow as a person. It *acts* as a base for *making* who you are, *growing* hopes, and *having* goals. If it’s *knowing* something new, *making* friends that stay for life or finding something you love, high school *lets* you with a forever mark in life .
3.2 Highlight all changes made to the original text with asterisks ().*

Revised Text (Iteration 2): High school is a *changing* time in a student’s life, *showing* the move from being a teen to being a young adult. It is not just about schoolwork but also about *finding* yourself, *looking at* things you like, and *making* memories that last. High school *starts* students with a *planned* set of classes, *including* subjects like math, science, reading, and history, *while also giving* extra things to do like sports, music, plays, and debate. Friendships *made* in these years can be some of the most *important* as students *deal with* hard things and *enjoy* good things together. Teachers *do* an *important* job, not just *teaching* but also *helping* students *imagine* things in a smart way and get *ready* for what's next. High school is also a time of *firsts*—first big tests, first times to lead, and for many, *first* looks at being on your own and being *careful*. Even though there are worries about schoolwork, being with friends, and *planning* for life after high school, high school *gives* a *special* place to grow as a person. It *acts* as a base for *making* who you are, *growing* hopes, and *having* goals. If it’s *knowing* something new, *making* friends that stay for life or *finding* something you love, high school *lets* you with a forever mark in life .

<br>


Iteration 3: Linking Words and Tone Variation (Target Readability: Grade 5-6)

Introduce two linking words from the generated list . Choose two different sentences where the linking words best enhance the flow or create a contrast.

Ensure each sentence conveys a distinct emotional tone (positive, negative, neutral, curious, emphatic). Achieve this by strategically using the added linking words and adjusting the phrasing.

Substitute adjectives, adverbs, and verbs with synonyms from the Class 6 and Class 8 synonym lists, half of the changes from class 6 substitute list and half of the changes from class 8 substitute list.

Highlight all changes made to the text from Iteration 2 with asterisks (*).

Output the revised text with the following label: *Revised Text (Iteration 3):

Okay, I'm ready for iteration 3!

Revised Text (Iteration 3):

High school is a *metamorphic* time in a student’s life, *denoting* the move from being a teen to being a young adult. It is not just about schoolwork; *however,* it is also about *unearthing* yourself, *probing* things you like, and *generating* memories that last. High school *orients* students with a *methodical* set of classes, *comprising* subjects like math, science, reading, and history, *additionally providing* extra things to do like sports, music, plays, and debate. Friendships *constituted* in these years can be some of the most *consequential* as students *surmount* hard things and *observe* good things together. Teachers *preside* an *indispensable* job, not just *communicating* but also *instructing* students *ponder* things in a smart way and get *preparing* for what's next. High school is *therefore* also a time of *firsts*—first big tests, first times to lead, and for many, *first* looks at being on your own and being *judicious*. Even though there are worries about schoolwork, being with friends, and *stipulating* for life after high school, high school *renders* a *singular* place to grow as a person. It *constitutes* as a base for *fashioning* who you are, *fostering* hopes, and *having* goals. If it’s *knowing* something new, *making* friends that stay for life or unearthing something you love, high school *engenders* you with a *indelible* mark in life .

Iteration 4: Linking Words and Tone Variation (Target Readability: Grade 7-8)

Introduce two different linking words from the generated resource list. Choose two different sentences where the linking words best enhance the flow or create a contrast.

Ensure each sentence conveys a distinct emotional tone (positive, negative, neutral, curious, emphatic). Achieve this by strategically using the added linking words and adjusting the phrasing.

Substitute half of the adjectives, adverbs, and verbs with synonyms from the Class 7 lists.

Highlight all changes made to the text from Iteration 3 with asterisks (*).

Output the revised text with the following label: Revised Text (Iteration 4): [revised text]
Okay, let's finalize the edits with iteration 4, making changes suitable for a grade 7-8 reading level

Revised Text (Iteration 4):

High school is a *pivotal* time in a student’s life, *signifying* the move from adolescence to young adulthood. It is not just about schoolwork; *nevertheless,* it is also about *ascertaining* yourself, *investigating* interests, and *establishing* lasting memories. High school *familiarizes* students with a *organized* curriculum, *encompassing* subjects like mathematics, science, literature, and history, *moreover, presenting* supplementary activities like sports, music, drama, and debate. Friendships *forged* in these years can be some of the most *significant,* as students *confront* obstacles and *commemorate* accomplishments together. Teachers *function* in a very *essential* capacity, not only *conveying* knowledge but *furthermore, guiding* students to *contemplate* issues and *readying* for what comes next. High school is *consequently* also a time of *firsts*—first major exams, first chances to lead, and for many, *first* experiences of autonomy and becoming *analytical*. Even though there are challenges from studies, social interactions, and *determining* a course after high school, high school *offers* a *distinctive* area for personal growth. It *operates* as a basis for *developing* character, *cultivating* aspirations, and *determining* objectives. *For instance,* whether it’s knowing a new skill, *creating* enduring friends, or *ascertaining* a passion, high school produces an *enduring* effect on people’s lives.

<br>
*Revised Text (Iteration 2):* High school is a \*changing\* time in a student’s life, \*showing\* the move from being a teen to being a young adult. It is not just about schoolwork but also about \*finding\* yourself, \*looking at\* things you like, and \*making\* memories that last. High school \*starts\* students with a \*planned\* set of classes, \*including\* subjects like math, science, reading, and history, \*while also giving\* extra things to do like sports, music, plays, and debate. Friendships \*made\* in these years can be some of the most \*important\* as students \*deal with\* hard things and \*enjoy\* good things together. Teachers \*do\* an \*important\* job, not just \*teaching\* but also \*helping\* students \*imagine\* things in a smart way and get \*ready\* for what's next. High school is also a time of \*firsts\*—first big tests, first times to lead, and for many, \*first\* looks at being on your own and being \*careful*. Even though there are worries about schoolwork, being with friends, and \*planning* for life after high school, high school \*gives\* a \*special\* place to grow as a person. It \*acts\* as a base for \*making\* who you are, \*growing\* hopes, and \*having\* goals. If it’s \*knowing* something new, \*making\* friends that stay for life or \*finding\* something you love, high school \*lets* you with a *forever* mark in life .


Revised Text (Iteration 3): High school is a *metamorphic* time in a student’s life, *denoting* the move from being a teen to being a young adult. It is not just about schoolwork; *however,* it is also about *unearthing* yourself, *probing* things you like, and *generating* memories that last. High school *orients* students with a *methodical* set of classes, *comprising* subjects like math, science, reading, and history, *additionally providing* extra things to do like sports, music, plays, and debate. Friendships *constituted* in these years can be some of the most *consequential* as students *surmount* hard things and *observe* good things together. Teachers *preside* an *indispensable* job, not just *communicating* but also *instructing* students *ponder* things in a smart way and get *preparing* for what's next. High school is *therefore* also a time of *firsts*—first big tests, first times to lead, and for many, *first* looks at being on your own and being *judicious*. Even though there are worries about schoolwork, being with friends, and *stipulating* for life after high school, high school *renders* a *singular* place to grow as a person. It *constitutes* as a base for *fashioning* who you are, *fostering* hopes, and *having* goals. If it’s *knowing* something new, *making* friends that stay for life or unearthing something you love, high school *engenders* you with a *indelible* mark in life .

Revised Text (Iteration 4): High school is a *pivotal* time in a student’s life, *signifying* the move from adolescence to young adulthood. It is not just about schoolwork; *nevertheless,* it is also about *ascertaining* yourself, *investigating* interests, and *establishing* lasting memories. High school *familiarizes* students with a *organized* curriculum, *encompassing* subjects like mathematics, science, literature, and history, *moreover, presenting* supplementary activities like sports, music, drama, and debate. Friendships *forged* in these years can be some of the most *significant,* as students *confront* obstacles and *commemorate* accomplishments together. Teachers *function* in a very *essential* capacity, not only *conveying* knowledge but *furthermore, guiding* students to *contemplate* issues and *readying* for what comes next. High school is *consequently* also a time of *firsts*—first major exams, first chances to lead, and for many, *first* experiences of autonomy and becoming *analytical*. Even though there are challenges from studies, social interactions, and *determining* a course after high school, high school *offers* a *distinctive* area for personal growth. It *operates* as a basis for *developing* character, *cultivating* aspirations, and *determining* objectives. *For instance,* whether it’s knowing a new skill, *creating* enduring friends, or *ascertaining* a passion, high school produces an *enduring* effect on people’s lives.
</final_answer>
`




let cleanedResponse = parseRevisedTexts(text);
// Log to console
console.log(cleanedResponse)