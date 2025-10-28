import lemmatize from 'wink-lemmatizer';

const testWords = ['kilometers', 'running', 'walked', 'bigger', 'studies', 'happily', 'kilometre', 'kilometres'];

console.log('Testing wink-lemmatizer library:');
testWords.forEach(word => {
    const noun = lemmatize.noun(word);
    const verb = lemmatize.verb(word);
    const adj = lemmatize.adjective(word);
    console.log(`${word}:`);
    console.log(`  noun: ${noun}, verb: ${verb}, adj: ${adj}`);
});
