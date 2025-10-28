import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function checkDatabase() {
    console.log('🔍 检查数据库结构...\n');

    try {
        // Initialize sql.js
        const SQL = await initSqlJs();
        
        // Load database from public directory
        const dbPath = join(__dirname, '../public/stardict.db');
        console.log(`📂 加载数据库: ${dbPath}\n`);
        
        const buffer = readFileSync(dbPath);
        const db = new SQL.Database(buffer);
        
        console.log(`✅ 数据库加载成功 (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)\n`);
        
        // Get all tables
        console.log('📊 数据库表列表:\n');
        const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
        
        if (tables.length > 0 && tables[0].values.length > 0) {
            tables[0].values.forEach(row => {
                console.log(`  - ${row[0]}`);
            });
            console.log('');
            
            // For each table, show structure
            for (const row of tables[0].values) {
                const tableName = row[0];
                console.log(`\n📋 表 "${tableName}" 的结构:\n`);
                
                const structure = db.exec(`PRAGMA table_info(${tableName})`);
                if (structure.length > 0) {
                    console.log('  列名             类型        Not Null  默认值  主键');
                    console.log('  ' + '-'.repeat(60));
                    structure[0].values.forEach(col => {
                        const name = col[1].padEnd(15);
                        const type = col[2].padEnd(10);
                        const notNull = col[3] ? 'YES' : 'NO';
                        const defaultVal = col[4] || 'NULL';
                        const pk = col[5] ? 'YES' : 'NO';
                        console.log(`  ${name} ${type}  ${notNull.padEnd(8)} ${String(defaultVal).padEnd(8)} ${pk}`);
                    });
                }
                
                // Get row count
                const count = db.exec(`SELECT COUNT(*) FROM ${tableName}`);
                if (count.length > 0) {
                    console.log(`\n  📊 总记录数: ${count[0].values[0][0].toLocaleString()}`);
                }
                
                // Sample first row
                console.log(`\n  📄 示例数据 (第一行):\n`);
                const sample = db.exec(`SELECT * FROM ${tableName} LIMIT 1`);
                if (sample.length > 0 && sample[0].values.length > 0) {
                    const columns = sample[0].columns;
                    const values = sample[0].values[0];
                    columns.forEach((col, idx) => {
                        let value = values[idx];
                        if (typeof value === 'string' && value.length > 60) {
                            value = value.substring(0, 60) + '...';
                        }
                        console.log(`    ${col}: ${value}`);
                    });
                }
            }
        } else {
            console.log('  ❌ 数据库中没有表！');
        }
        
        db.close();
        
    } catch (error) {
        console.error('❌ 错误:', error);
        console.error(error.stack);
    }
}

checkDatabase();
