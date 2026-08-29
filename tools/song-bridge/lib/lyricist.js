'use strict';

/**
 * 作词器
 * -----------------------------------------------------------------------------
 * 用 FreeToken 上的 Qwen3.8-27B，按 WorkBuddy「music-caption-rewriter」技能的方法，
 * 产出 MiniMax Music 3 需要的两段输入：
 *   - caption：Global Metadata / Vocal Details / Arrangement 三段式结构化描述
 *   - lyrics ：带 [section] 标签的歌词
 * 另外附带一段中文词义注释，供前端展示（不参与演唱）。
 */

const SYSTEM_PROMPT = `You are a songwriter for MiniMax Music 3, writing English study songs that make target vocabulary impossible to forget.

You will receive: a list of English target words, an optional sentence for context, a style hint, and a target duration in seconds.

## Output format (STRICT — no prose outside these blocks)

<caption>
Global Metadata: <genre and subgenres, tempo range or BPM, key only if it helps, emotional arc, sonic and production character>
Vocal Details: <lead vocal configuration, timbre, register, delivery, backing vocals, restrained vocal effects>
Arrangement: <section-by-section timeline: what enters, exits, changes, intensifies; instrument lifecycles; transitions; spatial effects>
</caption>
<lyrics>
[Intro]
...
[Verse]
...
[Chorus]
...
[Outro]
...
</lyrics>
<notes>
<word> — <concise Chinese gloss, with part of speech when useful>
</notes>

## Caption rules
- English only. Three labelled lines inside <caption>, exactly as shown.
- 150-300 words total. Concrete musical changes beat decorative adjectives.
- Do NOT invent an exact BPM or key unless the style hint makes it obvious; a range or qualitative tempo is fine.
- Keep the arrangement matching the lyrics' section order.
- No song title, no track id, no reasoning trace, no quoted reference text.

## Lyrics rules
- English only. This is what the model will sing.
- Use section tags on their own lines: [Intro] [Verse] [Pre-Chorus] [Chorus] [Bridge] [Instrumental] [Outro]. Use only the sections the song needs.
- Every target word must appear at least twice. Put the full target-word list in the [Chorus] so it repeats.
- Lines are short and singable (roughly 6-10 syllables). Rhyme or near-rhyme within each section.
- Vocabulary outside the target words stays simple (A2-B1), because a learner is listening.
- Length: about one sung line per 2 seconds of duration. For a 60 s song write roughly 22-30 lines including tags.
- No stage directions, no parentheses full of instructions, no explanations.

## Notes rules
- One line per target word, Chinese, concise. This is for the learner's screen, never sung.

## Reference
When a reference caption is supplied, absorb only its musical vocabulary level, structural logic and level of detail. Do not copy its sentences, its key, its BPM, its story, or its instrumentation wholesale. Synthesize something new for these words.`;

function buildUserPrompt({ words, sentence, style, durationSec, reference, route }) {
  const wordList = (words || []).map((w) => w.trim()).filter(Boolean);
  const lines = Math.max(8, Math.round((durationSec || 60) / 2));

  const parts = [];
  parts.push(`Target words (must all appear, at least twice each, all of them in the [Chorus]):\n${wordList.map((w) => `- ${w}`).join('\n')}`);
  if (sentence && sentence.trim()) {
    parts.push(`Context sentence (for meaning, never quote it verbatim):\n"""${sentence.trim()}"""`);
  }
  parts.push(`Style hint: ${style || 'acoustic folk pop'}`);
  if (route) parts.push(`Style family: ${route}`);
  parts.push(`Target duration: ${durationSec} seconds → write about ${lines} sung lines.`);
  if (reference) {
    parts.push(
      `Reference caption (absorb only its vocabulary level, structure and detail; do not copy it):\n"""\n${reference}\n"""`
    );
  }
  parts.push('Now write the song. Output only the three blocks described in the system prompt.');
  return parts.join('\n\n');
}

/**
 * 流式生成并实时分流：caption / lyrics / notes
 * @returns {Promise<{raw: string, caption: string, lyrics: string, notes: string, reasoning: string}>}
 */
