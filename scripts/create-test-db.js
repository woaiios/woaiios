/**
 * 创建一个小型的测试数据库，用于开发和测试
 * 这个脚本会创建一个包含常用单词的 SQLite 数据库
 */

import initSqlJs from 'sql.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 测试词汇数据
const testWords = [
    {
        word: 'hello',
        phonetic: 'həˈləʊ',
        definition: 'used as a greeting or to begin a phone conversation',
        translation: 'int. 你好，喂\\nn. 招呼，问候\\nv. 打招呼，问好',
        pos: 'int/n/v',
        collins: 5,
        oxford: 1,
        tag: 'zk gk cet4',
        bnc: 456,
        frq: 234,
        exchange: 'p:helloed/d:helloed/i:helloing/3:helloes',
        detail: '',
        audio: ''
    },
    {
        word: 'world',
        phonetic: 'wɜːld',
        definition: 'the earth, together with all of its countries, peoples, and natural features',
        translation: 'n. 世界；地球；领域；世人；人世；天体',
        pos: 'n',
        collins: 5,
        oxford: 1,
        tag: 'zk gk cet4',
        bnc: 123,
        frq: 156,
        exchange: 's:worlds',
        detail: '',
        audio: ''
    },
    {
        word: 'computer',
        phonetic: 'kəmˈpjuːtə',
        definition: 'an electronic device for storing and processing data',
        translation: 'n. 计算机；电脑；电子计算机',
        pos: 'n',
        collins: 4,
        oxford: 1,
        tag: 'gk cet4',
        bnc: 890,
        frq: 445,
        exchange: 's:computers',
        detail: '',
        audio: ''
    },
    {
        word: 'beautiful',
        phonetic: 'ˈbjuːtɪfl',
        definition: 'pleasing the senses or mind aesthetically',
        translation: 'adj. 美丽的；美好的；出色的',
        pos: 'adj',
        collins: 4,
        oxford: 1,
        tag: 'zk gk cet4',
        bnc: 1234,
        frq: 678,
        exchange: 'r:beautifuler/t:beautifulest',
        detail: '',
        audio: ''
    },
    {
        word: 'study',
        phonetic: 'ˈstʌdi',
        definition: 'the devotion of time and attention to acquiring knowledge',
        translation: 'v. 学习；研究；审视；细看\\nn. 学习；研究；课题；书房',
        pos: 'v/n',
        collins: 5,
        oxford: 1,
        tag: 'zk gk cet4',
        bnc: 567,
        frq: 289,
        exchange: 'p:studied/d:studied/i:studying/3:studies/s:studies',
        detail: '',
        audio: ''
    },
    {
        word: 'amazing',
        phonetic: 'əˈmeɪzɪŋ',
        definition: 'causing great surprise or wonder; astonishing',
        translation: 'adj. 令人惊异的；令人惊叹的',
        pos: 'adj',
        collins: 3,
        oxford: 0,
        tag: 'cet4 cet6',
        bnc: 2345,
        frq: 1234,
        exchange: '0:amaze',
        detail: '',
        audio: ''
    },
    {
        word: 'understand',
        phonetic: 'ˌʌndəˈstænd',
        definition: 'perceive the intended meaning of (words, a language, or speaker)',
        translation: 'v. 理解；懂得；获悉；推断；省略',
        pos: 'v',
        collins: 5,
        oxford: 1,
        tag: 'zk gk cet4',
        bnc: 234,
        frq: 123,
        exchange: 'p:understood/d:understood/i:understanding/3:understands',
        detail: '',
        audio: ''
    },
    {
        word: 'excellent',
        phonetic: 'ˈeksələnt',
        definition: 'extremely good; outstanding',
        translation: 'adj. 卓越的；极好的；杰出的',
        pos: 'adj',
        collins: 4,
        oxford: 1,
        tag: 'gk cet4',
        bnc: 1567,
        frq: 789,
        exchange: '',
        detail: '',
        audio: ''
    },
    {
        word: 'important',
        phonetic: 'ɪmˈpɔːtnt',
        definition: 'of great significance or value; likely to have a profound effect',
        translation: 'adj. 重要的；权威的；有势力的；有地位的',
        pos: 'adj',
        collins: 5,
        oxford: 1,
        tag: 'zk gk cet4',
        bnc: 345,
        frq: 234,
        exchange: 'r:importanter/t:importantest',
        detail: '',
        audio: ''
    },
    {
        word: 'development',
        phonetic: 'dɪˈveləpmənt',
        definition: 'the process of developing or being developed',
        translation: 'n. 发展；开发；发育；住宅小区（专指由同一公司开发）',
        pos: 'n',
        collins: 4,
        oxford: 1,
        tag: 'gk cet4 cet6',
        bnc: 456,
        frq: 345,
        exchange: 's:developments',
        detail: '',
        audio: ''
    },
    {
        word: 'extraordinary',
        phonetic: 'ɪkˈstrɔːdnri',
        definition: 'very unusual or remarkable',
        translation: 'adj. 非凡的；特别的；离奇的；临时的；特派的',
        pos: 'adj',
        collins: 3,
        oxford: 0,
        tag: 'cet6 ielts toefl',
        bnc: 3456,
        frq: 2345,
        exchange: '',
        detail: '',
        audio: ''
    },
    {
        word: 'comprehensive',
        phonetic: 'ˌkɒmprɪˈhensɪv',
        definition: 'complete; including all or nearly all elements or aspects',
        translation: 'adj. 综合的；广泛的；有理解力的\\nn. 综合学校；专业综合测验',
        pos: 'adj/n',
        collins: 3,
        oxford: 0,
        tag: 'cet6 ielts toefl gre',
        bnc: 4567,
        frq: 3456,
        exchange: 's:comprehensives',
        detail: '',
        audio: ''
    }
];

