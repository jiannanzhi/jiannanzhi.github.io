import { ChatBubble, readChatStore } from './readerChatRuntime';
import { getBookContent } from './bookContentStorage';

interface ChapterChat {
  chapterIndex: number | null;
  chapterTitle: string;
  messages: ChatBubble[];
}

interface BookChat {
  bookId: string;
  bookTitle: string;
  personaName: string;
  characterName: string;
  chapters: ChapterChat[];
}

export async function exportChatHistory(bookId: string): Promise<string> {
  const chatStore = readChatStore();
  const bookChats: BookChat[] = [];

  // 获取书名
  let bookTitle = '(书名)';
  try {
    const bookContent = await getBookContent(bookId);
    if (bookContent?.title) {
      bookTitle = bookContent.title;
    }
  } catch {
    // 忽略错误
  }

  // 遍历所有 conversation，找到属于这本书的
  Object.entries(chatStore).forEach(([conversationKey, bucket]) => {
    if (!conversationKey.includes(`book:${bookId}`)) return;

    const messages = bucket.messages || [];
    if (messages.length === 0) return;

    // 按章节分组
    const chapterMap = new Map<string, ChatBubble[]>();
    messages.forEach(msg => {
      const key = `${msg.chapterIndex ?? 'unknown'}::${msg.chapterTitle || '未知章节'}`;
      if (!chapterMap.has(key)) chapterMap.set(key, []);
      chapterMap.get(key)!.push(msg);
    });

    // 转换成数组
    const chapters: ChapterChat[] = [];
    chapterMap.forEach((msgs, key) => {
      const [indexStr, title] = key.split('::');
      const index = indexStr === 'unknown' ? null : parseInt(indexStr);
      chapters.push({
        chapterIndex: index,
        chapterTitle: title,
        messages: msgs.sort((a, b) => a.timestamp - b.timestamp),
      });
    });

    // 按章节索引排序
    chapters.sort((a, b) => {
      if (a.chapterIndex === null) return 1;
      if (b.chapterIndex === null) return -1;
      return a.chapterIndex - b.chapterIndex;
    });

    bookChats.push({
      bookId,
      bookTitle,
      personaName: bucket.personaName || '默认人设',
      characterName: bucket.characterName || '默认角色',
      chapters,
    });
  });

  // 生成 TXT
  let txt = '';
  bookChats.forEach(bookChat => {
    txt += `========================================\n`;
    txt += `书籍：${bookChat.bookTitle}\n`;
    txt += `角色：${bookChat.characterName}\n`;
    txt += `人设：${bookChat.personaName}\n`;
    txt += `========================================\n\n`;

    bookChat.chapters.forEach(chapter => {
      txt += `\n【${chapter.chapterTitle}】\n`;
      txt += `${'='.repeat(40)}\n\n`;

      chapter.messages.forEach(msg => {
        const time = new Date(msg.timestamp).toLocaleString('zh-CN');
        const sender = msg.sender === 'user' ? '我' : bookChat.characterName;
        txt += `[${time}] ${sender}：\n${msg.content}\n\n`;
      });
    });

    txt += `\n\n`;
  });

  return txt;
}

export function downloadChatHistory(bookId: string, bookTitle: string) {
  exportChatHistory(bookId).then(txt => {
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bookTitle}_聊天记录_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
