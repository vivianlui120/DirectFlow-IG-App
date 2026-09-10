/**
 * 地区热门标签库
 * 养号时根据指定地区搜索并浏览对应标签，强化账号地区属性
 * 每个地区包含多个热门标签，养号时随机选取
 */
const REGION_TAGS = {
  // 中国香港
  HK: {
    name: '香港',
    tags: ['香港', 'hkig', 'hkiger', 'hongkong', '香港美食', '香港打卡', 'hklife', 'discoverhongkong', '香港好去處', 'hkg'],
  },
  // 中国台湾
  TW: {
    name: '台湾',
    tags: ['台灣', 'taiwan', 'taipei', '台北', '台灣美食', '台中', '高雄', '台南', '台灣景點', 'igtaiwan'],
  },
  // 中国大陆
  CN: {
    name: '中国大陆',
    tags: ['中国', 'china', 'beijing', '上海', '深圳', '广州', '成都', '杭州', '中国美食', 'chinatravel'],
  },
  // 日本
  JP: {
    name: '日本',
    tags: ['japan', 'tokyo', '日本', '東京', 'osaka', 'kyoto', '日本美食', 'japantravel', 'ig_japan', 'tokyofashion'],
  },
  // 韩国
  KR: {
    name: '韩国',
    tags: ['korea', 'seoul', '韩国', '서울', 'koreatravel', 'koreanfood', 'korea_style', 'seoulfood', 'kfashion', 'kbeauty'],
  },
  // 美国
  US: {
    name: '美国',
    tags: ['usa', 'america', 'newyork', 'losangeles', 'california', 'usatravel', 'americanstyle', 'nyc', 'la', 'usafood'],
  },
  // 英国
  GB: {
    name: '英国',
    tags: ['uk', 'london', 'britain', 'england', 'londonlife', 'uktravel', 'british', 'londonfood', 'ukig', 'englandtravel'],
  },
  // 法国
  FR: {
    name: '法国',
    tags: ['france', 'paris', 'french', 'parisienne', 'francetravel', 'parisfashion', 'frenchfood', 'topparisphoto', 'parisjetaime', 'frenchstyle'],
  },
  // 德国
  DE: {
    name: '德国',
    tags: ['germany', 'deutschland', 'berlin', 'munich', 'germanytravel', 'berlinlife', 'germanfood', 'deutschland_greatshots', 'berlinstyle', 'germanyfood'],
  },
  // 意大利
  IT: {
    name: '意大利',
    tags: ['italy', 'italia', 'rome', 'milan', 'venice', 'italytravel', 'italianfood', 'italianstyle', 'roma', 'milano'],
  },
  // 西班牙
  ES: {
    name: '西班牙',
    tags: ['spain', 'espana', 'barcelona', 'madrid', 'spanish', 'spaintravel', 'spanishfood', 'barcelonagram', 'madridfood', 'españa'],
  },
  // 澳大利亚
  AU: {
    name: '澳大利亚',
    tags: ['australia', 'sydney', 'melbourne', 'aussie', 'australiatravel', 'sydneylife', 'melbournelife', 'australianfood', 'goldcoast', 'downunder'],
  },
  // 加拿大
  CA: {
    name: '加拿大',
    tags: ['canada', 'toronto', 'vancouver', 'montreal', 'canadatravel', 'torontolife', 'vancouverlife', 'canadianfood', 'explorecanada', 'canadalife'],
  },
  // 新加坡
  SG: {
    name: '新加坡',
    tags: ['singapore', 'sg', 'singaporefood', 'visitsingapore', 'sgfood', 'singaporelife', 'singaporetravel', 'igsg', 'sgig', 'singaporefoodie'],
  },
  // 马来西亚
  MY: {
    name: '马来西亚',
    tags: ['malaysia', 'kl', 'kualalumpur', 'malaysianfood', 'malaysiatrulyasia', 'malaysiafood', 'klfood', 'penang', 'malaysialife', 'igmalaysia'],
  },
  // 泰国
  TH: {
    name: '泰国',
    tags: ['thailand', 'bangkok', 'thai', 'thailandtravel', 'bangkokfood', 'thailandfood', 'phuket', 'chiangmai', 'thailandonly', 'bangkoklife'],
  },
  // 越南
  VN: {
    name: '越南',
    tags: ['vietnam', 'hanoi', 'hochiminh', 'vietnamtravel', 'vietnamesefood', 'vietnamfood', 'hanoifood', 'saigon', 'vietnamlife', 'vietnamphotography'],
  },
  // 印度尼西亚
  ID: {
    name: '印度尼西亚',
    tags: ['indonesia', 'jakarta', 'bali', 'indonesiatravel', 'indonesiafood', 'balilife', 'jakartafood', 'wonderfulindonesia', 'indonesia_photography', 'balifood'],
  },
  // 菲律宾
  PH: {
    name: '菲律宾',
    tags: ['philippines', 'manila', 'cebu', 'philippinestravel', 'philippinesfood', 'manilafood', 'wheninmanila', 'philippineslife', 'siargao', 'palawan'],
  },
  // 印度
  IN: {
    name: '印度',
    tags: ['india', 'mumbai', 'delhi', 'indiatravel', 'indianfood', 'mumbaifood', 'delhifood', 'indianstyle', 'india_ig', 'incredibleindia'],
  },
  // 阿联酋
  AE: {
    name: '阿联酋',
    tags: ['uae', 'dubai', 'abudhabi', 'dubailife', 'dubaifood', 'uaelife', 'dubaimall', 'dubaitravel', 'emirates', 'dubaistyle'],
  },
  // 巴西
  BR: {
    name: '巴西',
    tags: ['brazil', 'brasil', 'saopaulo', 'riodejaneiro', 'braziltravel', 'brazilianfood', 'saopaulofood', 'riolife', 'brasilfood', 'brazilstyle'],
  },
  // 墨西哥
  MX: {
    name: '墨西哥',
    tags: ['mexico', 'cdmx', 'mexicocity', 'mexicotravel', 'mexicanfood', 'mexicocityfood', 'tulum', 'cancun', 'mexicolife', 'mexicanstyle'],
  },
  // 俄罗斯
  RU: {
    name: '俄罗斯',
    tags: ['russia', 'moscow', 'saintpetersburg', 'russiatravel', 'moscowfood', 'russianfood', 'moscowlife', 'russia_photography', 'russianstyle', 'moscowcity'],
  },
  // 荷兰
  NL: {
    name: '荷兰',
    tags: ['netherlands', 'amsterdam', 'holland', 'dutch', 'amsterdamlife', 'netherlandstravel', 'dutchfood', 'amsterdamfood', 'holland_photography', 'dutchstyle'],
  },
  // 瑞典
  SE: {
    name: '瑞典',
    tags: ['sweden', 'stockholm', 'swedish', 'swedentravel', 'stockholmlife', 'swedishfood', 'scandinavia', 'swedenlife', 'stockholmfood', 'swedishstyle'],
  },
  // 瑞士
  CH: {
    name: '瑞士',
    tags: ['switzerland', 'zurich', 'geneva', 'swiss', 'switzerlandtravel', 'swissfood', 'zurichlife', 'swissalps', 'switzerlandfood', 'visitswitzerland'],
  },
  // 葡萄牙
  PT: {
    name: '葡萄牙',
    tags: ['portugal', 'lisbon', 'porto', 'portugaltravel', 'portuguesefood', 'lisbonfood', 'portofood', 'portugallife', 'visitportugal', 'lisboalife'],
  },
  // 奥地利
  AT: {
    name: '奥地利',
    tags: ['austria', 'vienna', 'austriatravel', 'viennalife', 'austrianfood', 'viennafood', 'austria_photography', 'salzburg', 'austrianstyle', 'visitaustria'],
  },
  // 比利时
  BE: {
    name: '比利时',
    tags: ['belgium', 'brussels', 'bruges', 'belgiumtravel', 'belgianfood', 'brusselsfood', 'belgiumlife', 'visitbelgium', 'flanders', 'wallonia'],
  },
  // 新西兰
  NZ: {
    name: '新西兰',
    tags: ['newzealand', 'auckland', 'queenstown', 'nz', 'newzealandtravel', 'nztravel', 'kiwi', 'newzealandfood', 'aucklandlife', 'purenewzealand'],
  },
};

