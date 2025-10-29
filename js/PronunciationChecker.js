/**
 * PronunciationChecker Module
 * 发音检查模块 - Pronunciation Checking Module
 * 
 * 功能：
 * - 使用 Web Speech API 录制用户语音
 * - 将语音转换为文本进行识别
 * - 对比用户发音与标准句子，计算准确度分数
 * - 提供发音反馈和改进建议
 */

export class PronunciationChecker {
    constructor() {
        this.recognition = null;
        this.isRecording = false;
        this.targetText = '';
        this.recognizedText = '';
        this.callbacks = {
            onStart: null,
            onResult: null,
            onEnd: null,
            onError: null
        };
        
        this.initializeSpeechRecognition();
    }

    /**
     * 初始化语音识别 - Initialize Speech Recognition
     * 使用 Web Speech API 的 SpeechRecognition 接口
     */
    initializeSpeechRecognition() {
        // 检查浏览器支持 (Check browser support)
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.error('Speech Recognition API is not supported in this browser');
            return;
        }

        this.recognition = new SpeechRecognition();
        
        // 配置语音识别 (Configure speech recognition)
        this.recognition.lang = 'en-US';  // 英语识别 (English recognition)
        this.recognition.continuous = false;  // 单次识别 (Single recognition)
        this.recognition.interimResults = false;  // 只返回最终结果 (Only return final results)
        this.recognition.maxAlternatives = 1;  // 最多返回一个结果 (Maximum one result)

        // 设置事件监听器 (Set up event listeners)
        this.recognition.onstart = () => {
            this.isRecording = true;
            if (this.callbacks.onStart) {
                this.callbacks.onStart();
            }
        };

        this.recognition.onresult = (event) => {
            // 获取识别结果 (Get recognition result)
            const result = event.results[0][0];
            this.recognizedText = result.transcript;
            const confidence = result.confidence;

            // 计算发音分数 (Calculate pronunciation score)
            const score = this.calculatePronunciationScore(this.targetText, this.recognizedText);

            if (this.callbacks.onResult) {
                this.callbacks.onResult({
                    recognized: this.recognizedText,
                    target: this.targetText,
                    score: score,
                    confidence: confidence,
                    feedback: this.generateFeedback(score, this.targetText, this.recognizedText)
                });
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isRecording = false;
            
            if (this.callbacks.onError) {
                this.callbacks.onError(event.error);
            }
        };

        this.recognition.onend = () => {
            this.isRecording = false;
            if (this.callbacks.onEnd) {
                this.callbacks.onEnd();
            }
        };
    }

    /**
     * 开始录音 - Start recording
     * @param {string} targetText - 目标句子 (Target sentence to pronounce)
     */
    startRecording(targetText) {
        if (!this.recognition) {
            throw new Error('Speech recognition is not supported in this browser');
        }

        if (this.isRecording) {
            console.warn('Already recording');
            return;
        }

        this.targetText = targetText.trim().toLowerCase();
        this.recognizedText = '';

        try {
            this.recognition.start();
        } catch (error) {
            console.error('Error starting recording:', error);
            if (this.callbacks.onError) {
                this.callbacks.onError(error.message);
            }
        }
    }

