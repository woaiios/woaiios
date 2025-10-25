// Word Discoverer - Main JavaScript File
class WordDiscoverer {
    constructor() {
        this.vocabulary = this.loadVocabulary();
        this.settings = this.loadSettings();
        this.wordDatabase = this.initializeWordDatabase();
        this.currentHighlightedWords = new Set();
        
        this.initializeEventListeners();
        this.updateUI();
    }

    // Initialize word database with difficulty levels
    initializeWordDatabase() {
        return {
            // Common words (not highlighted)
            common: new Set([
                'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
                'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
                'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him',
                'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only',
                'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want',
                'because', 'any', 'these', 'give', 'day', 'most', 'us', 'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'each', 'which', 'their',
                'time', 'will', 'about', 'if', 'up', 'out', 'many', 'then', 'them', 'can', 'only', 'other', 'new', 'some', 'these', 'may', 'say', 'each',
                'which', 'do', 'how', 'its', 'now', 'find', 'long', 'down', 'day', 'did', 'get', 'come', 'made', 'may', 'part'
            ]),
            
            // Beginner level words
            beginner: new Set([
                'hello', 'goodbye', 'please', 'thank', 'sorry', 'yes', 'no', 'help', 'water', 'food', 'house', 'car', 'book', 'school', 'friend',
                'family', 'mother', 'father', 'sister', 'brother', 'child', 'man', 'woman', 'boy', 'girl', 'cat', 'dog', 'bird', 'tree', 'flower',
                'sun', 'moon', 'star', 'sky', 'earth', 'fire', 'water', 'air', 'big', 'small', 'good', 'bad', 'happy', 'sad', 'hot', 'cold',
                'fast', 'slow', 'old', 'new', 'young', 'beautiful', 'ugly', 'easy', 'hard', 'open', 'close', 'start', 'stop', 'go', 'come',
                'give', 'take', 'buy', 'sell', 'eat', 'drink', 'sleep', 'wake', 'work', 'play', 'learn', 'teach', 'read', 'write', 'speak',
                'listen', 'see', 'hear', 'smell', 'taste', 'touch', 'walk', 'run', 'jump', 'sit', 'stand', 'lie', 'fly', 'swim', 'drive'
            ]),
            
            // Intermediate level words
            intermediate: new Set([
                'achieve', 'adventure', 'ancient', 'appreciate', 'approach', 'arrange', 'assist', 'attitude', 'available', 'aware', 'balance',
                'behavior', 'benefit', 'beyond', 'career', 'challenge', 'character', 'circumstance', 'comfortable', 'community', 'compare',
                'complete', 'concern', 'consider', 'continue', 'contribute', 'conversation', 'create', 'culture', 'decision', 'describe',
                'develop', 'different', 'difficult', 'direction', 'discover', 'discuss', 'education', 'effective', 'effort', 'emotion',
                'encourage', 'energy', 'environment', 'especially', 'establish', 'event', 'evidence', 'examine', 'example', 'experience',
                'explain', 'express', 'extend', 'familiar', 'famous', 'feature', 'figure', 'finally', 'focus', 'foreign', 'form', 'function',
                'general', 'generation', 'government', 'grow', 'happen', 'health', 'history', 'human', 'idea', 'identify', 'imagine',
                'important', 'include', 'increase', 'individual', 'industry', 'influence', 'information', 'interest', 'introduce', 'involve',
                'issue', 'knowledge', 'language', 'large', 'learn', 'level', 'likely', 'local', 'manage', 'material', 'matter', 'measure',
                'medical', 'meet', 'method', 'modern', 'moment', 'move', 'natural', 'necessary', 'network', 'normal', 'notice', 'number',
                'obtain', 'occur', 'offer', 'opinion', 'opportunity', 'order', 'organization', 'original', 'particular', 'pattern', 'peace',
                'people', 'percent', 'period', 'person', 'personal', 'physical', 'place', 'plan', 'point', 'policy', 'position', 'possible',
                'power', 'practice', 'prepare', 'present', 'pressure', 'prevent', 'previous', 'price', 'private', 'problem', 'process',
                'produce', 'product', 'program', 'project', 'provide', 'public', 'purpose', 'quality', 'question', 'quick', 'quite', 'rather',
                'reach', 'real', 'reason', 'receive', 'recognize', 'record', 'reduce', 'reflect', 'region', 'relate', 'relationship', 'remain',
                'remember', 'remove', 'report', 'represent', 'require', 'research', 'resource', 'respond', 'result', 'return', 'reveal',
                'right', 'role', 'rule', 'same', 'science', 'section', 'secure', 'see', 'seem', 'sense', 'series', 'serious', 'serve',
                'service', 'several', 'share', 'should', 'show', 'side', 'significant', 'similar', 'simple', 'since', 'situation', 'skill',
                'small', 'social', 'society', 'some', 'someone', 'something', 'sometimes', 'source', 'space', 'special', 'specific', 'staff',
                'stage', 'stand', 'start', 'state', 'statement', 'still', 'story', 'strategy', 'street', 'strong', 'structure', 'student',
                'study', 'stuff', 'style', 'subject', 'success', 'such', 'sudden', 'suggest', 'support', 'sure', 'surface', 'system',
                'table', 'take', 'talk', 'team', 'technology', 'tell', 'term', 'test', 'than', 'thank', 'that', 'the', 'their', 'them',
                'themselves', 'then', 'there', 'these', 'they', 'thing', 'think', 'this', 'those', 'though', 'thought', 'through', 'time',
                'today', 'together', 'too', 'top', 'total', 'toward', 'town', 'trade', 'traditional', 'train', 'travel', 'treat', 'tree',
                'trial', 'trip', 'trouble', 'true', 'trust', 'truth', 'try', 'turn', 'type', 'under', 'understand', 'unit', 'until', 'up',
                'upon', 'use', 'used', 'user', 'using', 'usually', 'value', 'various', 'very', 'video', 'view', 'village', 'visit', 'voice',
                'wait', 'walk', 'wall', 'want', 'war', 'warm', 'warn', 'wash', 'watch', 'water', 'wave', 'way', 'we', 'weak', 'wealth',
                'weapon', 'wear', 'weather', 'week', 'weight', 'welcome', 'well', 'west', 'what', 'whatever', 'when', 'where', 'whether',
                'which', 'while', 'white', 'who', 'whole', 'whom', 'whose', 'why', 'wide', 'wife', 'wild', 'will', 'win', 'wind', 'window',
                'wine', 'wing', 'winner', 'winter', 'wise', 'wish', 'with', 'within', 'without', 'woman', 'wonder', 'wonderful', 'wood',
                'word', 'work', 'worker', 'world', 'worry', 'worse', 'worst', 'worth', 'would', 'write', 'writer', 'writing', 'written',
                'wrong', 'yard', 'year', 'yellow', 'yes', 'yesterday', 'yet', 'you', 'young', 'your', 'yours', 'yourself', 'youth'
            ]),
            
            // Advanced level words
            advanced: new Set([
                'abundant', 'accomplish', 'accumulate', 'acknowledge', 'acquire', 'adequate', 'adjacent', 'administer', 'advocate', 'affluent',
                'aggregate', 'allegation', 'allocate', 'alternative', 'ambiguous', 'ambitious', 'analogous', 'analyze', 'anecdote', 'anticipate',
                'apparent', 'appreciate', 'appropriate', 'approximate', 'arbitrary', 'articulate', 'ascertain', 'assess', 'associate', 'assume',
                'attribute', 'authentic', 'authorize', 'autonomous', 'available', 'beneficial', 'bias', 'capacity', 'category', 'challenge',
                'characteristic', 'circumstance', 'clarify', 'coherent', 'coincide', 'collaborate', 'commence', 'commentary', 'commitment',
                'comparable', 'compel', 'compensate', 'complement', 'comprehensive', 'comprise', 'conceive', 'concept', 'conclude', 'concurrent',
                'conduct', 'confine', 'confirm', 'conflict', 'conform', 'consequence', 'considerable', 'consist', 'constitute', 'constrain',
                'construct', 'consult', 'consume', 'contemporary', 'context', 'contribute', 'controversy', 'convene', 'conventional', 'convey',
                'convince', 'coordinate', 'correspond', 'criteria', 'crucial', 'cultivate', 'cumulative', 'curriculum', 'data', 'debate',
                'decisive', 'decline', 'deduce', 'define', 'demonstrate', 'denote', 'depict', 'derive', 'designate', 'despite', 'detect',
                'determine', 'devise', 'differentiate', 'dimension', 'diminish', 'discern', 'discrete', 'discriminate', 'dispose', 'distinct',
                'distinguish', 'distribute', 'diverse', 'document', 'domain', 'dominate', 'dramatic', 'duration', 'dynamic', 'economy',
                'effective', 'efficient', 'elaborate', 'element', 'eliminate', 'emerge', 'emphasis', 'empirical', 'enable', 'encounter',
                'endeavor', 'endorse', 'enhance', 'enormous', 'ensure', 'entity', 'environment', 'episode', 'equate', 'equivalent', 'error',
                'establish', 'estimate', 'evaluate', 'eventual', 'evidence', 'evolve', 'exceed', 'exclude', 'execute', 'exemplify', 'exhibit',
                'expand', 'expertise', 'explicit', 'exploit', 'explore', 'expose', 'extend', 'external', 'extract', 'facilitate', 'factor',
                'feature', 'federal', 'final', 'finance', 'finite', 'flexible', 'fluctuate', 'focus', 'format', 'formula', 'formulate',
                'foundation', 'framework', 'frequency', 'function', 'fundamental', 'generate', 'global', 'goal', 'grade', 'grant', 'guarantee',
                'guideline', 'hence', 'hierarchy', 'highlight', 'hypothesis', 'identical', 'identify', 'ideology', 'ignore', 'illustrate',
                'immediate', 'immense', 'implement', 'implicate', 'implicit', 'imply', 'impose', 'incentive', 'incident', 'include', 'income',
                'incorporate', 'increase', 'incredible', 'indicate', 'individual', 'induce', 'inevitable', 'infer', 'influence', 'inform',
                'infrastructure', 'inherent', 'initial', 'initiate', 'innovation', 'input', 'inquiry', 'insight', 'inspect', 'instance',
                'institute', 'instruct', 'integrate', 'intellectual', 'intelligence', 'intend', 'intense', 'interact', 'interest', 'interface',
                'internal', 'interpret', 'intervene', 'intrinsic', 'invest', 'investigate', 'involve', 'isolate', 'issue', 'item', 'job', 'join',
                'joint', 'journal', 'judge', 'justify', 'key', 'kind', 'knowledge', 'label', 'labor', 'lack', 'land', 'language', 'large',
                'last', 'late', 'later', 'latter', 'law', 'lay', 'lead', 'learn', 'least', 'leave', 'left', 'legal', 'legislate', 'less',
                'let', 'level', 'liability', 'liberal', 'license', 'lie', 'life', 'light', 'like', 'likely', 'limit', 'line', 'link',
                'list', 'listen', 'literature', 'little', 'live', 'loan', 'local', 'locate', 'lock', 'logic', 'long', 'look', 'lose', 'loss',
                'lot', 'love', 'low', 'lower', 'machine', 'magazine', 'main', 'maintain', 'major', 'make', 'male', 'manage', 'management',
                'manager', 'manner', 'manual', 'manufacture', 'many', 'map', 'margin', 'mark', 'market', 'marriage', 'mass', 'master',
                'match', 'material', 'matter', 'may', 'maybe', 'mean', 'measure', 'media', 'medical', 'meet', 'meeting', 'member', 'memory',
                'mental', 'mention', 'merely', 'merge', 'message', 'method', 'middle', 'might', 'military', 'mind', 'mine', 'minimum',
                'minor', 'minute', 'miss', 'mission', 'mistake', 'mix', 'model', 'moderate', 'modern', 'modify', 'moment', 'money', 'monitor',
                'month', 'mood', 'moral', 'more', 'moreover', 'morning', 'most', 'mother', 'motion', 'motivate', 'motor', 'mount', 'move',
                'movement', 'movie', 'much', 'multiple', 'murder', 'muscle', 'museum', 'music', 'must', 'mutual', 'my', 'myself', 'mystery',
                'myth', 'nail', 'name', 'narrow', 'nation', 'national', 'native', 'natural', 'nature', 'near', 'nearly', 'necessary', 'neck',
                'need', 'negative', 'negotiate', 'neighbor', 'neither', 'nerve', 'nervous', 'net', 'network', 'neutral', 'never', 'nevertheless',
                'new', 'news', 'newspaper', 'next', 'nice', 'night', 'nine', 'no', 'nobody', 'nod', 'noise', 'nominate', 'none', 'noon',
                'nor', 'normal', 'north', 'nose', 'not', 'note', 'nothing', 'notice', 'notion', 'novel', 'now', 'nowhere', 'nuclear', 'number',
                'numerous', 'nurse', 'nut', 'obey', 'object', 'objective', 'obligation', 'observe', 'obtain', 'obvious', 'occasion', 'occur',
                'ocean', 'odd', 'of', 'off', 'offend', 'offer', 'office', 'officer', 'official', 'often', 'oil', 'okay', 'old', 'on', 'once',
                'one', 'only', 'onto', 'open', 'operate', 'operation', 'opinion', 'opponent', 'opportunity', 'oppose', 'opposite', 'option',
                'or', 'orange', 'order', 'ordinary', 'organ', 'organic', 'organization', 'organize', 'origin', 'original', 'other', 'otherwise',
                'ought', 'our', 'ourselves', 'out', 'outcome', 'outline', 'outlook', 'output', 'outside', 'outstanding', 'over', 'overall',
                'overcome', 'overlap', 'overnight', 'overseas', 'owe', 'own', 'owner', 'pace', 'pack', 'package', 'page', 'pain', 'paint',
                'pair', 'palace', 'pale', 'palm', 'pan', 'panel', 'panic', 'paper', 'parent', 'park', 'part', 'participate', 'particular',
                'particularly', 'partly', 'partner', 'party', 'pass', 'passage', 'passenger', 'passion', 'past', 'path', 'patient', 'pattern',
                'pause', 'pay', 'payment', 'peace', 'peak', 'peer', 'pen', 'penalty', 'people', 'pepper', 'per', 'perceive', 'percent',
                'perfect', 'perform', 'performance', 'perhaps', 'period', 'permanent', 'permission', 'permit', 'person', 'personal',
                'personality', 'personnel', 'perspective', 'persuade', 'pet', 'phase', 'phenomenon', 'philosophy', 'phone', 'photo',
                'photograph', 'phrase', 'physical', 'piano', 'pick', 'picture', 'piece', 'pig', 'pile', 'pill', 'pilot', 'pin', 'pink',
                'pioneer', 'pipe', 'pitch', 'place', 'plain', 'plan', 'plane', 'planet', 'plant', 'plastic', 'plate', 'platform', 'play',
                'player', 'please', 'pleasure', 'plenty', 'plot', 'plus', 'pocket', 'poem', 'poet', 'poetry', 'point', 'pole', 'police',
                'policy', 'polish', 'polite', 'political', 'politician', 'politics', 'poll', 'pollution', 'pool', 'poor', 'pop', 'popular',
                'population', 'port', 'portion', 'portrait', 'portray', 'pose', 'position', 'positive', 'possess', 'possession', 'possibility',
                'possible', 'possibly', 'post', 'pot', 'potato', 'potential', 'pound', 'pour', 'poverty', 'power', 'powerful', 'practical',
                'practice', 'praise', 'pray', 'prayer', 'precise', 'predict', 'prefer', 'preference', 'pregnancy', 'pregnant', 'preliminary',
                'premise', 'preparation', 'prepare', 'prescription', 'presence', 'present', 'presentation', 'preserve', 'president', 'press',
                'pressure', 'pretend', 'pretty', 'prevent', 'previous', 'price', 'pride', 'priest', 'primary', 'prime', 'primitive', 'prince',
                'princess', 'principal', 'principle', 'print', 'prior', 'priority', 'prison', 'prisoner', 'privacy', 'private', 'privilege',
                'prize', 'probably', 'problem', 'procedure', 'proceed', 'process', 'produce', 'product', 'production', 'profession',
                'professional', 'professor', 'profile', 'profit', 'program', 'progress', 'project', 'promise', 'promote', 'prompt', 'proof',
                'proper', 'property', 'proportion', 'proposal', 'propose', 'prospect', 'protect', 'protection', 'protein', 'protest', 'proud',
                'prove', 'provide', 'province', 'provision', 'psychological', 'psychology', 'public', 'publication', 'publish', 'pull',
                'pump', 'punch', 'punish', 'punishment', 'purchase', 'pure', 'purpose', 'pursue', 'push', 'put', 'qualify', 'quality',
                'quantity', 'quarter', 'queen', 'question', 'quick', 'quiet', 'quit', 'quite', 'quote', 'race', 'racial', 'radical', 'radio',
                'rail', 'rain', 'raise', 'range', 'rank', 'rapid', 'rare', 'rate', 'rather', 'rating', 'ratio', 'raw', 'reach', 'react',
                'reaction', 'read', 'reader', 'reading', 'ready', 'real', 'reality', 'realize', 'really', 'reason', 'reasonable', 'recall',
                'receive', 'recent', 'recently', 'reception', 'recipe', 'recognition', 'recognize', 'recommend', 'record', 'recover',
                'recovery', 'recruit', 'red', 'reduce', 'reduction', 'refer', 'reference', 'reflect', 'reflection', 'reform', 'refugee',
                'refuse', 'regard', 'regarding', 'regardless', 'region', 'regional', 'register', 'regular', 'regulate', 'regulation',
                'reject', 'relate', 'relation', 'relationship', 'relative', 'relatively', 'relax', 'release', 'relevant', 'reliable',
                'relief', 'relieve', 'religion', 'religious', 'reluctant', 'rely', 'remain', 'remark', 'remarkable', 'remember', 'remind',
                'remote', 'remove', 'rent', 'repair', 'repeat', 'replace', 'reply', 'report', 'reporter', 'represent', 'representation',
                'representative', 'reputation', 'request', 'require', 'requirement', 'rescue', 'research', 'researcher', 'resemble',
                'reservation', 'reserve', 'resident', 'resign', 'resist', 'resistance', 'resolution', 'resolve', 'resort', 'resource',
                'respect', 'respond', 'response', 'responsibility', 'responsible', 'rest', 'restaurant', 'restore', 'restrict', 'result',
                'retain', 'retire', 'retirement', 'return', 'reveal', 'revenue', 'review', 'revolution', 'reward', 'rhythm', 'rice',
                'rich', 'rid', 'ride', 'rider', 'ridge', 'ridiculous', 'rifle', 'right', 'ring', 'rise', 'risk', 'ritual', 'rival',
                'river', 'road', 'rob', 'robot', 'rock', 'rocket', 'role', 'roll', 'romantic', 'roof', 'room', 'root', 'rope', 'rose',
                'rough', 'round', 'route', 'routine', 'row', 'royal', 'rub', 'rubber', 'rubbish', 'rude', 'rug', 'ruin', 'rule', 'ruler',
                'rumor', 'run', 'runner', 'rural', 'rush', 'rust', 'sack', 'sacred', 'sad', 'safe', 'safety', 'sail', 'sake', 'salad',
                'salary', 'sale', 'sales', 'salt', 'same', 'sample', 'sand', 'sandwich', 'satellite', 'satisfaction', 'satisfy', 'sauce',
                'save', 'saving', 'say', 'scale', 'scan', 'scandal', 'scare', 'scatter', 'scene', 'schedule', 'scheme', 'scholar',
                'scholarship', 'school', 'science', 'scientific', 'scientist', 'scope', 'score', 'scream', 'screen', 'script', 'sea',
                'search', 'season', 'seat', 'second', 'secondary', 'secret', 'secretary', 'section', 'sector', 'secure', 'security',
                'see', 'seed', 'seek', 'seem', 'segment', 'seize', 'select', 'selection', 'self', 'sell', 'senate', 'senator', 'send',
                'senior', 'sense', 'sensitive', 'sentence', 'separate', 'sequence', 'series', 'serious', 'serve', 'service', 'session',
                'set', 'setting', 'settle', 'settlement', 'seven', 'several', 'severe', 'sex', 'sexual', 'shade', 'shadow', 'shake',
                'shall', 'shallow', 'shame', 'shape', 'share', 'sharp', 'she', 'sheet', 'shelf', 'shell', 'shelter', 'shift', 'shine',
                'ship', 'shirt', 'shock', 'shoe', 'shoot', 'shop', 'shopping', 'shore', 'short', 'shot', 'should', 'shoulder', 'shout',
                'show', 'shut', 'sick', 'side', 'sight', 'sign', 'signal', 'significance', 'significant', 'significantly', 'silence',
                'silent', 'silk', 'silly', 'silver', 'similar', 'similarly', 'simple', 'simply', 'sin', 'since', 'sing', 'singer',
                'single', 'sink', 'sir', 'sister', 'sit', 'site', 'situation', 'six', 'size', 'skill', 'skin', 'sky', 'slave', 'sleep',
                'slice', 'slide', 'slight', 'slightly', 'slip', 'slope', 'slow', 'slowly', 'small', 'smart', 'smell', 'smile', 'smoke',
                'smooth', 'snake', 'snow', 'so', 'soap', 'soccer', 'social', 'society', 'sock', 'soft', 'software', 'soil', 'solar',
                'soldier', 'sole', 'solid', 'solution', 'solve', 'some', 'somebody', 'somehow', 'someone', 'something', 'sometimes',
                'somewhat', 'somewhere', 'son', 'song', 'soon', 'sophisticated', 'sore', 'sorry', 'sort', 'soul', 'sound', 'soup',
                'source', 'south', 'southern', 'space', 'spare', 'speak', 'speaker', 'special', 'specialist', 'specialize', 'species',
                'specific', 'specifically', 'specify', 'spectrum', 'speech', 'speed', 'spell', 'spend', 'sphere', 'spirit', 'spiritual',
                'spite', 'split', 'spoil', 'spoke', 'spokesman', 'sponsor', 'spoon', 'sport', 'spot', 'spread', 'spring', 'square',
                'squeeze', 'stable', 'staff', 'stage', 'stain', 'stair', 'stake', 'stand', 'standard', 'standing', 'star', 'stare',
                'start', 'state', 'statement', 'station', 'statistics', 'status', 'stay', 'steady', 'steal', 'steam', 'steel', 'steep',
                'steer', 'stem', 'step', 'stick', 'stiff', 'still', 'stir', 'stock', 'stomach', 'stone', 'stop', 'storage', 'store',
                'storm', 'story', 'stove', 'straight', 'strain', 'strange', 'stranger', 'strategic', 'strategy', 'stream', 'street',
                'strength', 'strengthen', 'stress', 'stretch', 'strict', 'strike', 'string', 'strip', 'stroke', 'strong', 'strongly',
                'structure', 'struggle', 'student', 'studio', 'study', 'stuff', 'stupid', 'style', 'subject', 'submit', 'subsequent',
                'substance', 'substantial', 'substitute', 'subtle', 'succeed', 'success', 'successful', 'successfully', 'such', 'sudden',
                'suddenly', 'sue', 'suffer', 'sufficient', 'sugar', 'suggest', 'suggestion', 'suit', 'suitable', 'sum', 'summary',
                'summer', 'summit', 'sun', 'super', 'superior', 'supermarket', 'supper', 'supply', 'support', 'supporter', 'suppose',
                'sure', 'surely', 'surface', 'surgery', 'surprise', 'surprised', 'surprising', 'surprisingly', 'surround', 'survey',
                'survival', 'survive', 'survivor', 'suspect', 'suspend', 'sustain', 'swallow', 'swear', 'sweat', 'sweep', 'sweet',
                'swim', 'swing', 'switch', 'symbol', 'sympathy', 'symptom', 'system', 'table', 'tackle', 'tail', 'take', 'tale', 'talent',
                'talk', 'tall', 'tank', 'tap', 'tape', 'target', 'task', 'taste', 'tax', 'taxi', 'tea', 'teach', 'teacher', 'team',
                'tear', 'teaspoon', 'technical', 'technique', 'technology', 'teen', 'teenager', 'telephone', 'television', 'tell',
                'temperature', 'temple', 'temporary', 'ten', 'tend', 'tendency', 'tennis', 'tension', 'tent', 'term', 'terminal',
                'terrible', 'territory', 'terror', 'terrorism', 'terrorist', 'test', 'text', 'than', 'thank', 'thanks', 'that', 'the',
                'theater', 'their', 'them', 'theme', 'themselves', 'then', 'theory', 'therapy', 'there', 'therefore', 'these', 'they',
                'thick', 'thin', 'thing', 'think', 'thinking', 'third', 'thirty', 'this', 'those', 'though', 'thought', 'thousand',
                'threat', 'threaten', 'three', 'throat', 'through', 'throughout', 'throw', 'thumb', 'thus', 'ticket', 'tie', 'tight',
                'till', 'time', 'tiny', 'tip', 'tire', 'tired', 'tissue', 'title', 'to', 'tobacco', 'today', 'toe', 'together', 'toilet',
                'tomato', 'tomorrow', 'tone', 'tongue', 'tonight', 'too', 'tool', 'tooth', 'top', 'topic', 'total', 'touch', 'tough',
                'tour', 'tourist', 'tournament', 'toward', 'towards', 'tower', 'town', 'toy', 'track', 'trade', 'tradition', 'traditional',
                'traffic', 'tragedy', 'trail', 'train', 'training', 'transfer', 'transform', 'transition', 'translate', 'transport',
                'transportation', 'trap', 'trash', 'travel', 'treat', 'treatment', 'tree', 'tremendous', 'trend', 'trial', 'tribe',
                'trick', 'trip', 'troop', 'trouble', 'truck', 'true', 'truly', 'trust', 'truth', 'try', 'tube', 'tune', 'tunnel',
                'turn', 'twelve', 'twenty', 'twice', 'twin', 'two', 'type', 'typical', 'typically', 'ugly', 'ultimate', 'ultimately',
                'unable', 'uncle', 'under', 'undergo', 'understand', 'understanding', 'undertake', 'unemployment', 'unexpected',
                'unfortunately', 'uniform', 'union', 'unique', 'unit', 'unite', 'united', 'universal', 'universe', 'university', 'unknown',
                'unless', 'unlike', 'unlikely', 'until', 'unusual', 'up', 'upon', 'upper', 'upset', 'urban', 'urge', 'urgent', 'us',
                'use', 'used', 'useful', 'user', 'usual', 'usually', 'utility', 'utilize', 'vacation', 'vacuum', 'valley', 'valuable',
                'value', 'van', 'vanish', 'variable', 'variation', 'variety', 'various', 'vary', 'vast', 'vegetable', 'vehicle', 'venture',
                'version', 'versus', 'very', 'vessel', 'veteran', 'via', 'victim', 'victory', 'video', 'view', 'viewer', 'village',
                'violence', 'violent', 'virtual', 'virtually', 'virtue', 'virus', 'visible', 'vision', 'visit', 'visitor', 'visual',
                'vital', 'voice', 'volume', 'volunteer', 'vote', 'voter', 'vulnerable', 'wage', 'wait', 'wake', 'walk', 'wall', 'want',
                'war', 'warm', 'warn', 'warning', 'wash', 'waste', 'watch', 'water', 'wave', 'way', 'we', 'weak', 'wealth', 'wealthy',
                'weapon', 'wear', 'weather', 'web', 'website', 'wedding', 'week', 'weekend', 'weekly', 'weigh', 'weight', 'weird',
                'welcome', 'welfare', 'well', 'west', 'western', 'wet', 'what', 'whatever', 'wheel', 'when', 'whenever', 'where',
                'whereas', 'wherever', 'whether', 'which', 'while', 'whisper', 'white', 'who', 'whoever', 'whole', 'whom', 'whose',
                'why', 'wide', 'widely', 'widespread', 'wife', 'wild', 'will', 'willing', 'win', 'wind', 'window', 'wine', 'wing',
                'winner', 'winter', 'wipe', 'wire', 'wise', 'wish', 'with', 'withdraw', 'within', 'without', 'witness', 'woman', 'wonder',
                'wonderful', 'wood', 'wooden', 'wool', 'word', 'work', 'worker', 'working', 'workplace', 'workshop', 'world', 'worldwide',
                'worry', 'worse', 'worst', 'worth', 'would', 'wound', 'wrap', 'write', 'writer', 'writing', 'written', 'wrong', 'yard',
                'year', 'yellow', 'yes', 'yesterday', 'yet', 'you', 'young', 'your', 'yours', 'yourself', 'youth', 'zone'
            ])
        };
    }