// 所有地区代码列表
const ALL_REGIONS = Object.keys(REGION_TAGS);

/**
 * 获取指定地区的标签
 * @param {string} regionCode - 地区代码（如 HK、JP）或 'random'
 * @returns {Object} { code, name, tags }
 */
function getRegionTags(regionCode) {
  if (!regionCode || regionCode === 'random' || regionCode === 'RANDOM') {
    // 随机选择一个地区
    const randomCode = ALL_REGIONS[Math.floor(Math.random() * ALL_REGIONS.length)];
    return { code: randomCode, ...REGION_TAGS[randomCode] };
  }
  const upper = regionCode.toUpperCase();
  if (REGION_TAGS[upper]) {
    return { code: upper, ...REGION_TAGS[upper] };
  }
  // 未找到，返回随机
  const randomCode = ALL_REGIONS[Math.floor(Math.random() * ALL_REGIONS.length)];
  return { code: randomCode, ...REGION_TAGS[randomCode] };
}

/**
 * 从地区标签中随机选取指定数量
 * @param {string} regionCode
 * @param {number} count
 * @returns {string[]}
 */
function getRandomTags(regionCode, count = 3) {
  const region = getRegionTags(regionCode);
  const shuffled = [...region.tags].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * 获取所有地区选项（用于前端下拉框）
 * @returns {Array} [{ code, name }]
 */
function getRegionOptions() {
  return [
    { code: 'random', name: '随机国家' },
    ...ALL_REGIONS.map(code => ({ code, name: REGION_TAGS[code].name })),
  ];
}

module.exports = {
  REGION_TAGS,
  ALL_REGIONS,
  getRegionTags,
  getRandomTags,
  getRegionOptions,
};
