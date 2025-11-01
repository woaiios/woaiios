/**
 * Dictionary-Based Word Lemmatizer
 * Uses ECDICT database exchange field for accurate lemmatization
 * 
 * The exchange field format: "p:past/d:done/i:doing/3:does/s:plural/0:lemma"
 * - p: past tense
 * - d: past participle  
 * - i: present participle (-ing)
 * - 3: third person singular
 * - s: plural form
 * - r: comparative (-er)
 * - t: superlative (-est)
 * - 0: lemma (base form)
 * - 1: alternative lemma
 */

import type { WordDatabase } from './database/WordDatabase';

export interface WordForms {
  lemma: string | null;        // Base form (from exchange field "0" or "1")
  past: string | null;          // Past tense (p)
  pastParticiple: string | null;   // Past participle (d)
  presentParticiple: string | null; // Present participle (i)
  thirdPerson: string | null;   // Third person singular (3)
  plural: string | null;        // Plural form (s)
  comparative: string | null;   // Comparative (r)
  superlative: string | null;   // Superlative (t)
}

export class DictionaryLemmatizer {
  private wordDatabase: WordDatabase | null = null;

  /**
   * Set the word database instance for lookups
   */
  setDatabase(database: WordDatabase): void {
    this.wordDatabase = database;
  }

  /**
   * Parse exchange field from database
   */
  private parseExchange(exchange: string | undefined): WordForms {
    const forms: WordForms = {
      lemma: null,
      past: null,
      pastParticiple: null,
      presentParticiple: null,
      thirdPerson: null,
      plural: null,
      comparative: null,
      superlative: null,
    };

    if (!exchange) return forms;

    // Exchange format: "p:ran/d:run/i:running/0:run"
    const pairs = exchange.split('/');
    for (const pair of pairs) {
      const [type, value] = pair.split(':');
      if (!type || !value) continue;

      switch (type) {
        case '0':
        case '1':
          forms.lemma = value;
          break;
        case 'p':
          forms.past = value;
          break;
        case 'd':
          forms.pastParticiple = value;
          break;
        case 'i':
          forms.presentParticiple = value;
          break;
        case '3':
          forms.thirdPerson = value;
          break;
        case 's':
          forms.plural = value;
          break;
        case 'r':
          forms.comparative = value;
          break;
        case 't':
          forms.superlative = value;
          break;
      }
    }

    return forms;
  }

  /**
   * Get the lemma (base form) of a word using dictionary lookup
   * This is the correct way - use the database's exchange field
   */
  async getLemma(word: string): Promise<string> {
    if (!this.wordDatabase) {
      console.warn('WordDatabase not set, returning original word');
      return word.toLowerCase();
    }

    const lowerWord = word.toLowerCase();

    try {
      // Look up the word in dictionary
      const wordInfo = await this.wordDatabase.query(lowerWord);
      
      if (wordInfo && wordInfo.exchange) {
        const forms = this.parseExchange(wordInfo.exchange);
        
        // If this word has a lemma, return it
        if (forms.lemma && forms.lemma.toLowerCase() !== lowerWord) {
          return forms.lemma.toLowerCase();
        }
      }

      // If no lemma found, word is already in base form
      return lowerWord;
    } catch (error) {
      console.error('Error getting lemma:', error);
      return lowerWord;
    }
  }

  /**
   * Get all word forms for a given word
   */
  async getWordForms(word: string): Promise<WordForms> {
    if (!this.wordDatabase) {
      return {
        lemma: word.toLowerCase(),
        past: null,
        pastParticiple: null,
        presentParticiple: null,
        thirdPerson: null,
        plural: null,
        comparative: null,
        superlative: null,
      };
    }

    try {
      const wordInfo = await this.wordDatabase.query(word.toLowerCase());
      if (wordInfo && wordInfo.exchange) {
        return this.parseExchange(wordInfo.exchange);
      }
    } catch (error) {
      console.error('Error getting word forms:', error);
    }

    return {
      lemma: word.toLowerCase(),
      past: null,
      pastParticiple: null,
      presentParticiple: null,
      thirdPerson: null,
      plural: null,
      comparative: null,
      superlative: null,
    };
  }
}
