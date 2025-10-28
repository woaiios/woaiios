/**
 * WordLemmatizer Module
 * Handles English word lemmatization (finding base forms of inflected words)
 */
export class WordLemmatizer {
    /**
     * Lemmatize a word by removing common English inflections
     * @param {string} word - Word to lemmatize
     * @returns {Array<string>} Possible base forms (first is original, rest are candidates)
     */
    static lemmatize(word) {
        const lowerWord = word.toLowerCase();
        const candidates = [lowerWord]; // Always include the original word
        
        // Rule 1: Plurals ending in -s, -es
        if (lowerWord.endsWith('sses')) {
            // classes -> class
            candidates.push(lowerWord.slice(0, -2));
        } else if (lowerWord.endsWith('ies') && lowerWord.length > 4) {
            // flies -> fly, studies -> study
            candidates.push(lowerWord.slice(0, -3) + 'y');
        } else if (lowerWord.endsWith('es') && lowerWord.length > 3) {
            // boxes -> box, watches -> watch
            candidates.push(lowerWord.slice(0, -2));
            // Also try removing just 's' (catches -> catch vs. catches -> catche)
            candidates.push(lowerWord.slice(0, -1));
        } else if (lowerWord.endsWith('s') && lowerWord.length > 2 && !lowerWord.endsWith('ss') && !lowerWord.endsWith('us')) {
            // cats -> cat (but not class -> clas, or bus -> bu)
            candidates.push(lowerWord.slice(0, -1));
        }
        
        // Rule 2: -ing forms
        if (lowerWord.endsWith('ing') && lowerWord.length > 4) {
            // running -> run (doubled consonant)
            const stem = lowerWord.slice(0, -3);
            candidates.push(stem);
            if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2] && 
                /[bcdfghjklmnpqrstvwxyz]/.test(stem[stem.length - 1])) {
                candidates.push(stem.slice(0, -1)); // running -> run
            }
            // making -> make (e-drop)
            candidates.push(stem + 'e');
        }
        
        // Rule 3: -ed forms
        if (lowerWord.endsWith('ed') && lowerWord.length > 3) {
            const stem = lowerWord.slice(0, -2);
            candidates.push(stem);
            // stopped -> stop (doubled consonant)
            if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2] && 
                /[bcdfghjklmnpqrstvwxyz]/.test(stem[stem.length - 1])) {
                candidates.push(stem.slice(0, -1));
            }
            // liked -> like (e-drop)
            candidates.push(stem + 'e');
        }
        
        // Rule 4: -er/-est (comparative/superlative)
        if (lowerWord.endsWith('est') && lowerWord.length > 4) {
            const stem = lowerWord.slice(0, -3);
            candidates.push(stem);
            // biggest -> big (doubled consonant)
            if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2] && 
                /[bcdfghjklmnpqrstvwxyz]/.test(stem[stem.length - 1])) {
                candidates.push(stem.slice(0, -1));
            }
            // nicest -> nice (e-drop)
            candidates.push(stem + 'e');
            // happiest -> happy (y change)
            if (stem.endsWith('i')) {
                candidates.push(stem.slice(0, -1) + 'y');
            }
        } else if (lowerWord.endsWith('er') && lowerWord.length > 3) {
            const stem = lowerWord.slice(0, -2);
            candidates.push(stem);
            // bigger -> big (doubled consonant)
            if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2] && 
                /[bcdfghjklmnpqrstvwxyz]/.test(stem[stem.length - 1])) {
                candidates.push(stem.slice(0, -1));
            }
            // nicer -> nice (e-drop)
            candidates.push(stem + 'e');
            // happier -> happy (y change)
            if (stem.endsWith('i')) {
                candidates.push(stem.slice(0, -1) + 'y');
            }
        }
        
        // Rule 5: -ly (adverbs)
        if (lowerWord.endsWith('ly') && lowerWord.length > 4) {
            const stem = lowerWord.slice(0, -2);
            candidates.push(stem);
            // happily -> happy (y change)
            if (stem.endsWith('i')) {
                candidates.push(stem.slice(0, -1) + 'y');
            }
        }
        
        // Remove duplicates and return
        return [...new Set(candidates)];
    }

    /**
     * Find the best base form by checking against a word database
     * @param {string} word - Word to find base form for
     * @param {Function} checkFn - Function that checks if a word exists in database
     * @returns {string|null} Best base form found, or null if none found
     */
    static findBaseForm(word, checkFn) {
        const lemmas = this.lemmatize(word);
        for (const lemma of lemmas) {
            if (checkFn(lemma)) {
                return lemma;
            }
        }
        return null;
    }
}
