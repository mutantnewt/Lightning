import type { Book } from "./domain";
import type { BookSearchResult } from "./book-suggestions";

export interface OfflineBookSuggestionEntry {
  search: BookSearchResult;
  details: Partial<Book>;
}

export const offlineBookSuggestionCatalog: OfflineBookSuggestionEntry[] = [
  {
    search: {
      title: "Great Expectations",
      author: "Charles Dickens",
      year: 1861,
      brief: "Pip comes of age through ambition, love, and painful self-discovery.",
    },
    details: {
      title: "Great Expectations",
      author: "Charles Dickens",
      year: 1861,
      era: "Victorian",
      country: "England",
      category: "Bildungsroman",
      workType: "Novel",
      summary:
        "Great Expectations follows Pip, an orphan whose life changes after a mysterious benefactor provides him with the means to become a gentleman. As Pip moves from the marshes of Kent to London, he becomes entangled in questions of class, loyalty, shame, and self-invention. Dickens combines vivid characterization with moral complexity to explore how ambition can distort affection and judgment. The novel remains a major Victorian classic for its emotional force, memorable cast, and searching portrait of personal growth.",
      authorBio:
        "Charles Dickens (1812–1870) was an English novelist and social critic whose fiction exposed social inequality while creating some of literature's most memorable characters. His major works include Oliver Twist, Bleak House, and A Tale of Two Cities.",
      tags: ["Victorian", "Coming of Age", "Class"],
      publicDomain: true,
      publicDomainNotes: "Published in 1861, this work is in the public domain in the United States.",
      source: "https://www.gutenberg.org/ebooks/1400",
    },
  },
  {
    search: {
      title: "Frankenstein",
      author: "Mary Shelley",
      year: 1818,
      brief: "A scientist creates life and confronts horror, guilt, and responsibility.",
    },
    details: {
      title: "Frankenstein",
      author: "Mary Shelley",
      year: 1818,
      era: "Romantic",
      country: "England",
      category: "Gothic Fiction",
      workType: "Novel",
      summary:
        "Frankenstein tells the story of Victor Frankenstein, a brilliant young scientist who discovers how to animate lifeless matter and then recoils from the being he has made. As creator and creature pursue one another across Europe and the Arctic, Mary Shelley explores ambition, isolation, moral responsibility, and the consequences of rejecting what we create. The novel blends Gothic terror with philosophical depth, making it one of the foundational works of modern science fiction and a lasting meditation on human limits.",
      authorBio:
        "Mary Shelley (1797–1851) was an English novelist, essayist, and biographer. Best known for Frankenstein, she helped shape Gothic and speculative fiction while engaging deeply with the intellectual currents of the Romantic era.",
      tags: ["Gothic", "Science Fiction", "Creation"],
      publicDomain: true,
      publicDomainNotes: "First published in 1818, this work is in the public domain in the United States.",
      source: "https://www.gutenberg.org/ebooks/84",
    },
  },
  {
    search: {
      title: "Middlemarch",
      author: "George Eliot",
      year: 1871,
      brief: "Interwoven lives reveal idealism, compromise, and provincial society.",
    },
    details: {
      title: "Middlemarch",
      author: "George Eliot",
      year: 1871,
      era: "Victorian",
      country: "England",
      category: "Literary Fiction",
      workType: "Novel",
      summary:
        "Middlemarch traces the moral and emotional lives of several residents of a provincial English town, especially the idealistic Dorothea Brooke and the ambitious doctor Tertius Lydgate. Through marriages, ambitions, disappointments, and reformist hopes, George Eliot examines how private choices intersect with social structures. The novel is celebrated for its psychological intelligence, humane irony, and intricate sense of community. It remains a towering achievement of nineteenth-century fiction and a profound study of aspiration, compromise, and ethical life.",
      authorBio:
        "George Eliot was the pen name of Mary Ann Evans (1819–1880), one of the great English novelists of the Victorian period. Her fiction is known for moral seriousness, psychological depth, and acute social observation.",
      tags: ["Victorian", "Society", "Psychological"],
      publicDomain: true,
      publicDomainNotes: "Published in 1871–1872, this work is in the public domain in the United States.",
      source: "https://www.gutenberg.org/ebooks/145",
    },
  },
  {
    search: {
      title: "War and Peace",
      author: "Leo Tolstoy",
      year: 1869,
      brief: "Families, war, and history collide during Napoleon's invasion of Russia.",
    },
    details: {
      title: "War and Peace",
      author: "Leo Tolstoy",
      year: 1869,
      era: "Victorian",
      country: "Russia",
      category: "Historical Fiction",
      workType: "Novel",
      summary:
        "War and Peace follows aristocratic Russian families as they navigate love, ambition, spiritual searching, and catastrophic upheaval during the Napoleonic Wars. Tolstoy moves between battlefields and drawing rooms to show how historical forces shape private lives while questioning conventional ideas about power and heroism. The novel combines sweeping scale with intimate psychological insight, creating one of literature's richest depictions of society in motion. It endures as a monumental exploration of history, family, war, and the search for meaning.",
      authorBio:
        "Leo Tolstoy (1828–1910) was a Russian novelist and thinker whose major works transformed world literature. His fiction, including Anna Karenina and War and Peace, is renowned for moral depth, realism, and philosophical scope.",
      tags: ["Russia", "War", "History"],
      publicDomain: true,
      publicDomainNotes: "Published in 1869, this work is in the public domain in the United States.",
      source: "https://www.gutenberg.org/ebooks/2600",
    },
  },
  {
    search: {
      title: "Leaves of Grass",
      author: "Walt Whitman",
      year: 1855,
      brief: "A revolutionary poetry collection celebrating self, democracy, and the body.",
    },
    details: {
      title: "Leaves of Grass",
      author: "Walt Whitman",
      year: 1855,
      era: "Romantic",
      country: "United States",
      category: "Poetry",
      workType: "Collection",
      summary:
        "Leaves of Grass is Walt Whitman's evolving collection of poems that celebrates the individual self, democratic life, physical embodiment, labor, sexuality, and the natural world. Expansive in style and radically free in form, it broke with poetic convention and helped redefine what American poetry could be. Whitman's speaker embraces contradiction and plurality, seeking a voice large enough to contain the energy of a nation. The collection remains a landmark of literary innovation and a foundational text of American poetry.",
      authorBio:
        "Walt Whitman (1819–1892) was an American poet, essayist, and journalist whose experimental verse transformed English-language poetry. Leaves of Grass established him as one of the most influential figures in American literary history.",
      tags: ["Poetry", "Democracy", "American Literature"],
      publicDomain: true,
      publicDomainNotes: "First published in 1855, this collection is in the public domain in the United States.",
      source: "https://www.gutenberg.org/ebooks/1322",
    },
  },
  {
    search: {
      title: "The Secret Garden",
      author: "Frances Hodgson Burnett",
      year: 1911,
      brief: "A hidden garden helps children heal, change, and come alive.",
    },
    details: {
      title: "The Secret Garden",
      author: "Frances Hodgson Burnett",
      year: 1911,
      era: "Edwardian",
      country: "England",
      category: "Children's Literature",
      workType: "Novel",
      summary:
        "The Secret Garden follows Mary Lennox, a lonely and difficult child sent to a Yorkshire manor after the death of her parents. There she discovers a hidden walled garden and, with the help of new companions, slowly helps restore both the neglected space and the damaged lives around her. Burnett's novel combines mystery, emotional renewal, and the restorative power of nature. It remains beloved for its atmosphere, its transformation of character through care and friendship, and its enduring appeal to readers of all ages.",
      authorBio:
        "Frances Hodgson Burnett (1849–1924) was an Anglo-American writer best known for children's classics including The Secret Garden and A Little Princess. Her fiction often explores resilience, imagination, and emotional renewal.",
      tags: ["Children's Literature", "Healing", "Nature"],
      publicDomain: true,
      publicDomainNotes: "Published in 1911, this work is in the public domain in the United States.",
      source: "https://www.gutenberg.org/ebooks/17396",
    },
  },
];
