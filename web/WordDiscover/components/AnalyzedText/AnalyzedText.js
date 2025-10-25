import { Component } from '../Component.js';

export class AnalyzedTextComponent extends Component {
    constructor(selector, vocabularyManager) {
        super(selector);
        this.vocabularyManager = vocabularyManager;
        this.app = null;
    }

    setApp(app) {
        this.app = app;
    }

    render(processedText) {
        this.element.innerHTML = processedText;
        this.addEventListeners();
    }

    addEventListeners() {
        this.element.querySelectorAll('.word-span').forEach(element => {
            let pressTimer;
            let longPress = false;

            const word = element.dataset.word;
            const translation = element.dataset.translation;

            element.addEventListener('touchstart', (e) => {
                e.preventDefault();
                longPress = false;
                pressTimer = window.setTimeout(() => {
                    longPress = true;
                    this.handleWordUnmaster(word);
                }, 500);
            }, { passive: false });

            element.addEventListener('touchend', () => {
                clearTimeout(pressTimer);
                if (!longPress) {
                    this.handleWordMaster(word, translation);
                }
            });

            element.addEventListener('touchmove', () => {
                clearTimeout(pressTimer);
            });

            element.addEventListener('click', () => {
                this.handleWordMaster(word, translation);
            });
        });
    }

    handleWordMaster(word, translation) {
        const result = this.vocabularyManager.masterWord(word, translation);
        if (result === 'added_to_mastered' || result === 'moved_to_mastered') {
            this.app.showNotification(`✅ '${word}' marked as mastered.`);
        }
        this.app.updateCounts();
    }

    handleWordUnmaster(word) {
        const result = this.vocabularyManager.unmasterWord(word);
        if (result === 'moved_to_learning') {
            this.app.showNotification(`📖 '${word}' moved to learning list.`);
            this.app.updateCounts();
        }
    }
}