async function createTestDatabase() {
    console.log('Creating test database...');
    
    // Initialize sql.js
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    
    // Create table with ECDICT schema
    db.run(`
        CREATE TABLE stardict (
            id INTEGER PRIMARY KEY,
            word TEXT NOT NULL,
            sw TEXT,
            phonetic TEXT,
            definition TEXT,
            translation TEXT,
            pos TEXT,
            collins INTEGER DEFAULT 0,
            oxford INTEGER DEFAULT 0,
            tag TEXT,
            bnc INTEGER DEFAULT 0,
            frq INTEGER DEFAULT 0,
            exchange TEXT,
            detail TEXT,
            audio TEXT
        );
    `);
    
    // Create indexes
    db.run('CREATE INDEX idx_word ON stardict(word);');
    db.run('CREATE INDEX idx_sw ON stardict(sw);');
    
    // Insert test words
    const stmt = db.prepare(`
        INSERT INTO stardict (word, sw, phonetic, definition, translation, pos, collins, oxford, tag, bnc, frq, exchange, detail, audio)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    testWords.forEach(w => {
        // Calculate sw (strip word - remove non-alphanumeric)
        const sw = w.word.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        stmt.run([
            w.word,
            sw,
            w.phonetic,
            w.definition,
            w.translation,
            w.pos,
            w.collins,
            w.oxford ? 1 : 0,
            w.tag,
            w.bnc,
            w.frq,
            w.exchange,
            w.detail,
            w.audio
        ]);
    });
    
    stmt.free();
    
    // Export database to file
    const data = db.export();
    const buffer = Buffer.from(data);
    const outputPath = join(__dirname, '..', 'public', 'stardict.db');
    
    writeFileSync(outputPath, buffer);
    
    console.log(`✅ Test database created successfully at: ${outputPath}`);
    console.log(`📊 Contains ${testWords.length} test words`);
    console.log('\nTest words included:');
    testWords.forEach(w => {
        console.log(`  - ${w.word} (Collins: ${w.collins}★, Oxford: ${w.oxford ? 'Yes' : 'No'})`);
    });
    
    db.close();
}

createTestDatabase().catch(err => {
    console.error('Error creating test database:', err);
    process.exit(1);
});
