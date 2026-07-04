/**
 * lib/chapters/a1-3-nominativ.ts
 * ----------------------------------------------------------------------------
 * SERVER-SIDE authoritative chapter content for RAG. This is the trusted
 * source the tutor retrieves from — the client never supplies lesson text.
 *
 * Keep this in sync with the client lesson data (chapter/chapter-data.js).
 * In a larger build, generate these from a single source (DB or CMS) at build
 * time; for now it is a hand-maintained mirror of the shipped chapter.
 */
import type { ServerChunk } from '../rag';

export const CHAPTER_A1_3 = {
  id: 'a1-3-nominativ',
  title: 'Der Nominativ',
  titleEn: 'The Nominative Case',
  level: 'A1',
  chunks: [
    { title: 'Overview: Der Nominativ', text: 'The nominative is the starting line of every German sentence — the case of the subject, the one doing the action. Master it and der/die/das stop feeling random. Level A1, Beginner.' },

    // Vocabulary (12 words)
    { title: 'Vocabulary: der Mann', text: 'der Mann — English: man. Hindi: aadmi. Gender: masculine (der). Plural: Männer. Example: Der Mann liest die Zeitung. (The man reads the newspaper.)' },
    { title: 'Vocabulary: die Frau', text: 'die Frau — English: woman. Hindi: aurat. Gender: feminine (die). Plural: Frauen. Example: Die Frau trinkt Kaffee. (The woman drinks coffee.)' },
    { title: 'Vocabulary: das Kind', text: 'das Kind — English: child. Hindi: baccha. Gender: neuter (das). Plural: Kinder. Example: Das Kind spielt. (The child plays.)' },
    { title: 'Vocabulary: der Hund', text: 'der Hund — English: dog. Hindi: kutta. Gender: masculine (der). Plural: Hunde. Example: Der Hund schläft. (The dog sleeps.)' },
    { title: 'Vocabulary: die Katze', text: 'die Katze — English: cat. Hindi: billi. Gender: feminine (die). Plural: Katzen. Example: Die Katze trinkt Milch. (The cat drinks milk.)' },
    { title: 'Vocabulary: das Haus', text: 'das Haus — English: house. Hindi: ghar. Gender: neuter (das). Plural: Häuser. Example: Das Haus ist groß. (The house is big.)' },
    { title: 'Vocabulary: der Tisch', text: 'der Tisch — English: table. Hindi: mez. Gender: masculine (der). Plural: Tische.' },
    { title: 'Vocabulary: die Schule', text: 'die Schule — English: school. Hindi: school. Gender: feminine (die). Plural: Schulen.' },
    { title: 'Vocabulary: das Buch', text: 'das Buch — English: book. Hindi: kitaab. Gender: neuter (das). Plural: Bücher.' },
    { title: 'Vocabulary: der Lehrer', text: 'der Lehrer — English: teacher (male). Hindi: adhyaapak. Gender: masculine (der). Plural: Lehrer.' },
    { title: 'Vocabulary: die Mutter', text: 'die Mutter — English: mother. Hindi: maa. Gender: feminine (die). Plural: Mütter.' },
    { title: 'Vocabulary: der Bruder', text: 'der Bruder — English: brother. Hindi: bhai. Gender: masculine (der). Plural: Brüder.' },

    // Grammar
    { title: 'Grammar: What is the nominative?', text: 'The nominative (der Nominativ) is the case of the subject — the person or thing doing the action. Find it by asking Wer? (who?) or Was? (what?). The subject is coloured blue in Klarweg. Example: Der Hund schläft — Wer schläft? der Hund.' },
    { title: 'Grammar: Articles by gender', text: 'In the nominative the definite article shows the gender: der (masculine), die (feminine), das (neuter), die (plural). Indefinite: ein (m), eine (f), ein (n). Examples: der Mann, die Frau, das Kind, die Kinder.' },
    { title: 'Grammar: Common mistakes', text: 'Gender cannot be guessed from meaning — learn every noun with its article. Wrong: die Mann → Right: der Mann (Mann is masculine). Wrong: der Mädchen → Right: das Mädchen (Mädchen is neuter). Hinglish: har naye noun ke saath uska article yaad karo, warna der/die/das galat ho jaayega.' },

    // Reading / listening
    { title: 'Reading: Ein Tag zu Hause', text: 'A day at home. Der Mann liest die Zeitung. Die Frau trinkt Kaffee. Das Kind spielt. Die Mutter kocht. The subjects (der Mann, die Frau, das Kind, die Mutter) are all in the nominative.' },
    { title: 'Listening: Familie', text: 'Hallo! Ich bin Lena. Das ist mein Bruder. Der Bruder ist Lehrer. Die Mutter kocht, und das Kind spielt. Wir sind eine Familie. (Hello! I am Lena. This is my brother. The brother is a teacher. The mother cooks, and the child plays. We are a family.)' },

    // Speaking / writing / exercises / quiz
    { title: 'Speaking practice', text: 'Practice sentences: Der Mann liest ein Buch. (The man reads a book.) Die Frau trinkt Kaffee. (The woman drinks coffee.) Das Kind spielt. (The child plays.)' },
    { title: 'Writing task', text: 'Write three sentences. Each must start with a nominative subject (der / die / das + a noun) followed by a verb. Use words from this chapter. Starters: Der …, Die …, Das …' },
    { title: 'Exercise (multiple choice)', text: 'Choose the correct article: ___ Buch ist neu. Options: Der, Die, Das. Answer: Das — Buch is neuter.' },
    { title: 'Quiz', text: 'Q: Which article is correct? ___ Frau trinkt Kaffee. Options: Der, Die, Das. Answer: Die — Frau is feminine. Q: ___ Mann liest. Answer: Der — Mann is masculine.' },

    // Summary
    { title: 'Key takeaways', text: 'The nominative is the case of the subject — find it with Wer? / Was?. Articles by gender: der (m), die (f), das (n), die (plural). Learn every noun with its article; gender cannot be guessed from meaning.' },
  ] as ServerChunk[],
};
