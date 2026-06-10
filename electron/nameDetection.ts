/** 日记正文中的中文人名启发式检测（非 NER，侧重称呼与常见姓氏组合） */

const CJK = '\\u4e00-\\u9fff';

/** 常见单姓（覆盖绝大多数日记场景） */
const SINGLE_SURNAMES = new Set(
  '李王张刘陈杨赵黄周吴徐孙胡朱高林何郭马罗梁宋郑谢韩唐冯于董萧程曹袁邓许傅沈曾彭吕苏卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田任姜范方石姚谭廖邹熊金陆郝孔白崔康毛邱秦江史顾侯邵孟龙万段雷钱汤尹黎易常武乔贺赖龚文庞樊兰殷施陶洪翟安颜倪严牛温芦季俞章鲁葛伍韦申尤毕聂丛焦向柳邢路岳齐梅莫庄辛管祝左涂谷祁时舒耿牟卜詹关苗凌费纪靳盛童欧甄项曲成游阳裴席卫查屈鲍位覃霍翁隋植甘景薄单包司柏宁柯阮桂闵解强柴华车冉房边辜吉饶刁瞿戚丘古米池滕晋苑邬臧畅宫来苟全褚廉简娄盖符奚木穆党燕郎邸冀隗冷訾阚那空毋乜养须丰巢蒯相荆红竺权逯益桓闫汝鄢段干百里东郭南门呼延归海羊舌微生岳帅缑亢况后有琴梁丘左丘东门西门商佘佴伯赏南宫墨哈谯笪年爱阳佟第五言福'.split(
    '',
  ),
);

/** 高置信称呼 / 关系词，命中即纳入候选 */
const RELATION_TERMS = [
  '妈妈', '爸爸', '母亲', '父亲', '爸妈', '爷爷', '奶奶', '姥姥', '姥爷', '外公', '外婆',
  '姐姐', '哥哥', '弟弟', '妹妹', '儿子', '女儿', '老公', '老婆', '丈夫', '妻子',
  '闺蜜', '室友', '同事', '老板', '领导', '老师', '同学', '朋友', '男友', '女友',
  '对象', '同桌', '邻居', '阿姨', '叔叔', '舅舅', '姑姑', '伯伯', '嫂子', '姐夫',
  '妹夫', '表弟', '表姐', '堂哥', '堂姐', '外婆', '外公',
];

const BLACKLIST = new Set([
  '今天', '明天', '昨天', '上午', '下午', '晚上', '早上', '中午', '时候', '一点',
  '很好', '非常', '真的', '觉得', '知道', '没有', '什么', '怎么', '自己', '我们',
  '他们', '她们', '这个', '那个', '因为', '所以', '然后', '还是', '已经', '可能',
  '应该', '开始', '结束', '回家', '公司', '学校', '工作', '生活', '心情', '感觉',
  '有点', '一些', '一下', '一起', '一直', '不过', '而且', '如果', '虽然', '但是',
  '可以', '不能', '不会', '不想', '不要', '需要', '希望', '打算', '准备', '终于',
  '突然', '渐渐', '慢慢', '马上', '立刻', '最近', '平时', '经常', '有时', '偶尔',
  '每年', '每月', '每天', '今年', '去年', '明年', '本月', '上周', '下周', '这周',
  '春节', '元旦', '国庆', '中秋', '端午', '清明', '周末', '假期', '节日', '天气',
  '下雨', '晴天', '阴天', '太阳', '月亮', '星星', '春天', '夏天', '秋天', '冬天',
  '吃饭', '睡觉', '起床', '洗澡', '出门', '回来', '路上', '地铁', '公交', '打车',
  '电影', '电视', '手机', '电脑', '游戏', '音乐', '运动', '跑步', '健身', '旅游',
  '旅行', '出差', '开会', '加班', '下班', '上班', '考试', '复习', '作业', '论文',
  '项目', '客户', '产品', '方案', '问题', '事情', '情况', '结果', '原因', '办法',
  '地方', '房间', '厨房', '客厅', '卧室', '阳台', '门口', '楼下', '楼上', '附近',
  '医院', '超市', '商场', '公园', '河边', '海边', '山上', '城里', '乡下', '老家',
  '北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '西安', '重庆',
  '一点', '两点', '三点', '四点', '五点', '六点', '七点', '八点', '九点', '十点',
  '哈哈', '呵呵', '嗯嗯', '好的', '好吧', '算了', '没事', '当然', '肯定', '绝对',
  '完全', '特别', '十分', '相当', '比较', '更加', '越来越', '原来', '本来', '其实',
  '毕竟', '反正', '总之', '话说', '听说', '看见', '遇到', '碰到', '认识', '了解',
  '明白', '记得', '忘记', '想起', '担心', '害怕', '紧张', '兴奋', '开心', '高兴',
  '难过', '伤心', '生气', '郁闷', '无聊', '疲惫', '劳累', '舒服', '难受', '痛苦',
]);

