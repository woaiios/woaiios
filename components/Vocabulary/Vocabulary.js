import { Modal } from '../Modal/Modal.js';

export class VocabularyComponent {
    constructor(vocabularyManager) {
        this.vocabularyManager = vocabularyManager;
        this.modal = new Modal('#vocabularyModal', 'My Vocabulary');
        this.app = null; // Will be set by the main app
    }

    setApp(app) {
        this.app = app;
    }

    open() {
        this.modal.open(this.renderContent());
        this.addEventListeners();
        this.updateAndRenderLists();
    }

    addEventListeners() {
        document.querySelectorAll('.vocab-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.handleTabClick(e));
        });
        document.getElementById('exportVocabBtn').addEventListener('click', () => this.onExportVocabulary());
        document.getElementById('importVocabBtn').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.onImportFileChange(e));
        document.getElementById('clearVocabBtn').addEventListener('click', () => this.onClearVocabulary());
    }

    renderContent() {
        return `
            <div class="vocab-controls">
                <button class="btn btn-primary" id="exportVocabBtn"><i class="fas fa-download"></i> Export</button>
                <button class="btn btn-secondary" id="importVocabBtn"><i class="fas fa-upload"></i> Import</button>
                <input type="file" id="importFile" accept=".json" style="display: none;">
                <button class="btn btn-danger" id="clearVocabBtn"><i class="fas fa-trash"></i> Clear All</button>
            </div>
            <div class="vocab-tabs">
                <button class="vocab-tab active" data-tab="learning">Learning (<span id="learning-count">0</span>)</button>
                <button class="vocab-tab" data-tab="mastered">Mastered (<span id="mastered-count">0</span>)</button>
            </div>
            <div id="learning-list-container" class="vocab-tab-content active">
                <div class="vocab-list" id="learning-list"></div>
            </div>
            <div id="mastered-list-container" class="vocab-tab-content">
                <div class="vocab-list" id="mastered-list"></div>
            </div>
        `;
    }

    updateAndRenderLists() {
        const learningListEl = document.getElementById('learning-list');
        const masteredListEl = document.getElementById('mastered-list');
        if (!learningListEl || !masteredListEl) return;

        const learningWords = this.vocabularyManager.getSortedByDate(this.vocabularyManager.learningWords);
        this.renderList(learningListEl, learningWords, 'learning');

        const masteredWords = this.vocabularyManager.getSortedByDate(this.vocabularyManager.masteredWords);
        this.renderList(masteredListEl, masteredWords, 'mastered');
        
        this.updateCounts();
    }

    renderList(element, wordList, type) {
        element.innerHTML = '';
        if (wordList.length === 0) {
            element.innerHTML = `<p style="text-align: center; color: #6b7280; padding: 2rem;">No words in this list yet.</p>`;
            return;
        }

        wordList.forEach(([word, data]) => {
            const actionButton = type === 'learning'
                ? `<button class="btn btn-sm btn-success master-btn" data-word="${word}"><i class="fas fa-check"></i> Master</button>`
                : `<button class="btn btn-sm btn-info unmaster-btn" data-word="${word}"><i class="fas fa-undo"></i> Learn</button>`;

            const vocabItem = document.createElement('div');
            vocabItem.className = 'vocab-item';
            vocabItem.innerHTML = `
                <div>
                    <div class="vocab-word">${word}</div>
                    <div class="vocab-translation">${data.translation}</div>
                    <div class="vocab-meta">Added: ${new Date(data.addedDate).toLocaleDateString()}</div>
                </div>
                <div class="vocab-actions">
                    ${actionButton}
                    <button class="btn btn-sm btn-danger delete-btn" data-word="${word}"><i class="fas fa-trash"></i></button>
                </div>
            `;
            element.appendChild(vocabItem);
        });

        // Add event listeners for the new buttons
        element.querySelectorAll('.master-btn').forEach(btn => btn.addEventListener('click', (e) => this.masterWord(e.currentTarget.dataset.word)));
        element.querySelectorAll('.unmaster-btn').forEach(btn => btn.addEventListener('click', (e) => this.unmasterWord(e.currentTarget.dataset.word)));
        element.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', (e) => this.removeFromVocabulary(e.currentTarget.dataset.word)));
    }

    updateCounts() {
        const learningSize = this.vocabularyManager.getLearningSize();
        const masteredSize = this.vocabularyManager.masteredWords.size;
        
        const vocabCountEl = document.getElementById('vocabCount');
        if (vocabCountEl) {
            vocabCountEl.textContent = learningSize;
        }

        // Only update modal counts if modal is open (elements exist in DOM)
        const learningCountEl = document.getElementById('learning-count');
        if (learningCountEl) {
            learningCountEl.textContent = learningSize;
        }

        const masteredCountEl = document.getElementById('mastered-count');
        if (masteredCountEl) {
            masteredCountEl.textContent = masteredSize;
        }
    }

    handleTabClick(event) {
        const clickedTab = event.target;
        const tabName = clickedTab.dataset.tab;
        document.querySelectorAll('.vocab-tab').forEach(tab => tab.classList.remove('active'));
        clickedTab.classList.add('active');
        document.querySelectorAll('.vocab-tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-list-container`).classList.add('active');
    }

    masterWord(word) {
        if (this.vocabularyManager.masterWord(word)) {
            this.updateAndRenderLists();
            this.app.showNotification(`'${word}' moved to mastered list.`);
            this.app.refreshTextAnalysis(); // 添加这行
        }
    }

    unmasterWord(word) {
        if (this.vocabularyManager.unmasterWord(word)) {
            this.updateAndRenderLists();
            this.app.showNotification(`'${word}' moved back to learning list.`);
            this.app.refreshTextAnalysis(); // 添加这行
        }
    }

    removeFromVocabulary(word) {
        if (confirm(`Are you sure you want to permanently delete "${word}"?`)) {
            if (this.vocabularyManager.removeWord(word)) {
                this.updateAndRenderLists();
                this.app.showNotification(`'${word}' has been deleted.`, 'info');
                this.app.refreshTextAnalysis(); // 添加这行
            }
        }
    }

    onExportVocabulary() {
        const data = this.vocabularyManager.exportVocabulary();
        this.app.downloadJSON(data, 'word-discoverer-vocabulary.json');
        this.app.showNotification('Vocabulary exported successfully!');
    }

    onImportFileChange(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (this.vocabularyManager.importVocabulary(data)) {
                    this.updateAndRenderLists();
                    this.app.showNotification('Vocabulary imported successfully!');
                    this.app.refreshTextAnalysis(); // 添加这行
                } else {
                    this.app.showNotification('Error importing vocabulary. Check file format.', 'error');
                }
            } catch (error) {
                this.app.showNotification('Error importing vocabulary. Check file format.', 'error');
            }
        };
        reader.readAsText(file);
    }

    onClearVocabulary() {
        if (confirm('Clear all vocabulary (both learning and mastered)? This action cannot be undone.')) {
            this.vocabularyManager.clearVocabulary();
            this.updateAndRenderLists();
            this.app.showNotification('All vocabulary has been cleared.');
            this.app.refreshTextAnalysis(); // 添加这行
        }
    }
}