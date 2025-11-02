/**
 * UIRenderer - UI 渲染器
 * 负责更新统计信息和高亮词汇列表的显示
 * (Handles rendering of statistics and highlighted words list)
 */
import { batchDOMUpdate } from '../PerformanceUtils.js';

export class UIRenderer {
    /**
     * 更新统计信息 - Update statistics
     * @param {Object} analysis - 分析结果对象 (Analysis result object)
     */
    static updateStatistics(analysis) {
        batchDOMUpdate(() => {
            document.getElementById('totalWords').textContent = analysis.totalWords;
            document.getElementById('highlightedWords').textContent = analysis.highlightedWords.length;
            document.getElementById('newWords').textContent = analysis.newWords.length;
            document.getElementById('difficultyScore').textContent = analysis.difficultyScore;
        });
    }

    /**
     * 显示高亮词汇列表 - Display highlighted words list
     * @param {Array} highlightedWords - 高亮词汇数组 (Array of highlighted words)
     */
    static displayHighlightedWords(highlightedWords) {
        const container = document.getElementById('highlightedWordsContainer');
        container.innerHTML = '';

        if (highlightedWords.length === 0) {
            container.innerHTML = '<p>No highlighted words found.</p>';
            return;
        }

        const NO_TRANSLATION_TEXT = '无翻译'; // 本地化常量

        highlightedWords.forEach(wordInfo => {
            const wordItem = document.createElement('div');
            wordItem.className = 'highlighted-word-item';
            
            // 解析 HTML 翻译以提取发音和释义
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = wordInfo.translation;
            
            let pronunciation = '';
            let translation = '';
            
            // 从紧凑格式中提取发音和翻译
            const phoneticElement = tempDiv.querySelector('.phonetic-line');
            if (phoneticElement) {
                pronunciation = phoneticElement.textContent.trim();
            }
            
            const translationElement = tempDiv.querySelector('.translation-compact p');
            if (translationElement) {
                translation = translationElement.textContent.trim();
            }
            
            // 向后兼容旧格式
            if (!pronunciation && !translation) {
                const pronElement = tempDiv.querySelector('.pron');
                if (pronElement) {
                    pronunciation = pronElement.textContent.trim();
                }
                
                const transElement = tempDiv.querySelector('.trans');
                if (transElement) {
                    translation = transElement.textContent.trim();
                }
            }
            
            // 如果仍然无法解析，尝试从任何 <p> 标签提取
            if (!translation) {
                const firstP = tempDiv.querySelector('p');
                if (firstP) {
                    translation = firstP.textContent.trim();
                }
            }
            
            // 单词和音标显示在同一行
            const wordDiv = document.createElement('div');
            wordDiv.className = 'word';
            wordDiv.textContent = pronunciation ? `${wordInfo.word} ${pronunciation}` : wordInfo.word;
            wordItem.appendChild(wordDiv);
            
            const transDiv = document.createElement('div');
            transDiv.className = 'translation';
            transDiv.textContent = translation || NO_TRANSLATION_TEXT;
            wordItem.appendChild(transDiv);
            
            container.appendChild(wordItem);
        });
    }

    /**
     * 清空文本和分析结果 - Clear text and analysis results
     */
    static clearText() {
        batchDOMUpdate(() => {
            const textInput = document.getElementById('textInput');
            textInput.value = '';
            
            // 隐藏分析结果区域
            document.getElementById('analyzedTextSection').style.display = 'none';
            document.getElementById('statistics').style.display = 'none';
            document.getElementById('highlightedWordsList').style.display = 'none';
            
            // 清空分析文本显示
            document.getElementById('analyzedText').innerHTML = '';
            
            // 重置统计数字
            document.getElementById('totalWords').textContent = '0';
            document.getElementById('highlightedWords').textContent = '0';
            document.getElementById('newWords').textContent = '0';
            document.getElementById('difficultyScore').textContent = '0';
            
            // 清空高亮词汇列表
            document.getElementById('highlightedWordsContainer').innerHTML = '';
        });
    }

    /**
     * 显示分析结果区域 - Show analysis result sections
     */
    static showAnalysisResults() {
        batchDOMUpdate(() => {
            document.getElementById('analyzedTextSection').style.display = 'block';
            document.getElementById('statistics').style.display = 'flex';
            document.getElementById('highlightedWordsList').style.display = 'block';
        });
    }
}
