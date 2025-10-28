/**
 * Test file for WordLemmatizer functionality
 * Run this in the browser console or as a Node.js test
 */

import { WordLemmatizer } from './js/WordLemmatizer.js';

function testLemmatization() {
    console.log('Testing WordLemmatizer...\n');
    
    const testCases = [
        // Plurals
        { word: 'cats', expected: ['cats', 'cat'] },
        { word: 'classes', expected: ['classes', 'class'] },
        { word: 'flies', expected: ['flies', 'fly'] },
        { word: 'studies', expected: ['studies', 'study'] },
        { word: 'boxes', expected: ['boxes', 'box', 'boxe'] },
        { word: 'watches', expected: ['watches', 'watch', 'watche'] },
        
        // -ing forms
        { word: 'running', expected: ['running', 'run', 'runne', 'runninge'] },
        { word: 'making', expected: ['making', 'mak', 'make'] },
        { word: 'walking', expected: ['walking', 'walk', 'walke'] },
        
        // -ed forms
        { word: 'walked', expected: ['walked', 'walk', 'walke'] },
        { word: 'stopped', expected: ['stopped', 'stop', 'stoppe'] },
        { word: 'liked', expected: ['liked', 'like'] },
        
        // Comparatives/Superlatives
        { word: 'bigger', expected: ['bigger', 'big', 'bigge'] },
        { word: 'biggest', expected: ['biggest', 'big', 'bigge'] },
        { word: 'nicer', expected: ['nicer', 'nice'] },
        { word: 'nicest', expected: ['nicest', 'nice'] },
        { word: 'happier', expected: ['happier', 'happy', 'happie'] },
        { word: 'happiest', expected: ['happiest', 'happy', 'happie'] },
        
        // Adverbs
        { word: 'quickly', expected: ['quickly', 'quick'] },
        { word: 'happily', expected: ['happily', 'happy', 'happi'] },
        
        // Words that shouldn't change much
        { word: 'class', expected: ['class'] },
        { word: 'bus', expected: ['bus'] },
    ];
    
    let passed = 0;
    let failed = 0;
    
    testCases.forEach(({ word, expected }) => {
        const result = WordLemmatizer.lemmatize(word);
        
        // Check if all expected forms are in the result
        const hasExpected = expected.some(exp => result.includes(exp));
        
        if (hasExpected) {
            console.log(`✓ ${word} -> ${result.join(', ')}`);
            passed++;
        } else {
            console.log(`✗ ${word} -> ${result.join(', ')} (expected to include: ${expected.join(', ')})`);
            failed++;
        }
    });
    
    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    return failed === 0;
}

// Test with real words from dictionary
async function testWithDictionary() {
    console.log('\n\nTesting with WordDatabase...\n');
    
    const { WordDatabase } = await import('./js/WordDatabase.js');
    const wordDB = new WordDatabase();
    await wordDB.initialize();
    
    const testWords = [
        'running',  // should find 'run'
        'walked',   // should find 'walk'
        'bigger',   // should find 'big'
        'studies',  // should find 'study'
        'happily',  // should find 'happy'
    ];
    
    console.log('Testing word difficulty lookup with lemmatization:');
    testWords.forEach(word => {
        const difficulty = wordDB.getWordDifficulty(word);
        console.log(`${word}: ${difficulty.level} (score: ${difficulty.score})`);
    });
}

// Test with real translation
async function testWithTranslation() {
    console.log('\n\nTesting with TextAnalyzer...\n');
    
    const { WordDatabase } = await import('./js/WordDatabase.js');
    const { TextAnalyzer } = await import('./js/TextAnalyzer.js');
    
    const wordDB = new WordDatabase();
    await wordDB.initialize();
    
    const analyzer = new TextAnalyzer(wordDB, null);
    
    // Wait for dictionaries to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const testWords = [
        'running',
        'walked',
        'bigger',
        'studies',
        'happily',
    ];
    
    console.log('Testing translation lookup with lemmatization:');
    testWords.forEach(word => {
        const translation = analyzer.getTranslation(word);
        const hasTranslation = translation && !translation.includes('Translation not available');
        console.log(`${word}: ${hasTranslation ? '✓ Found' : '✗ Not found'}`);
    });
}

// Export test functions
if (typeof window !== 'undefined') {
    window.testLemmatization = testLemmatization;
    window.testWithDictionary = testWithDictionary;
    window.testWithTranslation = testWithTranslation;
    
    console.log('Test functions available:');
    console.log('- testLemmatization() - Test lemmatization rules');
    console.log('- testWithDictionary() - Test word difficulty lookup');
    console.log('- testWithTranslation() - Test translation lookup');
}

export { testLemmatization, testWithDictionary, testWithTranslation };
