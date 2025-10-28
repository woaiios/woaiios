import lemmatizer from 'lemmatizer';
import lemmatize from 'wink-lemmatizer';

const testWords = ['kilometers', 'running', 'walked', 'bigger', 'studies', 'happily'];

console.log('Testing lemmatizer library:');
testWords.forEach(word => {
    // The lemmatizer library needs the word and POS tag
    const noun = lemmatizer.lemmas(word, 'noun');
    const verb = lemmatizer.lemmas(word, 'verb');
    const adj = lemmatizer.lemmas(word, 'adj');
    console.log(`${word}:`);
    if (noun && noun.length > 0) console.log(`  noun: ${noun.join(', ')}`);
    if (verb && verb.length > 0) console.log(`  verb: ${verb.join(', ')}`);
    if (adj && adj.length > 0) console.log(`  adj: ${adj.join(', ')}`);
});

console.log('\n\nTesting wink-lemmatizer library:');
testWords.forEach(word => {
    const noun = lemmatize.noun(word);
    const verb = lemmatize.verb(word);
    const adj = lemmatize.adjective(word);
    console.log(`${word}:`);
    console.log(`  noun: ${noun}, verb: ${verb}, adj: ${adj}`);
});
