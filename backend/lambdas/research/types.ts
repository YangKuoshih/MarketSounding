export interface Event {
  id: string;
  title: string;
  source: 'pasted' | 'sample' | 'researched';
  rawText: string;
  summary: string | null;
  eventDate: string;
  createdAt: string;
  userId: string;
}

export interface Source {
  title: string;
  url: string;
  snippet: string;
  publishedDate: string;
  domain: string;
  relevanceScore: number;
}

export interface ResearchResult {
  event: Event;
  sources: Source[];
  searchQueries: string[];
}
