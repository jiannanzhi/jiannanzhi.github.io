export type ImportedWorldBookInsertPosition = 'BEFORE' | 'AFTER';

export interface ImportedSillyTavernWorldBookEntry {
  title: string;
  content: string;
  insertPosition: ImportedWorldBookInsertPosition;
}

export interface ParsedSillyTavernCardResult {
  characterName: string;
  nickname: string;
  description: string;
  worldBookEntries: ImportedSillyTavernWorldBookEntry[];
  suggestedWorldBookCategory: string;
  shouldUseSourceFileAsAvatar: boolean;
}

export const SILLY_TAVERN_CARD_IMPORT_ACCEPT = '.png,.json';

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const UTF8_DECODER = new TextDecoder('utf-8');
const LATIN1_DECODER = new TextDecoder('latin1');

const compactText = (value: unknown) =>
  typeof value === 'string'
    ? value
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\u0000/g, '')
        .trim()
    : '';

const toSafeFileBaseName = (fileName: string) => {
  const trimmed = fileName.trim();
  const noExt = trimmed.replace(/\.[^./\\]+$/, '').trim();
  return noExt || '未命名角色';
};

const sanitizeSectionBlocks = (sections: Array<{ title: string; value: string }>) =>
  sections
    .map((section) => {
      const text = compactText(section.value);
      if (!text) return '';
      return `【${section.title}】\n${text}`;
    })
    .filter(Boolean)
    .join('\n\n');

const normalizeStringArray = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.map((item) => compactText(item)).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,，|｜;；\n]+/)
      .map((item) => compactText(item))
      .filter(Boolean);
  }
  return [];
};

const normalizeJsonLikeValue = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const text = compactText(value);
  if (!text) return value;
  if (!text.startsWith('{') && !text.startsWith('[')) return value;
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
};

const decodeBase64Utf8 = (raw: string) => {
  const compact = raw.replace(/\s+/g, '').trim();
  if (!compact) throw new Error('空的 Base64 数据');
  const normalized = compact.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return UTF8_DECODER.decode(bytes);
};

const parseJsonFromUnknownText = (rawText: string) => {
  const text = compactText(rawText);
  if (!text) {
    throw new Error('文件内容为空');
  }

  const directCandidate = text.startsWith('\uFEFF') ? text.slice(1) : text;
  try {
    return JSON.parse(directCandidate);
  } catch {
    // fallback to base64 JSON
  }

  const decodedBase64 = decodeBase64Utf8(directCandidate);
  return JSON.parse(decodedBase64);
};

const isPngFile = (file: File) =>
  /\.png$/i.test(file.name) || file.type.toLowerCase() === 'image/png';

const readPngTextChunk = (chunkData: Uint8Array) => {
  const separator = chunkData.indexOf(0);
  if (separator <= 0) return null;
  const keyword = LATIN1_DECODER.decode(chunkData.slice(0, separator)).trim();
  const text = LATIN1_DECODER.decode(chunkData.slice(separator + 1));
  if (!keyword) return null;
  return { keyword, text };
};

const readPngInternationalTextChunk = (chunkData: Uint8Array) => {
  const keywordEnd = chunkData.indexOf(0);
  if (keywordEnd <= 0) return null;
  const keyword = LATIN1_DECODER.decode(chunkData.slice(0, keywordEnd)).trim();
  if (!keyword) return null;

  let cursor = keywordEnd + 1;
  if (cursor + 2 > chunkData.length) return null;
  const compressionFlag = chunkData[cursor];
  cursor += 1; // compression flag
  cursor += 1; // compression method

  const languageEnd = chunkData.indexOf(0, cursor);
  if (languageEnd < 0) return null;
  cursor = languageEnd + 1;

  const translatedEnd = chunkData.indexOf(0, cursor);
  if (translatedEnd < 0) return null;
  cursor = translatedEnd + 1;

  if (compressionFlag === 1) {
    // SillyTavern cards are usually uncompressed tEXt.
    return null;
  }
  const text = UTF8_DECODER.decode(chunkData.slice(cursor));
  return { keyword, text };
};

const extractCandidateTextsFromPng = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < PNG_SIGNATURE.length) {
    throw new Error('PNG 文件过短，无法读取角色卡');
  }
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) {
      throw new Error('文件不是合法 PNG，无法读取 SillyTavern 角色卡');
    }
  }

  const candidates: Array<{ keyword: string; text: string }> = [];
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const chunkLength =
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3];
    if (chunkLength < 0) break;
    const chunkType = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;
    const crcEnd = dataEnd + 4;
    if (crcEnd > bytes.length) break;

    const chunkData = bytes.slice(dataStart, dataEnd);
    if (chunkType === 'tEXt') {
      const parsed = readPngTextChunk(chunkData);
      if (parsed) candidates.push(parsed);
    } else if (chunkType === 'iTXt') {
      const parsed = readPngInternationalTextChunk(chunkData);
      if (parsed) candidates.push(parsed);
    }

    if (chunkType === 'IEND') break;
    offset = crcEnd;
  }
  return candidates;
};

const extractCardDataNode = (json: any) => {
  const normalizedTop = normalizeJsonLikeValue(json) as any;
  if (!normalizedTop || typeof normalizedTop !== 'object') return null;

  const nestedData = normalizeJsonLikeValue((normalizedTop as any).data);
  if (nestedData && typeof nestedData === 'object') return nestedData as Record<string, any>;
  return normalizedTop as Record<string, any>;
};

