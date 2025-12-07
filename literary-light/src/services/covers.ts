/**
 * Service for fetching book cover images from Open Library
 */

export interface CoverImage {
  small?: string;
  medium?: string;
  large?: string;
}

export async function getBookCover(
  title: string,
  author: string
): Promise<CoverImage | null> {
  try {
    const searchQuery = encodeURIComponent(`${title} ${author}`);
    const searchUrl = `https://openlibrary.org/search.json?q=${searchQuery}&limit=1`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();
    
    if (data.docs && data.docs.length > 0) {
      const book = data.docs[0];
      
      if (book.cover_i) {
        const coverId = book.cover_i;
        return {
          small: `https://covers.openlibrary.org/b/id/${coverId}-S.jpg`,
          medium: `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`,
          large: `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`,
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching book cover:', error);
    return null;
  }
}
