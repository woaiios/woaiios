/**
 * WordLemmatizer Module
 * 词形还原模块
 * 
 * 功能特性 (Features):
 * - 将单词还原为词根形式 (Convert words to their base/root form)
 * - 使用 wink-lemmatizer 库进行专业词形还原 (Use wink-lemmatizer library for professional lemmatization)
 * - 自定义规则作为后备方案 (Custom rules as fallback)
 * - 处理动词、名词、形容词的各种变形 (Handle verb, noun, adjective inflections)
 * - 支持美英拼写差异 (Support American/British spelling variants)
 * 
 * 词形还原示例 (Lemmatization examples):
 * - running -> run (去除 -ing 后缀)
 * - studied -> study (处理过去式)
 * - bigger -> big (处理比较级)
 * - happiness -> happy (处理名词后缀)
 */

// 动态导入 wink-lemmatizer (Dynamic import for wink-lemmatizer)
let winkLemmatizer = null;
let winkLemmatizerPromise = null;

/**
 * 异步初始化 wink-lemmatizer - Initialize wink-lemmatizer asynchronously
 * 应用启动时立即加载，避免首次使用时延迟 (Load immediately on app start to avoid first-use delay)
 * @returns {Promise<void>}
 */
function initWinkLemmatizer() {
    if (!winkLemmatizerPromise) {
        winkLemmatizerPromise = (async () => {
            try {
                const module = await import('wink-lemmatizer');
                winkLemmatizer = module.default;
            } catch (error) {
                // 如果加载失败，静默回退到自定义规则 (Silently fall back to custom rules if loading fails)
                winkLemmatizer = null;
            }
        })();
    }
    return winkLemmatizerPromise;
}

// 立即开始加载 (Start loading immediately)
initWinkLemmatizer();

export class WordLemmatizer {
    /**
     * 美英拼写变体映射表 - Map of American to British spelling variants
     * 用于处理字典查找时的拼写差异 (Handle spelling differences in dictionary lookups)
     * 
     * 示例 (Examples):
     * - color (美) <-> colour (英)
     * - center (美) <-> centre (英)
     * - meter (美) <-> metre (英)
     */
    static spellingVariants = {
        // 美式 -> 英式 (American -> British)
        'meter': 'metre',
        'kilometer': 'kilometre',
        'centimeter': 'centimetre',
        'millimeter': 'millimetre',
        'liter': 'litre',
        'milliliter': 'millilitre',
        'fiber': 'fibre',
        'center': 'centre',
        'theater': 'theatre',
        'color': 'colour',
        'favor': 'favour',
        'honor': 'honour',
        'labor': 'labour',
        'neighbor': 'neighbour',
        'flavor': 'flavour',
        'humor': 'humour',
        // 英式 -> 美式 (British -> American - for reverse lookup)
        'metre': 'meter',
        'kilometre': 'kilometer',
        'centimetre': 'centimeter',
        'millimetre': 'millimeter',
        'litre': 'liter',
        'millilitre': 'milliliter',
        'fibre': 'fiber',
        'centre': 'center',
        'theatre': 'theater',
        'colour': 'color',
        'favour': 'favor',
        'honour': 'honor',
        'labour': 'labor',
        'neighbour': 'neighbor',
        'flavour': 'flavor',
        'humour': 'humor'
    };

    /**
     * 词形还原主方法 - Main lemmatization method
     * 使用 wink-lemmatizer 并结合自定义规则 (Use wink-lemmatizer with custom rules)
     * @param {string} word - 要还原的单词 (Word to lemmatize)
     * @returns {Array<string>} 可能的词根形式数组（第一个是原词，其余是候选词根）(Possible base forms - first is original, rest are candidates)
     */
    static lemmatize(word) {
        const lowerWord = word.toLowerCase();
        const candidates = [lowerWord]; // 始终包含原始单词 (Always include the original word)
        
        // 尝试使用 wink-lemmatizer（如果可用）(Try wink-lemmatizer if available)
        if (winkLemmatizer) {
            try {
                // 分别作为名词、动词和形容词处理以获取所有可能的词根 (Try as noun, verb, adjective to get all possible lemmas)
                const nounLemma = winkLemmatizer.noun(lowerWord);
                const verbLemma = winkLemmatizer.verb(lowerWord);
                const adjLemma = winkLemmatizer.adjective(lowerWord);
                
                if (nounLemma !== lowerWord) candidates.push(nounLemma);
                if (verbLemma !== lowerWord) candidates.push(verbLemma);
                if (adjLemma !== lowerWord) candidates.push(adjLemma);
            } catch (error) {
                // 如果遇到错误，回退到自定义规则 (Fall back to custom rules if error occurs)
            }
        }
        
        // 后备方案：应用自定义词形还原规则 (Fallback: Apply custom lemmatization rules)
        this.applyCustomRules(lowerWord, candidates);
        
        // 为所有候选词添加拼写变体 (Add spelling variants for all candidates)
        const allCandidates = [...candidates];
        allCandidates.forEach(candidate => {
            const variant = this.spellingVariants[candidate];
            if (variant) {
                candidates.push(variant);
            }
        });
        
        // 去重并返回 (Remove duplicates and return)
        return [...new Set(candidates)];
    }

