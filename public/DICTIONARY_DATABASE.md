# Dictionary Database Setup

## Required File

The application requires a dictionary database file at:

```
public/ecdict-top10k.db.gz
```

## Database Specifications

- **Format**: SQLite database, gzip compressed
- **Size**: ~2MB compressed
- **Content**: Top 10,000 BNC (British National Corpus) high-frequency words
- **Fields**: word, phonetic, definition, translation, collins, bnc, frq, exchange

## Data Source

The database should contain the top 10,000 words from ECDICT sorted by BNC frequency, including:

- **word**: The English word
- **phonetic**: IPA pronunciation (e.g., `/ˈsiːkɪŋ/`)
- **definition**: English definition
- **translation**: Chinese translation
- **collins**: Collins star rating (1-5)
- **bnc**: BNC frequency rank
- **frq**: Word frequency count
- **exchange**: Word forms (e.g., `"p:ran/d:run/i:running/0:run"`)

## Creating the Database

To create this database from ECDICT source:

1. Download ECDICT SQLite database
2. Query top 10,000 words by BNC frequency:
   ```sql
   SELECT word, phonetic, definition, translation, collins, bnc, frq, exchange
   FROM stardict
   WHERE bnc > 0
   ORDER BY bnc ASC
   LIMIT 10000
   ```
3. Export to new SQLite database
4. Compress with gzip: `gzip ecdict-top10k.db`
5. Place in `public/ecdict-top10k.db.gz`

## Usage

On first load, the application will:
1. Download `ecdict-top10k.db.gz` (~2MB)
2. Decompress and parse the SQLite database
3. Import all 10,000 words into IndexedDB
4. Use IndexedDB for all subsequent queries (offline capable)

## Fallback Behavior

If the database file is not available, the application uses a fallback method based on word length and common word lists for difficulty scoring. However, this provides less accurate results and no phonetic/translation data.
