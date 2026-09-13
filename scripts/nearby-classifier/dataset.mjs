import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const BUSINESS_LABELS = [
  '粤菜',
  '川菜',
  '湘菜',
  '火锅',
  '烧烤',
  '螺蛳粉',
  '日料',
  '韩餐',
  '西餐',
  '东南亚菜',
  '东北菜',
  '云南菜',
  '面食',
  '轻食',
  '甜品奶茶',
  '海鲜',
];

export const OTHER_LABEL = '其他';
export const ALL_LABELS = [...BUSINESS_LABELS, OTHER_LABEL];
export const DATASET_SIZE = 1000;
export const BUSINESS_RECORDS_PER_LABEL = 55;
export const OTHER_RECORDS = 120;

const COMMON_CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安', '厦门', '南京'];
const COMMON_PREFIXES = ['老城', '街坊', '匠心', '一品', '拾味', '香满', '食光', '家传', '城市', '小满'];
const COMMON_SUFFIXES = ['馆', '小馆', '餐厅', '食府', '餐饮店', '料理店'];

const CATEGORY_PROFILES = {
  粤菜: {
    amapTypes: ['餐饮服务|中餐厅|广东菜(粤菜)', '餐饮服务|中餐厅|综合酒楼', '餐饮服务|中餐厅|海鲜酒楼', '餐饮服务|快餐厅|茶餐厅'],
    anchors: ['粤菜', '广式早茶', '烧鹅', '燒鵝', '叉烧', '煲仔饭', '肠粉', '点心', '點心', '广州味', '廣州味', '潮州菜', '广东菜', '茶餐厅'],
    brands: ['广州酒家', '陶陶居', '点都德', '利苑酒家', '翠园', '潮上潮'],
    regions: ['广府', '潮汕', '岭南', '广州', '廣州', '广东', '顺德', '佛山', '廣府'],
    neutral: ['云水轩', '南粤小馆', '珠江食府', '岭南食光', '榕树下', '茶点里'],
    curatedCases: [
      { name: '東園·廣州味·點心與燒鵝(农林·东山未来里店)', amap_type: '餐饮服务|中餐厅' },
      { name: '广州味点心烧鹅馆', amap_type: '餐饮服务|中餐厅' },
      { name: '廣州味點心燒鵝食府', amap_type: '餐饮服务|中餐厅' },
      { name: '广府点心与烧鹅', amap_type: '餐饮服务|中餐厅' },
      { name: '广州味粤菜馆', amap_type: '餐饮服务|中餐厅' },
      { name: '點心燒鵝酒樓', amap_type: '餐饮服务|中餐厅' },
      { name: '广东道至正家宴(东山宾馆店)', amap_type: '餐饮服务|中餐厅' },
      { name: '广东家宴粤菜馆', amap_type: '餐饮服务|中餐厅' },
    ],
  },
  川菜: {
    amapTypes: ['餐饮服务|中餐厅|四川菜(川菜)', '餐饮服务|中餐厅|四川菜', '餐饮服务|中餐厅|特色/地方风味餐厅'],
    anchors: ['川菜', '四川风味', '重庆菜', '重庆豆花', '豆花', '渝味', '渝菜', '重庆小面', '蜀味', '江湖菜', '麻辣', '水煮鱼', '回锅肉', '宫保鸡丁', '冒菜'],
    brands: ['眉州东坡', '小米椒川菜', '蜀香门第', '川西坝子', '辣府', '巴蜀人家'],
    regions: ['蜀地', '川西', '天府', '成都', '巴蜀', '锦城', '重庆', '渝'],
    neutral: ['红油坊', '蜀味小馆', '椒香里', '天府食光', '麻香居', '锦城味道'],
    curatedCases: [
      { name: '新渝城·重庆豆花馆(东山宾馆店)', amap_type: '餐饮服务|中餐厅' },
      { name: '重庆豆花馆', amap_type: '餐饮服务|中餐厅' },
      { name: '渝味豆花馆', amap_type: '餐饮服务|中餐厅' },
      { name: '重庆豆花川菜馆', amap_type: '餐饮服务|中餐厅' },
      { name: '渝城重庆小面', amap_type: '餐饮服务|中餐厅' },
      { name: '重庆味川菜馆', amap_type: '餐饮服务|中餐厅' },
      { name: '渝味江湖菜', amap_type: '餐饮服务|中餐厅' },
      { name: '重庆毛血旺馆', amap_type: '餐饮服务|中餐厅' },
      { name: '鼎盛蜀坊重庆江湖菜(东山口店)', amap_type: '餐饮服务|中餐厅' },
      { name: '蜀坊重庆江湖菜馆', amap_type: '餐饮服务|中餐厅' },
    ],
  },
  湘菜: {
    amapTypes: ['餐饮服务|中餐厅|湖南菜(湘菜)', '餐饮服务|中餐厅|湖南菜', '餐饮服务|中餐厅|特色/地方风味餐厅'],
    anchors: ['湘菜', '湖南风味', '剁椒鱼头', '小炒肉', '农家一碗香', '腊味合蒸', '湘味'],
    brands: ['费大厨', '炊烟小炒黄牛肉', '湘阁里辣', '望湘园', '湘遇', '辣椒树'],
    regions: ['湖湘', '潇湘', '长沙', '湘江', '岳阳', '衡阳'],
    neutral: ['湘里人家', '椒香湘厨', '潇湘食府', '小炒时光', '红辣椒馆', '湘味里'],
  },
  火锅: {
    amapTypes: ['餐饮服务|中餐厅|火锅店', '餐饮服务|火锅店', '餐饮服务|中餐厅|特色/地方风味餐厅'],
    anchors: ['火锅', '串串香', '麻辣锅', '牛油锅底', '涮肉', '重庆火锅', '鸳鸯锅'],
    brands: ['海底捞', '巴奴毛肚火锅', '小龙坎', '蜀大侠', '大龙燚', '珮姐老火锅'],
    regions: ['成都', '川渝', '北方', '老北京', '潮汕', '重庆火锅'],
    neutral: ['沸腾里', '围炉聚味', '一锅江湖', '热辣食光', '锅里乾坤', '沸点火锅'],
  },
  烧烤: {
    amapTypes: ['餐饮服务|中餐厅|烧烤', '餐饮服务|烧烤店', '餐饮服务|中餐厅|特色/地方风味餐厅'],
    anchors: ['烧烤', '烤串', '炭火烤肉', '烤羊肉串', '炭烧', '烤生蚝', '烧烤摊'],
    brands: ['很久以前羊肉串', '木屋烧烤', '丰茂烤串', '大理段公子烧烤', '火炉旁', '炭之家'],
    regions: ['东北', '新疆', '延边', '草原', '大漠', '街边'],
    neutral: ['炭火里', '夜猫子烧烤', '烟火人间', '串门儿', '火星烧烤', '烤味集'],
  },
  螺蛳粉: {
    amapTypes: ['餐饮服务|快餐厅|螺蛳粉', '餐饮服务|快餐厅|米粉店', '餐饮服务|快餐厅'],
    anchors: ['螺蛳粉', '柳州螺蛳粉', '螺丝粉', '酸笋螺蛳粉', '鸭脚螺蛳粉', '螺蛳粉店', '柳州米粉'],
    brands: ['李子柒螺蛳粉', '好欢螺', '柳螺记', '螺霸王', '嘻螺会', '柳州人家'],
    regions: ['柳州', '广西', '桂中', '柳江', '龙城', '螺城'],
    neutral: ['酸笋香', '柳味坊', '粉面江湖', '一碗螺香', '螺味研究所', '桂地粉铺'],
  },
  日料: {
    amapTypes: ['餐饮服务|外国餐厅|日本料理', '餐饮服务|日本料理', '餐饮服务|外国餐厅'],
    anchors: ['日料', '日本料理', '寿司', '刺身', '居酒屋', '天妇罗', '和食'],
    brands: ['吉兆寿司', '争鲜寿司', '元气寿司', '板前寿司', '鱼旨寿司', '小樽寿司'],
    regions: ['东京', '北海道', '大阪', '京都', '北海道', '关西'],
    neutral: ['和风食堂', '樱花里', '鱼町', '一番屋', '日和料理', '海町居酒屋'],
  },
  韩餐: {
    amapTypes: ['餐饮服务|外国餐厅|韩国料理', '餐饮服务|韩国料理', '餐饮服务|外国餐厅'],
    anchors: ['韩餐', '韩国料理', '韩式烤肉', '石锅拌饭', '泡菜锅', '部队锅', '冷面'],
    brands: ['汉拿山', '权金城', '金釜山', '韩宫宴', '火炉火', '首尔家'],
    regions: ['首尔', '釜山', '江南', '延边', '韩城', '仁川'],
    neutral: ['韩味馆', '首尔食堂', '泡菜之家', '釜山小馆', '炭火韩舍', '江南味道'],
  },
  西餐: {
    amapTypes: ['餐饮服务|外国餐厅|西餐厅(综合风味)', '餐饮服务|外国餐厅|意式菜品餐厅', '餐饮服务|外国餐厅|牛扒店(扒房)'],
    anchors: ['西餐', '牛排', '披萨', '意大利面', '意式料理', '汉堡', '扒房'],
    brands: ['必胜客', '萨莉亚', '王品牛排', '达美乐披萨', '蓝蛙', '芝乐坊'],
    regions: ['意式', '法式', '美式', '巴黎', '罗马', '纽约'],
    neutral: ['麦田西餐', '石窑披萨', '牛排工坊', '欧陆食光', '白胡椒西厨', '西岸餐吧'],
  },
  东南亚菜: {
    amapTypes: ['餐饮服务|外国餐厅|泰国/越南菜品餐厅', '餐饮服务|外国餐厅|其它亚洲菜', '餐饮服务|东南亚菜'],
    anchors: ['东南亚菜', '泰国菜', '越南菜', '冬阴功', '越南河粉', '叻沙', '泰式料理'],
    brands: ['泰妃殿', '暹罗天泰', '越小馆', '西贡妈妈', '南洋小馆', '泰香米'],
    regions: ['泰国', '越南', '曼谷', '清迈', '西贡', '南洋'],
    neutral: ['椰林食堂', '南洋风味', '香茅里', '热带食光', '椰香小馆', '暹罗厨房'],
  },
  东北菜: {
    amapTypes: ['餐饮服务|中餐厅|东北菜', '餐饮服务|中餐厅|特色/地方风味餐厅', '餐饮服务|中餐厅'],
    anchors: ['东北菜', '锅包肉', '铁锅炖', '小鸡炖蘑菇', '东北大拉皮', '杀猪菜', '地三鲜'],
    brands: ['东北人家', '老昌春饼', '大东北', '东北大食堂', '关东人家', '铁锅年代'],
    regions: ['东北', '关东', '哈尔滨', '长春', '沈阳', '吉林'],
    neutral: ['北国食府', '大炖菜', '关东小馆', '雪乡味道', '家乡锅台', '北方人家'],
  },
  云南菜: {
    amapTypes: ['餐饮服务|中餐厅|云贵菜', '餐饮服务|中餐厅|云南菜', '餐饮服务|中餐厅|特色/地方风味餐厅'],
    anchors: ['云南菜', '过桥米线', '云南米线', '野生菌', '汽锅鸡', '傣味', '滇味'],
    brands: ['云海肴', '原来是云南菜', '滇大池', '阿香米线', '彩云里', '菌彩云南'],
    regions: ['云南', '滇池', '大理', '昆明', '丽江', '西双版纳'],
    neutral: ['彩云食府', '菌香小馆', '滇味人家', '云岭厨房', '洱海边', '云上食光'],
  },
  面食: {
    amapTypes: ['餐饮服务|快餐厅|面馆', '餐饮服务|面馆', '餐饮服务|快餐厅'],
    anchors: ['面食', '兰州拉面', '牛肉面', '刀削面', '手擀面', '面条', '油泼面'],
    brands: ['中国兰州牛肉面', '陈香贵', '和府捞面', '遇见小面', '李先生牛肉面', '西贝莜面村'],
    regions: ['兰州', '山西', '陕西', '河南', '北方面食', '关中'],
    neutral: ['一面之缘', '面香居', '面馆里', '麦香小馆', '面面俱到', '手作面坊'],
  },
  轻食: {
    amapTypes: ['餐饮服务|休闲餐饮场所|轻食', '餐饮服务|轻食', '餐饮服务|休闲餐饮场所'],
    anchors: ['轻食', '沙拉', '低卡餐', '健身餐', '三明治', '能量碗', '健康餐'],
    brands: ['沙野轻食', '超级碗', '轻食主义', '薄荷健康', '好色派沙拉', '轻卡厨房'],
    regions: ['低卡', '轻盈', '健康', '元气', '活力', '清新'],
    neutral: ['绿叶食光', '轻盈厨房', '元气餐桌', '一碗清新', '蔬果日记', '阳光轻食'],
  },
  甜品奶茶: {
    amapTypes: ['餐饮服务|咖啡厅|咖啡厅', '餐饮服务|甜品店', '餐饮服务|冷饮店|奶茶店'],
    anchors: ['奶茶', '咖啡', '甜品', '蛋糕', '冰淇淋', '烘焙', '下午茶'],
    brands: ['喜茶', '奈雪的茶', '蜜雪冰城', '一点点', '瑞幸咖啡', '霸王茶姬'],
    regions: ['咖啡', '茶饮', '甜甜', '下午茶', '奶香', '烘焙'],
    neutral: ['糖水铺', '云朵甜品', '甜心工坊', '午后时光', '一口甜', '奶油研究所'],
  },
  海鲜: {
    amapTypes: ['餐饮服务|中餐厅|海鲜', '餐饮服务|海鲜餐厅', '餐饮服务|中餐厅|特色/地方风味餐厅'],
    anchors: ['海鲜', '海产', '生蚝', '海胆', '海鲜餐厅', '渔港', '海味'],
    brands: ['船歌鱼水饺', '海底捞海鲜', '海之鲜', '渔夫码头', '鲜活海产', '海味人家'],
    regions: ['渔港', '海滨', '东海', '南海', '沿海', '码头'],
    neutral: ['潮汐海鲜', '蓝海渔家', '鲜到家', '海边食府', '渔火里', '海味集'],
  },
};