    /**
     * 应用自定义词形还原规则 - Apply custom lemmatization rules (fallback)
     * 当 wink-lemmatizer 不可用时的后备方案 (Fallback when wink-lemmatizer is unavailable)
     * @param {string} lowerWord - 小写单词 (Lowercase word)
     * @param {Array<string>} candidates - 候选词根数组（会被修改）(Array to add candidates to - will be modified)
     */
    static applyCustomRules(lowerWord, candidates) {
        // 规则 1: 复数形式 -s, -es (Rule 1: Plurals ending in -s, -es)
        if (lowerWord.endsWith('sses')) {
            // classes -> class
            candidates.push(lowerWord.slice(0, -2));
        } else if (lowerWord.endsWith('ies') && lowerWord.length > 4) {
            // flies -> fly, studies -> study (y 变化规则)
            candidates.push(lowerWord.slice(0, -3) + 'y');
        } else if (lowerWord.endsWith('es') && lowerWord.length > 3) {
            // boxes -> box, watches -> watch
            candidates.push(lowerWord.slice(0, -2));
            // 也尝试只删除 's' (Also try removing just 's')
            candidates.push(lowerWord.slice(0, -1));
        } else if (lowerWord.endsWith('s') && lowerWord.length > 2 && !lowerWord.endsWith('ss') && !lowerWord.endsWith('us')) {
            // cats -> cat (但不处理 class -> clas 或 bus -> bu)
            candidates.push(lowerWord.slice(0, -1));
        }
        
        // 规则 2: -ing 形式（现在分词）(Rule 2: -ing forms - present participle)
        if (lowerWord.endsWith('ing') && lowerWord.length > 4) {
            const stem = lowerWord.slice(0, -3);
            candidates.push(stem);
            // running -> run (辅音字母双写规则) (doubled consonant)
            if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2] && 
                /[bcdfghjklmnpqrstvwxyz]/.test(stem[stem.length - 1])) {
                candidates.push(stem.slice(0, -1));
            }
            // making -> make (去e规则) (e-drop rule)
            candidates.push(stem + 'e');
        }
        
        // 规则 3: -ed 形式（过去式/过去分词）(Rule 3: -ed forms - past tense/participle)
        if (lowerWord.endsWith('ed') && lowerWord.length > 3) {
            const stem = lowerWord.slice(0, -2);
            candidates.push(stem);
            // stopped -> stop (辅音字母双写规则) (doubled consonant)
            if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2] && 
                /[bcdfghjklmnpqrstvwxyz]/.test(stem[stem.length - 1])) {
                candidates.push(stem.slice(0, -1));
            }
            // liked -> like (去e规则) (e-drop rule)
            candidates.push(stem + 'e');
        }
        
        // 规则 4: -er/-est (比较级/最高级) (Rule 4: -er/-est - comparative/superlative)
        if (lowerWord.endsWith('est') && lowerWord.length > 4) {
            const stem = lowerWord.slice(0, -3);
            candidates.push(stem);
            // biggest -> big (辅音字母双写规则) (doubled consonant)
            if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2] && 
                /[bcdfghjklmnpqrstvwxyz]/.test(stem[stem.length - 1])) {
                candidates.push(stem.slice(0, -1));
            }
            // nicest -> nice (去e规则) (e-drop rule)
            candidates.push(stem + 'e');
            // happiest -> happy (y变化规则) (y change rule)
            if (stem.endsWith('i')) {
                candidates.push(stem.slice(0, -1) + 'y');
            }
        } else if (lowerWord.endsWith('er') && lowerWord.length > 3) {
            const stem = lowerWord.slice(0, -2);
            candidates.push(stem);
            // bigger -> big (辅音字母双写规则) (doubled consonant)
            if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2] && 
                /[bcdfghjklmnpqrstvwxyz]/.test(stem[stem.length - 1])) {
                candidates.push(stem.slice(0, -1));
            }
            // nicer -> nice (去e规则) (e-drop rule)
            candidates.push(stem + 'e');
            // happier -> happy (y变化规则) (y change rule)
            if (stem.endsWith('i')) {
                candidates.push(stem.slice(0, -1) + 'y');
            }
        }
        
        // 规则 5: -ly (副词后缀) (Rule 5: -ly - adverbs)
        if (lowerWord.endsWith('ly') && lowerWord.length > 4) {
            const stem = lowerWord.slice(0, -2);
            candidates.push(stem);
            // happily -> happy (y变化规则) (y change rule)
            if (stem.endsWith('i')) {
                candidates.push(stem.slice(0, -1) + 'y');
            }
        }
        
        // 规则 6: -ic 形容词后缀 (Rule 6: -ic adjectives)
        // meteoric -> meteor, volcanic -> volcano, historic -> history
        if (lowerWord.endsWith('ic') && lowerWord.length > 4) {
            const stem = lowerWord.slice(0, -2);
            candidates.push(stem);
            // volcanic -> volcano (ic -> o)
            if (stem.endsWith('an')) {
                candidates.push(stem + 'o');
            }
            // historic -> history (ic -> y) (某些词需要额外转换)
            if (stem.endsWith('or')) {
                candidates.push(stem.slice(0, -2) + 'y');
            }
        }
        
        // 规则 7: -ical 形容词后缀 (Rule 7: -ical adjectives)
        // historical -> history, geological -> geology
        if (lowerWord.endsWith('ical') && lowerWord.length > 6) {
            const stem = lowerWord.slice(0, -4);
            candidates.push(stem);
            // 尝试将 -ical 替换为 -y (Try replacing -ical with -y)
            candidates.push(stem.slice(0, -2) + 'y');
        }
        
        // 规则 8: -al 形容词后缀 (Rule 8: -al adjectives)
        // coastal -> coast, glacial -> glacier
        if (lowerWord.endsWith('al') && lowerWord.length > 4) {
            const stem = lowerWord.slice(0, -2);
            candidates.push(stem);
            // glacial -> glacier (al -> er)
            if (stem.endsWith('ci')) {
                candidates.push(stem + 'er');
            }
            // trial -> try (y变化规则) (y change rule)
            if (stem.endsWith('i')) {
                candidates.push(stem.slice(0, -1) + 'y');
            }
        }
        
        // 规则 9: -ous 形容词后缀 (Rule 9: -ous adjectives)
        // famous -> fame, nervous -> nerve
        if (lowerWord.endsWith('ous') && lowerWord.length > 5) {
            const stem = lowerWord.slice(0, -3);
            candidates.push(stem);
            // famous -> fame, nervous -> nerve (ous -> e)
            if (!stem.endsWith('e')) {
                candidates.push(stem + 'e');
            }
        }
        
        // 规则 10: -ive 形容词后缀 (Rule 10: -ive adjectives)
        // active -> act, creative -> create
        if (lowerWord.endsWith('ive') && lowerWord.length > 5) {
            const stem = lowerWord.slice(0, -3);
            // active -> act (直接去除 'ive') (stem without 'ive')
            if (!candidates.includes(stem)) {
                candidates.push(stem);
            }
            // creative -> create (去e后加ive规则) (drop e before ive)
            if (!stem.endsWith('e')) {
                candidates.push(stem + 'e');
            }
        }
        
        // 规则 11: -tion/-sion 名词后缀 (Rule 11: -tion/-sion nouns)
        // action -> act, decision -> decide
        if (lowerWord.endsWith('tion') && lowerWord.length > 6) {
            const stem = lowerWord.slice(0, -4);
            candidates.push(stem);
            // action -> act (tion -> t)
            candidates.push(stem + 't');
            // creation -> create (tion -> te)
            candidates.push(stem + 'te');
        } else if (lowerWord.endsWith('sion') && lowerWord.length > 6) {
            const stem = lowerWord.slice(0, -4);
            candidates.push(stem);
            // decision -> decide (sion -> de)
            candidates.push(stem + 'de');
            // expansion -> expand (sion -> d)
            candidates.push(stem + 'd');
        }
        
        // 规则 12: -ness 名词后缀 (Rule 12: -ness nouns)
        // happiness -> happy, darkness -> dark
        if (lowerWord.endsWith('ness') && lowerWord.length > 6) {
            const stem = lowerWord.slice(0, -4);
            candidates.push(stem);
            // happiness -> happy (iness -> y) (y变化规则)
            if (stem.endsWith('i')) {
                candidates.push(stem.slice(0, -1) + 'y');
            }
        }
        
        // 规则 13: -ment 名词后缀 (Rule 13: -ment nouns)
        // development -> develop, enjoyment -> enjoy
        if (lowerWord.endsWith('ment') && lowerWord.length > 6) {
            const stem = lowerWord.slice(0, -4);
            candidates.push(stem);
        }
    }

    /**
     * 通过数据库查找最佳词根形式 - Find the best base form by checking against a word database
     * 从候选词根中找到第一个在数据库中存在的词 (Find the first candidate that exists in the database)
     * @param {string} word - 要查找词根的单词 (Word to find base form for)
     * @param {Function} checkFn - 检查单词是否存在于数据库的函数 (Function that checks if a word exists in database)
     * @returns {string|null} 找到的最佳词根形式，如果都不存在则返回 null (Best base form found, or null if none found)
     */
    static findBaseForm(word, checkFn) {
        const lemmas = this.lemmatize(word);
        // 遍历所有候选词根，返回第一个存在的 (Iterate through all candidates, return first that exists)
        for (const lemma of lemmas) {
            if (checkFn(lemma)) {
                return lemma;
            }
        }
        return null;
    }
}
