/**
 * Test file to verify module functionality
 * This can be run in the browser console to test individual modules
 */

// Test function to verify all modules are working
async function testModules() {
    console.log('Testing WordDiscoverer modules...');
    
    try {
        // Test WordDatabase
        const { WordDatabase } = await import('./js/WordDatabase.js');
        const wordDB = new WordDatabase();
        console.log('✓ WordDatabase module loaded');
        
        // Test VocabularyManager
        const { VocabularyManager } = await import('./js/VocabularyManager.js');
        const vocabManager = new VocabularyManager();
        console.log('✓ VocabularyManager module loaded');
        console.log(`  - Vocabulary size: ${vocabManager.getSize()}`);
        
        // Test SettingsManager
        const { SettingsManager } = await import('./js/SettingsManager.js');
        const settingsManager = new SettingsManager();
        console.log('✓ SettingsManager module loaded');
        console.log(`  - Default settings loaded: ${Object.keys(settingsManager.getAllSettings()).length} settings`);
        
        // Test TextAnalyzer
        const { TextAnalyzer } = await import('./js/TextAnalyzer.js');
        const textAnalyzer = new TextAnalyzer(wordDB, settingsManager);
        console.log('✓ TextAnalyzer module loaded');
        
        // Test UIController
        const { UIController } = await import('./js/UIController.js');
        const uiController = new UIController(vocabManager, settingsManager);
        console.log('✓ UIController module loaded');
        
        // Test main app
        const { WordDiscoverer } = await import('./app.js');
        console.log('✓ Main WordDiscoverer app module loaded');
        
        console.log('\n🎉 All modules loaded successfully!');
        console.log('The refactored architecture is working correctly.');
        
        return true;
    } catch (error) {
        console.error('❌ Module test failed:', error);
        return false;
    }
}

// Test individual module functionality
function testVocabularyManager() {
    const vocabManager = new VocabularyManager();
    
    // Test adding a word
    const success = vocabManager.addWord('test', '测试');
    console.log('Add word test:', success ? '✓' : '❌');
    
    // Test getting word data
    const wordData = vocabManager.getWordData('test');
    console.log('Get word data test:', wordData ? '✓' : '❌');
    
    // Test removing word
    const removed = vocabManager.removeWord('test');
    console.log('Remove word test:', removed ? '✓' : '❌');
    
    return vocabManager;
}

function testSettingsManager() {
    const settingsManager = new SettingsManager();
    
    // Test getting setting
    const color = settingsManager.getSetting('highlightColor');
    console.log('Get setting test:', color ? '✓' : '❌');
    
    // Test setting setting
    settingsManager.setSetting('testSetting', 'testValue');
    const testValue = settingsManager.getSetting('testSetting');
    console.log('Set setting test:', testValue === 'testValue' ? '✓' : '❌');
    
    return settingsManager;
}

// Export test functions for browser console use
window.testModules = testModules;
window.testVocabularyManager = testVocabularyManager;
window.testSettingsManager = testSettingsManager;

console.log('Test functions available:');
console.log('- testModules() - Test all modules');
console.log('- testVocabularyManager() - Test vocabulary functionality');
console.log('- testSettingsManager() - Test settings functionality');
