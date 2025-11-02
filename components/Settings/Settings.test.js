/**
 * Test file for SettingsComponent
 * Tests the fix for the "Cannot read properties of null" error
 */

// Mock DOM elements for testing
function createMockDOM() {
    // Create a mock container for our modal
    const container = document.createElement('div');
    container.innerHTML = `
        <div class="modal" id="settingsModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Settings</h2>
                    <button class="close-btn"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-body">
                    <!-- Content will be injected here -->
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(container);
    
    return container;
}

// Mock dependencies
class MockSettingsManager {
    constructor() {
        this.settings = {
            highlightOpacity: 0.7,
            highlightColor: '#ffeb3b',
            difficultyLevel: 'intermediate',
            highlightMode: 'difficult'
        };
    }
    
    getAllSettings() {
        return this.settings;
    }
    
    setSetting(key, value) {
        this.settings[key] = value;
    }
    
    exportSettings() {
        return this.settings;
    }
    
    importSettings(data) {
        this.settings = {...this.settings, ...data};
        return true;
    }
}

class MockGoogleDriveManager {
    constructor() {}
}

class MockApp {
    showNotification(message, type = 'success') {
        console.log(`Notification: ${message} (${type})`);
    }
    
    downloadJSON(data, filename) {
        console.log(`Downloading ${filename} with data:`, data);
    }
}

// Test functions
async function testSettingsComponentInitialization() {
    console.log('Testing SettingsComponent initialization...');
    
    try {
        // Create mock dependencies
        const settingsManager = new MockSettingsManager();
        const googleDriveManager = new MockGoogleDriveManager();
        const app = new MockApp();
        
        // Import and initialize SettingsComponent
        const { SettingsComponent } = await import('./Settings.js');
        const settingsComponent = new SettingsComponent(settingsManager, googleDriveManager);
        settingsComponent.setApp(app);
        
        console.log('✓ SettingsComponent initialized successfully');
        return settingsComponent;
    } catch (error) {
        console.error('❌ SettingsComponent initialization failed:', error);
        return null;
    }
}

async function testAddEventListenersWithMissingElements() {
    console.log('Testing addEventListeners with missing DOM elements...');
    
    try {
        // Create mock dependencies
        const settingsManager = new MockSettingsManager();
        const googleDriveManager = new MockGoogleDriveManager();
        const app = new MockApp();
        
        // Import SettingsComponent
        const { SettingsComponent } = await import('./Settings.js');
        const settingsComponent = new SettingsComponent(settingsManager, googleDriveManager);
        settingsComponent.setApp(app);
        
        // Try to add event listeners without rendering content first
        // This should not throw an error after our fix
        settingsComponent.addEventListeners();
        
        console.log('✓ addEventListeners handled missing elements correctly');
        return true;
    } catch (error) {
        console.error('❌ addEventListeners failed with missing elements:', error);
        return false;
    }
}

async function testOpenMethod() {
    console.log('Testing SettingsComponent open method...');
    
    try {
        // Create mock DOM
        createMockDOM();
        
        // Create mock dependencies
        const settingsManager = new MockSettingsManager();
        const googleDriveManager = new MockGoogleDriveManager();
        const app = new MockApp();
        
        // Import SettingsComponent
        const { SettingsComponent } = await import('./Settings.js');
        const settingsComponent = new SettingsComponent(settingsManager, googleDriveManager);
        settingsComponent.setApp(app);
        
        // Call open method
        settingsComponent.open();
        
        console.log('✓ SettingsComponent open method executed successfully');
        return true;
    } catch (error) {
        console.error('❌ SettingsComponent open method failed:', error);
        return false;
    }
}

// Run all tests
async function runSettingsTests() {
    console.log('Running SettingsComponent tests...\n');
    
    let passed = 0;
    let total = 0;
    
    // Test 1: Initialization
    total++;
    const component = await testSettingsComponentInitialization();
    if (component) passed++;
    
    // Test 2: addEventListeners with missing elements
    total++;
    if (await testAddEventListenersWithMissingElements()) passed++;
    
    // Test 3: open method
    total++;
    if (await testOpenMethod()) passed++;
    
    console.log(`\n${passed}/${total} tests passed`);
    
    if (passed === total) {
        console.log('🎉 All SettingsComponent tests passed!');
    } else {
        console.log('❌ Some tests failed');
    }
    
    return passed === total;
}

// Make test functions available globally
window.runSettingsTests = runSettingsTests;

console.log('SettingsComponent test functions available:');
console.log('- runSettingsTests() - Run all tests');

export { runSettingsTests };