    /**
     * 停止录音 - Stop recording
     */
    stopRecording() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
        }
    }

    /**
     * 计算发音分数 - Calculate pronunciation score
     * 使用 Levenshtein 距离算法和单词匹配算法
     * @param {string} target - 目标文本 (Target text)
     * @param {string} recognized - 识别文本 (Recognized text)
     * @returns {number} 分数 (0-100) (Score 0-100)
     */
    calculatePronunciationScore(target, recognized) {
        const targetLower = target.toLowerCase().trim();
        const recognizedLower = recognized.toLowerCase().trim();

        // 完全匹配 (Perfect match)
        if (targetLower === recognizedLower) {
            return 100;
        }

        // 分词比较 (Word-by-word comparison)
        const targetWords = this.normalizeWords(targetLower);
        const recognizedWords = this.normalizeWords(recognizedLower);

        // 计算单词匹配率 (Calculate word match rate)
        const wordScore = this.calculateWordMatchScore(targetWords, recognizedWords);

        // 计算字符相似度 (Calculate character similarity)
        const charScore = this.calculateLevenshteinSimilarity(targetLower, recognizedLower);

        // 综合评分：60% 单词匹配 + 40% 字符相似度
        // Combined score: 60% word match + 40% character similarity
        const finalScore = Math.round(wordScore * 0.6 + charScore * 0.4);

        return Math.max(0, Math.min(100, finalScore));
    }

    /**
     * 标准化单词数组 - Normalize word array
     * 移除标点符号，转换为小写 (Remove punctuation, convert to lowercase)
     * @param {string} text - 文本 (Text)
     * @returns {Array<string>} 单词数组 (Word array)
     */
    normalizeWords(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')  // 移除标点 (Remove punctuation)
            .split(/\s+/)
            .filter(word => word.length > 0);
    }

    /**
     * 计算单词匹配分数 - Calculate word match score
     * @param {Array<string>} targetWords - 目标单词数组 (Target words)
     * @param {Array<string>} recognizedWords - 识别单词数组 (Recognized words)
     * @returns {number} 分数 (0-100) (Score 0-100)
     */
    calculateWordMatchScore(targetWords, recognizedWords) {
        if (targetWords.length === 0) return 0;

        let matchCount = 0;
        const targetSet = new Set(targetWords);
        const recognizedSet = new Set(recognizedWords);

        // 计算交集 (Calculate intersection)
        for (const word of targetSet) {
            if (recognizedSet.has(word)) {
                matchCount++;
            }
        }

        // 考虑单词顺序 (Consider word order)
        let orderBonus = 0;
        const minLength = Math.min(targetWords.length, recognizedWords.length);
        for (let i = 0; i < minLength; i++) {
            if (targetWords[i] === recognizedWords[i]) {
                orderBonus++;
            }
        }

        // 基础匹配分数 (Base match score)
        const matchRatio = matchCount / targetSet.size;
        
        // 顺序匹配分数 (Order match score)
        const orderRatio = orderBonus / targetWords.length;

        // 长度惩罚（如果识别的单词数量差异太大）(Length penalty)
        const lengthRatio = Math.min(targetWords.length, recognizedWords.length) / 
                           Math.max(targetWords.length, recognizedWords.length);

        // 综合评分 (Combined score)
        return Math.round((matchRatio * 0.5 + orderRatio * 0.3 + lengthRatio * 0.2) * 100);
    }

    /**
     * 计算 Levenshtein 相似度 - Calculate Levenshtein similarity
     * @param {string} str1 - 字符串1 (String 1)
     * @param {string} str2 - 字符串2 (String 2)
     * @returns {number} 相似度分数 (0-100) (Similarity score 0-100)
     */
    calculateLevenshteinSimilarity(str1, str2) {
        const distance = this.levenshteinDistance(str1, str2);
        const maxLength = Math.max(str1.length, str2.length);
        
        if (maxLength === 0) return 100;
        
        const similarity = ((maxLength - distance) / maxLength) * 100;
        return Math.round(similarity);
    }

    /**
     * Levenshtein 距离算法 - Levenshtein distance algorithm
     * 计算两个字符串之间的编辑距离 (Calculate edit distance between two strings)
     * @param {string} str1 - 字符串1 (String 1)
     * @param {string} str2 - 字符串2 (String 2)
     * @returns {number} 编辑距离 (Edit distance)
     */
    levenshteinDistance(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;
        const dp = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

        for (let i = 0; i <= len1; i++) {
            dp[i][0] = i;
        }

        for (let j = 0; j <= len2; j++) {
            dp[0][j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                if (str1[i - 1] === str2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = Math.min(
                        dp[i - 1][j] + 1,    // 删除 (deletion)
                        dp[i][j - 1] + 1,    // 插入 (insertion)
                        dp[i - 1][j - 1] + 1 // 替换 (substitution)
                    );
                }
            }
        }

        return dp[len1][len2];
    }

    /**
     * 生成发音反馈 - Generate pronunciation feedback
     * @param {number} score - 分数 (Score)
     * @param {string} target - 目标文本 (Target text)
     * @param {string} recognized - 识别文本 (Recognized text)
     * @returns {Object} 反馈对象 (Feedback object)
     */
    generateFeedback(score, target, recognized) {
        let level = '';
        let message = '';
        let suggestions = [];

        // 评分等级 (Score levels)
        if (score >= 90) {
            level = 'excellent';
            message = '🎉 Excellent! Your pronunciation is very accurate!';
        } else if (score >= 75) {
            level = 'good';
            message = '👍 Good job! Your pronunciation is quite clear.';
            suggestions.push('Try to speak a bit more clearly for even better results.');
        } else if (score >= 60) {
            level = 'fair';
            message = '😊 Not bad! Keep practicing to improve.';
            suggestions.push('Pay attention to word endings and pronunciation.');
            suggestions.push('Try to speak more slowly and clearly.');
        } else {
            level = 'needs-improvement';
            message = '💪 Keep practicing! Pronunciation takes time to master.';
            suggestions.push('Break down the sentence into smaller parts.');
            suggestions.push('Listen to native speakers and try to imitate.');
            suggestions.push('Practice individual words first.');
        }

        // 找出差异的单词 (Find different words)
        const targetWords = this.normalizeWords(target);
        const recognizedWords = this.normalizeWords(recognized);
        const missingWords = targetWords.filter(word => !recognizedWords.includes(word));
        const extraWords = recognizedWords.filter(word => !targetWords.includes(word));

        if (missingWords.length > 0) {
            suggestions.push(`Missing words: ${missingWords.join(', ')}`);
        }

        if (extraWords.length > 0) {
            suggestions.push(`Extra words detected: ${extraWords.join(', ')}`);
        }

        return {
            level,
            message,
            suggestions,
            score
        };
    }

    /**
     * 设置回调函数 - Set callback functions
     * @param {string} event - 事件名称 (Event name)
     * @param {Function} callback - 回调函数 (Callback function)
     */
    on(event, callback) {
        if (this.callbacks.hasOwnProperty('on' + event.charAt(0).toUpperCase() + event.slice(1))) {
            this.callbacks['on' + event.charAt(0).toUpperCase() + event.slice(1)] = callback;
        }
    }

    /**
     * 检查是否支持语音识别 - Check if speech recognition is supported
     * @returns {boolean} 是否支持 (Is supported)
     */
    static isSupported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }
}
