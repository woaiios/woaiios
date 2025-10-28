import { WordLemmatizer } from './js/WordLemmatizer.js';

// Test the word "kilometers"
const word = 'kilometers';
console.log(`Testing word: ${word}`);
console.log('Lemmatized forms:', WordLemmatizer.lemmatize(word));

// Test a few other words for comparison
const testWords = ['kilometers', 'running', 'walked', 'bigger', 'studies'];
testWords.forEach(w => {
    const lemmas = WordLemmatizer.lemmatize(w);
    console.log(`${w} -> ${lemmas.join(', ')}`);
});