const OTHER_NAME_ROOTS = [
  '好味道', '邻里食堂', '老地方', '食光里', '家常小馆', '城市餐厅', '悦食坊', '一品餐厅',
  '小聚馆', '美食城', '社区食堂', '味觉空间', '食客来', '家门口', '餐饮服务中心', '丰盛餐厅',
  '百味坊', '大食堂', '聚福楼', '好日子', '四季餐厅', '饭点见', '一桌菜', '食尚馆',
  '邻家味', '如意餐馆', '福满堂', '中心餐厅', '快乐餐饮', '广场美食',
];
const OTHER_LOCATIONS = ['城东', '城南', '城西', '城北'];
const OTHER_SUFFIXES = ['餐厅', '小馆', '食坊', '食堂'];
const OTHER_AMAP_TYPES = [
  '餐饮服务|中餐厅',
  '餐饮服务|外国餐厅',
  '餐饮服务|快餐厅',
  '餐饮服务|休闲餐饮场所',
  '餐饮相关场所|餐饮相关',
];

const OTHER_CURATED_CASES = [
  { name: '长禧家.珑厨(东山口店)', amap_type: '餐饮服务|中餐厅' },
  { name: '长禧家·珑厨', amap_type: '餐饮服务|中餐厅' },
  { name: '珑厨东山口店', amap_type: '餐饮服务|中餐厅' },
  { name: '味然香(执信店)', amap_type: '餐饮服务|中餐厅' },
  { name: '味然香', amap_type: '餐饮服务|中餐厅' },
  { name: '简·东山小厨家常菜', amap_type: '餐饮服务|中餐厅' },
  { name: '东山小厨家常菜', amap_type: '餐饮服务|中餐厅' },
  { name: '家宴小馆', amap_type: '餐饮服务|中餐厅' },
  { name: '邻里家常菜馆', amap_type: '餐饮服务|中餐厅' },
  { name: '一席家宴', amap_type: '餐饮服务|中餐厅' },
  { name: '四季小馆', amap_type: '餐饮服务|中餐厅' },
  { name: '老地方餐厅', amap_type: '餐饮服务|中餐厅' },
  { name: '家门口食府', amap_type: '餐饮服务|中餐厅' },
  { name: '食光里餐厅', amap_type: '餐饮服务|中餐厅' },
  { name: '福满楼餐馆', amap_type: '餐饮服务|中餐厅' },
  { name: '城南聚味餐厅', amap_type: '餐饮服务|中餐厅' },
];