async function writeSong({ freetoken, words, sentence, style, durationSec, reference, route, onDelta }) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt({ words, sentence, style, durationSec, reference, route }) }
  ];

  let raw = '';
  let section = null; // 'caption' | 'lyrics' | 'notes' | null（尚未进入任何块）

  const res = await freetoken.chat({
    messages,
    maxTokens: 4096,
    onDelta: ({ type, text }) => {
      if (type === 'reasoning') {
        onDelta?.({ type: 'reasoning', text });
        return;
      }
      raw += text;

      // 依据累计文本判断当前处于哪个块
      const lastOpen = lastIndexOfAny(raw, ['<caption>', '<lyrics>', '<notes>']);
      const lastClose = lastIndexOfAny(raw, ['</caption>', '</lyrics>', '</notes>']);
      if (lastOpen.idx > lastClose.idx) {
        section = lastOpen.tag.replace(/[<>]/g, '');
      } else if (lastClose.idx >= 0) {
        section = null;
      }

      // 只把块内部内容推给前端：跳过刚吐出的开始标签本身
      if (section && !isPartOfOpeningTag(raw, lastOpen)) {
        onDelta?.({ type: section, text });
      }
    }
  });

  const parsed = parseSong(res.content || raw);
  return { ...parsed, raw: res.content || raw, reasoning: res.reasoning };
}

function lastIndexOfAny(text, tags) {
  let best = { idx: -1, tag: null };
  for (const tag of tags) {
    const i = text.lastIndexOf(tag);
    if (i > best.idx) best = { idx: i, tag };
  }
  return best;
}

/** 刚收到的 token 是不是某个开始标签的一部分（是就不推送给前端） */
function isPartOfOpeningTag(raw, lastOpen) {
  if (!lastOpen.tag) return false;
  const tail = raw.slice(lastOpen.idx);
  return lastOpen.tag.startsWith(tail) && tail.length < lastOpen.tag.length;
}

/** 兜底解析（流式分流失败时也能拿到完整结果） */
function parseSong(raw) {
  const grab = (tag) => {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
    const m = String(raw || '').match(re);
    return m ? m[1].trim() : '';
  };
  return {
    caption: grab('caption'),
    lyrics: grab('lyrics'),
    notes: grab('notes')
  };
}

const SECTION_TAG = /^\[(Intro|Verse|Pre-Chorus|Chorus|Bridge|Instrumental|Outro|Refrain|Hook|Solo)\]$/i;

/** 歌词清洗：去掉说明文字，并删除后面没有内容的段落标签（[Instrumental] 除外） */
function sanitizeLyrics(lyrics) {
  let text = String(lyrics || '').trim();
  text = text.replace(/```[a-z]*\n?/gi, '');
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !/^(here(?:'s| is)|sure|certainly|note:)/i.test(l));

  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = SECTION_TAG.exec(line);
    if (!m) {
      out.push(line);
      continue;
    }
    // 找到下一个非空行，判断这一段有没有实际歌词
    let hasContent = false;
    for (let j = i + 1; j < lines.length; j++) {
      if (SECTION_TAG.test(lines[j])) break;
      hasContent = true;
      break;
    }
    const isInstrumental = /^\[Instrumental\]$/i.test(line);
    if (hasContent || isInstrumental) out.push(line);
  }
  return out.join('\n');
}

function sanitizeCaption(caption) {
  let text = String(caption || '').trim();
  text = text.replace(/```[a-z]*\n?/gi, '');
  // 确保三段式标签存在，缺失时补一个兜底标题
  if (!/Global Metadata\s*:/i.test(text)) text = `Global Metadata: ${text}`;
  if (!/Vocal Details\s*:/i.test(text)) {
    text += '\nVocal Details: A single warm lead vocalist sings clearly and close to the microphone, with light reverb and no heavy processing.';
  }
  if (!/Arrangement\s*:/i.test(text)) {
    text += '\nArrangement: Intro establishes the groove, verses stay sparse, choruses add the fullest texture, outro fades back down.';
  }
  return text;
}

module.exports = { writeSong, parseSong, sanitizeLyrics, sanitizeCaption, SYSTEM_PROMPT };