interface NameScore {
  name: string;
  totalCount: number;
  entryDays: number;
  highConfidence: boolean;
}

function countSubstringOccurrences(text: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}

function isValidCandidate(name: string): boolean {
  if (name.length < 2 || name.length > 8) return false;
  if (BLACKLIST.has(name)) return false;
  if (!/^[\u4e00-\u9fff]+$/.test(name)) return false;
  return true;
}

function addCandidate(
  map: Map<string, NameScore>,
  name: string,
  highConfidence: boolean,
): void {
  if (!isValidCandidate(name)) return;
  const existing = map.get(name);
  if (existing) {
    if (highConfidence) existing.highConfidence = true;
    return;
  }
  map.set(name, { name, totalCount: 0, entryDays: 0, highConfidence });
}

function extractCandidatesFromText(text: string): string[] {
  const found: string[] = [];

  for (const term of RELATION_TERMS) {
    if (text.includes(term)) found.push(term);
  }

  const patterns: RegExp[] = [
    new RegExp(`(?:和|跟|见|找|给|约|问|叫|陪|与|让|帮)([${CJK}]{2,3})`, 'g'),
    new RegExp(`([${CJK}]{2,3})(?:说|告诉我|跟我说|对我说|给他|给她|跟他说|跟她说)`, 'g'),
    new RegExp(`@([${CJK}]{2,4})`, 'g'),
    new RegExp(`([${CJK}]{2,3})的(?:家|妈|爸|哥|姐|弟|妹|老师|老板)`, 'g'),
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      found.push(m[1]);
    }
  }

  const surnameRe = new RegExp(
    `(?:^|[\\s，。！？、；：""''（）\\[\\]【】\\n])` +
      `([${CJK}][${CJK}]{1,2})` +
      `(?:[说去往来到的了吗呢吧啊呀]|[\\s，。！？、；：])`,
    'g',
  );
  let sm: RegExpExecArray | null;
  while ((sm = surnameRe.exec(text)) !== null) {
    const name = sm[1];
    if (SINGLE_SURNAMES.has(name[0])) found.push(name);
  }

  return found;
}

function scoreCandidates(byDate: Map<string, string>): NameScore[] {
  const candidateMap = new Map<string, NameScore>();

  for (const [, content] of byDate) {
    for (const raw of extractCandidatesFromText(content)) {
      addCandidate(candidateMap, raw, RELATION_TERMS.includes(raw));
    }
  }

  for (const score of candidateMap.values()) {
    for (const [, content] of byDate) {
      const n = countSubstringOccurrences(content, score.name);
      if (n > 0) {
        score.totalCount += n;
        score.entryDays++;
      }
    }
  }

  return [...candidateMap.values()];
}

export interface DetectNamesOptions {
  maxNames?: number;
  minTotalCount?: number;
  minEntryDays?: number;
}

/**
 * 扫描全部日记正文，返回按出现次数排序的候选人名。
 * 高置信词（称呼）出现 1 次即可；其余需满足次数或天数阈值。
 */
export function detectPersonNames(
  byDate: Map<string, string>,
  options: DetectNamesOptions = {},
): string[] {
  const {
    maxNames = 20,
    minTotalCount = 2,
    minEntryDays = 2,
  } = options;

  if (byDate.size === 0) return [];

  const scored = scoreCandidates(byDate)
    .filter(
      (s) =>
        s.highConfidence ||
        s.totalCount >= minTotalCount ||
        s.entryDays >= minEntryDays,
    )
    .sort((a, b) => {
      if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
      return b.entryDays - a.entryDays;
    });

  return scored.slice(0, maxNames).map((s) => s.name);
}
