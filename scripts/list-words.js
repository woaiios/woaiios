import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';

const SQL = await initSqlJs();
const db = new SQL.Database(readFileSync('public/stardict.db'));
const result = db.exec('SELECT word, translation, collins, oxford, tag FROM stardict ORDER BY word');

console.log('测试数据库中的所有单词:\n');
result[0].values.forEach(row => {
    const trans = row[1] ? row[1].substring(0, 40) : '无';
    console.log(`  ${row[0].padEnd(15)} - ${trans}... (${row[2]}★, Oxford:${row[3]}, ${row[4] || '无标签'})`);
});