const PATTERNS = ['brand', 'dish_and_type', 'region_and_style', 'amap_assisted', 'brand_and_type'];

export function createSeededRandom(seed) {
  let state = (Number(seed) >>> 0) || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(items, random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function pick(items, index, offset = 0) {
  return items[(index + offset) % items.length];
}

function createCuratedRecord(label, index, curatedCase) {
  return {
    id: `sample-${String(index).padStart(4, '0')}-${label}`,
    label,
    name: curatedCase.name,
    amap_type: curatedCase.amap_type,
    source: 'synthetic',
    pattern: 'curated_real_case',
  };
}

function cleanText(value) {
  return String(value).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function stripRestaurantNameParentheticals(value) {
  return cleanText(value)
    .replace(/\([^()]*\)|（[^（）]*）/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(value) {
  return cleanText(value).replace(/[ ·・_\-（）()]/g, '').toLowerCase();
}

function createBusinessRecord(label, profile, index) {
  const curatedCase = profile.curatedCases?.[index];
  if (curatedCase) return createCuratedRecord(label, index, curatedCase);

  const pattern = PATTERNS[index % PATTERNS.length];
  const city = pick(COMMON_CITIES, index, label.length);
  const prefix = pick(COMMON_PREFIXES, index, label.length);
  const suffix = pick(COMMON_SUFFIXES, index, label.length);
  const anchor = pick(profile.anchors, index, label.length);
  const brand = pick(profile.brands, Math.floor(index / 2), label.length);
  const region = pick(profile.regions, index, label.length);
  const neutral = pick(profile.neutral, index, label.length);

  const nameByPattern = {
    brand: `${brand}${index % 3 === 0 ? city : ''}`,
    dish_and_type: `${prefix}${anchor}${suffix}`,
    region_and_style: `${region}${neutral}${index % 2 === 0 ? '餐厅' : '小馆'}`,
    amap_assisted: `${neutral}${city}${index % 2 === 0 ? '店' : '馆'}`,
    brand_and_type: `${brand}${region}${index % 2 === 0 ? '店' : '餐厅'}`,
  };

  return {
    id: `sample-${String(index).padStart(4, '0')}-${label}`,
    label,
    name: cleanText(nameByPattern[pattern]),
    amap_type: pick(profile.amapTypes, index, label.length),
    source: 'synthetic',
    pattern,
  };
}

function createOtherRecord(index) {
  const curatedCase = OTHER_CURATED_CASES[index];
  if (curatedCase) {
    return createCuratedRecord(OTHER_LABEL, BUSINESS_RECORDS_PER_LABEL * BUSINESS_LABELS.length + index, curatedCase);
  }

  const root = pick(OTHER_NAME_ROOTS, index);
  const location = pick(OTHER_LOCATIONS, Math.floor(index / OTHER_NAME_ROOTS.length));
  const suffix = pick(OTHER_SUFFIXES, Math.floor(index / OTHER_NAME_ROOTS.length), index);
  return {
    id: `sample-${String(BUSINESS_RECORDS_PER_LABEL * BUSINESS_LABELS.length + index).padStart(4, '0')}-other`,
    label: OTHER_LABEL,
    name: `${location}${root}${suffix}`,
    amap_type: pick(OTHER_AMAP_TYPES, index, root.length),
    source: 'synthetic',
    pattern: index % 2 === 0 ? 'broad_amap' : 'ambiguous_name',
  };
}

export function generateDataset({ seed = 20260912 } = {}) {
  const records = [];
  for (const label of BUSINESS_LABELS) {
    const profile = CATEGORY_PROFILES[label];
    for (let index = 0; index < BUSINESS_RECORDS_PER_LABEL; index += 1) {
      records.push(createBusinessRecord(label, profile, index));
    }
  }
  for (let index = 0; index < OTHER_RECORDS; index += 1) {
    records.push(createOtherRecord(index));
  }
  const random = createSeededRandom(seed);
  const names = new Set();
  const uniqueRecords = records.map((record, index) => {
    let name = record.name;
    let collision = 0;
    while (names.has(normalizeName(name))) {
      collision += 1;
      name = `${record.name}${pick(COMMON_CITIES, index + collision)}${collision + 1}`;
    }
    names.add(normalizeName(name));
    return { ...record, name };
  });
  return shuffle(uniqueRecords, random);
}

export function toFastTextLine(record) {
  const name = stripRestaurantNameParentheticals(record.name).replace(/[|]/g, ' ').replace(/\s/g, '_');
  const amapFeatures = cleanText(record.amap_type)
    .split(/[|;]/)
    .flatMap((part) => part.split(/\s+/))
    .filter(Boolean)
    .map((part) => `amap_${part.replace(/[()（）/]/g, '_')}`);
  return `__label__${record.label} name_${name} ${amapFeatures.join(' ')}`;
}

export function validateDataset(records) {
  const errors = [];
  const counts = Object.fromEntries(ALL_LABELS.map((label) => [label, 0]));
  const ids = new Set();
  const names = new Set();

  if (!Array.isArray(records)) {
    return { counts, errors: ['records must be an array'] };
  }

  records.forEach((record, index) => {
    if (!record || typeof record !== 'object') {
      errors.push(`record ${index} must be an object`);
      return;
    }
    if (!ALL_LABELS.includes(record.label)) {
      errors.push(`record ${index} has unknown label: ${record.label}`);
    } else {
      counts[record.label] += 1;
    }
    if (!record.id) errors.push(`record ${index} id is empty`);
    if (ids.has(record.id)) errors.push(`record ${index} has duplicate id: ${record.id}`);
    ids.add(record.id);
    if (!record.name?.trim()) errors.push(`record ${index} name is empty`);
    const normalizedName = normalizeName(record.name ?? '');
    if (normalizedName && names.has(normalizedName)) errors.push(`record ${index} has duplicate name: ${record.name}`);
    if (normalizedName) names.add(normalizedName);
    if (!record.amap_type?.trim()) errors.push(`record ${index} amap_type is empty`);
    if (!record.source?.trim()) errors.push(`record ${index} source is empty`);
    if (!record.pattern?.trim()) errors.push(`record ${index} pattern is empty`);
  });

  return { counts, errors };
}

export function splitDataset(records, { seed = 20260912 } = {}) {
  const validation = validateDataset(records);
  if (validation.errors.length > 0) {
    throw new Error(`Cannot split invalid dataset: ${validation.errors[0]}`);
  }
  const random = createSeededRandom(seed);
  const train = [];
  const validationRecords = [];
  const test = [];
  const targetValidationCount = Math.floor(records.length * 0.1);
  const baseValidationCounts = Object.fromEntries(
    ALL_LABELS.map((label) => [label, Math.floor(records.filter((record) => record.label === label).length * 0.1)]),
  );
  let validationRemainder = targetValidationCount - Object.values(baseValidationCounts).reduce((sum, count) => sum + count, 0);

  for (const label of ALL_LABELS) {
    const group = shuffle(records.filter((record) => record.label === label), random);
    const validationCount = baseValidationCounts[label] + (validationRemainder > 0 ? 1 : 0);
    if (validationRemainder > 0) validationRemainder -= 1;
    const trainCount = Math.floor(group.length * 0.8);
    train.push(...group.slice(0, trainCount));
    validationRecords.push(...group.slice(trainCount, trainCount + validationCount));
    test.push(...group.slice(trainCount + validationCount));
  }

  return {
    train: shuffle(train, random),
    validation: shuffle(validationRecords, random),
    test: shuffle(test, random),
  };
}

export async function writeDatasetFiles({ outputDir, seed = 20260912 } = {}) {
  const records = generateDataset({ seed });
  const validation = validateDataset(records);
  if (validation.errors.length > 0) {
    throw new Error(`Generated invalid dataset: ${validation.errors[0]}`);
  }
  const partitions = splitDataset(records, { seed });
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'nearby-restaurant-classification.jsonl'), `${records.map((record) => JSON.stringify(record)).join('\n')}\n`);
  for (const [name, partition] of Object.entries(partitions)) {
    await writeFile(path.join(outputDir, `${name}.txt`), `${partition.map(toFastTextLine).join('\n')}\n`);
  }
  return { records, validation, partitions };
}

export async function readJsonl(filePath) {
  const content = await readFile(filePath, 'utf8');
  return content
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL at line ${index + 1}: ${error.message}`);
      }
    });
}