const readCardJsonFromPng = async (file: File) => {
  const candidates = extractCandidateTextsFromPng(await file.arrayBuffer());
  if (candidates.length === 0) {
    throw new Error('PNG 内未找到文本元数据（tEXt/iTXt）');
  }

  const preferred = candidates.find((item) => item.keyword.toLowerCase() === 'chara');
  const ordered = preferred ? [preferred, ...candidates.filter((item) => item !== preferred)] : candidates;
  const errors: string[] = [];

  for (const candidate of ordered) {
    try {
      return parseJsonFromUnknownText(candidate.text);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      errors.push(`${candidate.keyword}: ${message}`);
    }
  }
  throw new Error(`PNG 元数据解析失败：${errors.join(' | ')}`);
};

const readCardJson = async (file: File) => {
  if (isPngFile(file)) {
    return readCardJsonFromPng(file);
  }
  const rawText = await file.text();
  return parseJsonFromUnknownText(rawText);
};

const resolveInsertPosition = (entry: any): ImportedWorldBookInsertPosition => {
  const raw = entry?.position ?? entry?.extensions?.position ?? entry?.extension?.position ?? '';
  if (typeof raw === 'number') return raw > 0 ? 'AFTER' : 'BEFORE';
  const text = String(raw || '').toLowerCase();
  if (!text) return 'BEFORE';
  if (text.includes('after') || text.includes('post') || text === '1') return 'AFTER';
  return 'BEFORE';
};

const buildImportedWorldBookEntries = (characterBook: any): ImportedSillyTavernWorldBookEntry[] => {
  if (!characterBook || typeof characterBook !== 'object') return [];
  const rawEntries = Array.isArray(characterBook.entries)
    ? characterBook.entries
    : characterBook.entries && typeof characterBook.entries === 'object'
      ? Object.values(characterBook.entries)
      : [];

  const worldBookEntries: ImportedSillyTavernWorldBookEntry[] = [];
  rawEntries.forEach((rawEntry: any, index: number) => {
    const entry = normalizeJsonLikeValue(rawEntry) as any;
    if (!entry || typeof entry !== 'object') return;
    const disabled = entry.enabled === false || entry.disable === true || entry.disabled === true;
    if (disabled) return;

    const primaryKeys = normalizeStringArray(entry.keys ?? entry.key ?? entry.keywords);
    const secondaryKeys = normalizeStringArray(entry.secondary_keys ?? entry.keysecondary ?? entry.secondaryKeys);
    const content = compactText(entry.content ?? entry.text ?? '');
    const comment = compactText(entry.comment ?? entry.name ?? '');

    const title =
      comment ||
      primaryKeys[0] ||
      secondaryKeys[0] ||
      `世界书条目 ${index + 1}`;

    const keyLines: string[] = [];
    if (primaryKeys.length > 0) keyLines.push(`关键词：${primaryKeys.join('、')}`);
    if (secondaryKeys.length > 0) keyLines.push(`次关键词：${secondaryKeys.join('、')}`);
    const mergedContent = [content, ...keyLines].filter(Boolean).join('\n');
    if (!mergedContent) return;

    worldBookEntries.push({
      title,
      content: mergedContent,
      insertPosition: resolveInsertPosition(entry),
    });
  });
  return worldBookEntries;
};

const buildCharacterDescription = (cardData: Record<string, any>) => {
  const description = compactText(cardData.description);
  const personality = compactText(cardData.personality);
  const systemPrompt = compactText(cardData.system_prompt ?? cardData.systemPrompt);
  const postHistoryInstructions = compactText(
    cardData.post_history_instructions ?? cardData.postHistoryInstructions
  );
  const scenario = compactText(cardData.scenario);
  const firstMessage = compactText(cardData.first_mes ?? cardData.firstMessage);
  const messageExample = compactText(cardData.mes_example ?? cardData.messageExample);
  const creatorNotes = compactText(cardData.creator_notes ?? cardData.creatorNotes);

  return sanitizeSectionBlocks([
    { title: '基础人设', value: description },
    { title: '性格补充', value: personality },
    { title: '高级人设-系统提示', value: systemPrompt },
    { title: '高级人设-历史后置指令', value: postHistoryInstructions },
    { title: '场景设定', value: scenario },
    { title: '开场白', value: firstMessage },
    { title: '示例对话', value: messageExample },
    { title: '作者备注', value: creatorNotes },
  ]);
};

export const parseSillyTavernCardFile = async (file: File): Promise<ParsedSillyTavernCardResult> => {
  const json = await readCardJson(file);
  const cardData = extractCardDataNode(json);
  if (!cardData) {
    throw new Error('未识别到角色卡数据结构');
  }

  const cardName = compactText(cardData.name) || toSafeFileBaseName(file.name);
  if (!cardName) {
    throw new Error('角色卡里没有角色名');
  }

  const description = buildCharacterDescription(cardData);
  if (!description) {
    throw new Error('角色卡缺少可导入的人设内容');
  }

  const worldBook = cardData.character_book ?? cardData.characterBook ?? null;
  const worldBookEntries = buildImportedWorldBookEntries(worldBook);
  const rawCategory = compactText(worldBook?.name);
  const suggestedWorldBookCategory = rawCategory || `${cardName}·世界书`;

  return {
    characterName: cardName,
    nickname: cardName,
    description,
    worldBookEntries,
    suggestedWorldBookCategory,
    shouldUseSourceFileAsAvatar: isPngFile(file),
  };
};