    // Event Listeners
    initializeEventListeners() {
        // Main buttons
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyzeText());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearText());
        
        // Modal controls
        document.getElementById('vocabularyBtn').addEventListener('click', () => this.openVocabularyModal());
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettingsModal());
        document.getElementById('closeVocabModal').addEventListener('click', () => this.closeModal('vocabularyModal'));
        document.getElementById('closeSettingsModal').addEventListener('click', () => this.closeModal('settingsModal'));
        
        // Vocabulary controls
        document.getElementById('exportVocabBtn').addEventListener('click', () => this.exportVocabulary());
        document.getElementById('importVocabBtn').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.importVocabulary(e));
        document.getElementById('clearVocabBtn').addEventListener('click', () => this.clearVocabulary());
        
        // Settings controls
        document.getElementById('exportSettingsBtn').addEventListener('click', () => this.exportSettings());
        document.getElementById('importSettingsBtn').addEventListener('click', () => document.getElementById('importSettingsFile').click());
        document.getElementById('importSettingsFile').addEventListener('change', (e) => this.importSettings(e));
        
        // Settings updates
        document.getElementById('highlightOpacity').addEventListener('input', (e) => {
            document.getElementById('opacityValue').textContent = Math.round(e.target.value * 100) + '%';
            this.settings.highlightOpacity = e.target.value;
            this.saveSettings();
        });
        
        document.getElementById('highlightColor').addEventListener('change', (e) => {
            this.settings.highlightColor = e.target.value;
            this.saveSettings();
        });
        
        // Close modals when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
    }

    // Text Analysis
    async analyzeText() {
        const text = document.getElementById('textInput').value.trim();
        if (!text) {
            alert('Please enter some text to analyze.');
            return;
        }

        this.showLoading(true);
        
        try {
            const words = this.extractWords(text);
            const difficultyLevel = document.getElementById('difficultyLevel').value;
            const highlightMode = document.getElementById('highlightMode').value;
            
            const analysis = this.analyzeWords(words, difficultyLevel, highlightMode);
            this.displayAnalyzedText(text, analysis);
            this.updateStatistics(analysis);
            
            document.getElementById('analyzedTextSection').style.display = 'block';
            document.getElementById('statistics').style.display = 'flex';
            
        } catch (error) {
            console.error('Analysis error:', error);
            alert('Error analyzing text. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    extractWords(text) {
        return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 0);
    }

    analyzeWords(words, difficultyLevel, highlightMode) {
        const analysis = {
            totalWords: words.length,
            highlightedWords: [],
            newWords: [],
            difficultyScore: 0,
            wordFrequency: {}
        };

        // Count word frequency
        words.forEach(word => {
            analysis.wordFrequency[word] = (analysis.wordFrequency[word] || 0) + 1;
        });

        // Analyze each unique word
        const uniqueWords = [...new Set(words)];
        uniqueWords.forEach(word => {
            const difficulty = this.getWordDifficulty(word, difficultyLevel);
            const isHighlighted = this.shouldHighlight(word, difficulty, highlightMode);
            
            if (isHighlighted) {
                analysis.highlightedWords.push({
                    word: word,
                    difficulty: difficulty,
                    frequency: analysis.wordFrequency[word],
                    translation: this.getTranslation(word)
                });
                
                if (!this.vocabulary.has(word)) {
                    analysis.newWords.push(word);
                }
            }
            
            analysis.difficultyScore += difficulty.score;
        });

        analysis.difficultyScore = Math.round(analysis.difficultyScore / uniqueWords.length);
        
        return analysis;
    }

    getWordDifficulty(word, difficultyLevel) {
        const levels = ['common', 'beginner', 'intermediate', 'advanced'];
        const levelIndex = levels.indexOf(difficultyLevel);
        
        for (let i = 0; i <= levelIndex; i++) {
            if (this.wordDatabase[levels[i]].has(word)) {
                return {
                    level: levels[i],
                    score: i * 25,
                    className: levels[i]
                };
            }
        }
        
        return {
            level: 'expert',
            score: 100,
            className: 'unknown'
        };
    }

    shouldHighlight(word, difficulty, highlightMode) {
        switch (highlightMode) {
            case 'unknown':
                return difficulty.level === 'expert' || difficulty.level === 'advanced';
            case 'difficult':
                return difficulty.level === 'expert' || difficulty.level === 'advanced' || difficulty.level === 'intermediate';
            case 'all':
                return true;
            default:
                return false;
        }
    }

    getTranslation(word) {
        // Mock translation - in a real app, you'd call a translation API
        const translations = {
            'hello': '你好',
            'world': '世界',
            'beautiful': '美丽的',
            'amazing': '令人惊叹的',
            'wonderful': '精彩的',
            'fantastic': '极好的',
            'excellent': '优秀的',
            'outstanding': '杰出的',
            'remarkable': '非凡的',
            'extraordinary': '非凡的'
        };
        
        return translations[word] || 'Translation not available';
    }

    displayAnalyzedText(originalText, analysis) {
        const analyzedTextDiv = document.getElementById('analyzedText');
        let processedText = originalText;
        
        // Create a map of highlighted words for quick lookup
        const highlightedMap = {};
        analysis.highlightedWords.forEach(item => {
            highlightedMap[item.word] = item;
        });
        
        // Replace words with highlighted versions
        const words = this.extractWords(originalText);
        const uniqueWords = [...new Set(words)];
        
        uniqueWords.forEach(word => {
            if (highlightedMap[word]) {
                const regex = new RegExp(`\\b${word}\\b`, 'gi');
                processedText = processedText.replace(regex, `<span class="highlighted-word ${highlightedMap[word].difficulty.className}" data-word="${word}" data-translation="${highlightedMap[word].translation}">${word}</span>`);
            }
        });
        
        analyzedTextDiv.innerHTML = processedText;
        
        // Add hover events for highlighted words
        analyzedTextDiv.querySelectorAll('.highlighted-word').forEach(element => {
            element.addEventListener('mouseenter', (e) => this.showTooltip(e));
            element.addEventListener('mouseleave', () => this.hideTooltip());
            element.addEventListener('click', (e) => this.addToVocabulary(e.target.dataset.word, e.target.dataset.translation));
        });
    }

    updateStatistics(analysis) {
        document.getElementById('totalWords').textContent = analysis.totalWords;
        document.getElementById('highlightedWords').textContent = analysis.highlightedWords.length;
        document.getElementById('newWords').textContent = analysis.newWords.length;
        document.getElementById('difficultyScore').textContent = analysis.difficultyScore;
        document.getElementById('vocabCount').textContent = this.vocabulary.size;
    }

    // Tooltip functionality
    showTooltip(event) {
        const word = event.target.dataset.word;
        const translation = event.target.dataset.translation;
        
        const tooltip = document.getElementById('translationTooltip');
        document.getElementById('tooltipWord').textContent = word;
        document.getElementById('tooltipTranslation').textContent = translation;
        
        const rect = event.target.getBoundingClientRect();
        tooltip.style.left = rect.left + 'px';
        tooltip.style.top = (rect.bottom + 5) + 'px';
        tooltip.classList.add('show');
        
        // Update add to vocab button
        document.getElementById('addToVocabBtn').onclick = () => {
            this.addToVocabulary(word, translation);
            this.hideTooltip();
        };
    }

    hideTooltip() {
        document.getElementById('translationTooltip').classList.remove('show');
    }

    // Vocabulary management
    addToVocabulary(word, translation) {
        if (!this.vocabulary.has(word)) {
            this.vocabulary.set(word, {
                translation: translation,
                addedDate: new Date().toISOString(),
                reviewCount: 0
            });
            this.saveVocabulary();
            this.updateUI();
            this.showNotification(`"${word}" added to vocabulary!`);
        } else {
            this.showNotification(`"${word}" is already in your vocabulary!`);
        }
    }

    openVocabularyModal() {
        this.displayVocabularyList();
        document.getElementById('vocabularyModal').classList.add('show');
    }

    displayVocabularyList() {
        const vocabList = document.getElementById('vocabList');
        vocabList.innerHTML = '';
        
        if (this.vocabulary.size === 0) {
            vocabList.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 2rem;">No words in vocabulary yet.</p>';
            return;
        }
        
        const sortedVocab = Array.from(this.vocabulary.entries()).sort((a, b) => 
            new Date(b[1].addedDate) - new Date(a[1].addedDate)
        );
        
        sortedVocab.forEach(([word, data]) => {
            const vocabItem = document.createElement('div');
            vocabItem.className = 'vocab-item';
            vocabItem.innerHTML = `
                <div>
                    <div class="vocab-word">${word}</div>
                    <div class="vocab-translation">${data.translation}</div>
                </div>
                <div class="vocab-actions">
                    <button class="btn btn-sm btn-danger" onclick="wordDiscoverer.removeFromVocabulary('${word}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            vocabList.appendChild(vocabItem);
        });
    }

    removeFromVocabulary(word) {
        if (confirm(`Remove "${word}" from vocabulary?`)) {
            this.vocabulary.delete(word);
            this.saveVocabulary();
            this.displayVocabularyList();
            this.updateUI();
            this.showNotification(`"${word}" removed from vocabulary.`);
        }
    }

    clearVocabulary() {
        if (confirm('Clear all vocabulary? This action cannot be undone.')) {
            this.vocabulary.clear();
            this.saveVocabulary();
            this.displayVocabularyList();
            this.updateUI();
            this.showNotification('Vocabulary cleared.');
        }
    }

    exportVocabulary() {
        const data = {
            vocabulary: Array.from(this.vocabulary.entries()),
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        this.downloadJSON(data, 'vocabulary.json');
        this.showNotification('Vocabulary exported successfully!');
    }

    importVocabulary(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.vocabulary) {
                    this.vocabulary = new Map(data.vocabulary);
                    this.saveVocabulary();
                    this.displayVocabularyList();
                    this.updateUI();
                    this.showNotification('Vocabulary imported successfully!');
                } else {
                    throw new Error('Invalid file format');
                }
            } catch (error) {
                alert('Error importing vocabulary. Please check the file format.');
            }
        };
        reader.readAsText(file);
    }

    // Settings management
    openSettingsModal() {
        this.loadSettingsToUI();
        document.getElementById('settingsModal').classList.add('show');
    }

    loadSettingsToUI() {
        document.getElementById('highlightColor').value = this.settings.highlightColor;
        document.getElementById('highlightOpacity').value = this.settings.highlightOpacity;
        document.getElementById('opacityValue').textContent = Math.round(this.settings.highlightOpacity * 100) + '%';
        document.getElementById('translationService').value = this.settings.translationService;
        document.getElementById('targetLanguage').value = this.settings.targetLanguage;
    }

    exportSettings() {
        const data = {
            settings: this.settings,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        this.downloadJSON(data, 'settings.json');
        this.showNotification('Settings exported successfully!');
    }

    importSettings(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.settings) {
                    this.settings = { ...this.settings, ...data.settings };
                    this.saveSettings();
                    this.loadSettingsToUI();
                    this.showNotification('Settings imported successfully!');
                } else {
                    throw new Error('Invalid file format');
                }
            } catch (error) {
                alert('Error importing settings. Please check the file format.');
            }
        };
        reader.readAsText(file);
    }

    // Utility functions
    clearText() {
        document.getElementById('textInput').value = '';
        document.getElementById('analyzedTextSection').style.display = 'none';
        document.getElementById('statistics').style.display = 'none';
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('show');
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('show');
        } else {
            overlay.classList.remove('show');
        }
    }

    showNotification(message) {
        // Simple notification - could be enhanced with a proper notification system
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 3000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    updateUI() {
        document.getElementById('vocabCount').textContent = this.vocabulary.size;
    }

    // Data persistence
    loadVocabulary() {
        const saved = localStorage.getItem('wordDiscovererVocabulary');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                return new Map(data);
            } catch (error) {
                console.error('Error loading vocabulary:', error);
            }
        }
        return new Map();
    }

    saveVocabulary() {
        localStorage.setItem('wordDiscovererVocabulary', JSON.stringify(Array.from(this.vocabulary.entries())));
    }

    loadSettings() {
        const defaultSettings = {
            highlightColor: '#ffeb3b',
            highlightOpacity: 0.7,
            translationService: 'bing',
            targetLanguage: 'zh'
        };
        
        const saved = localStorage.getItem('wordDiscovererSettings');
        if (saved) {
            try {
                return { ...defaultSettings, ...JSON.parse(saved) };
            } catch (error) {
                console.error('Error loading settings:', error);
            }
        }
        return defaultSettings;
    }

    saveSettings() {
        localStorage.setItem('wordDiscovererSettings', JSON.stringify(this.settings));
    }
}

// Initialize the application
let wordDiscoverer;
document.addEventListener('DOMContentLoaded', () => {
    wordDiscoverer = new WordDiscoverer();
});
