/**
 * mock API：卡片信息 / 用户搜索 / 图片上传
 *
 * fetchCardInfo 按卡片类型返回贴近 B 站接口结构的完整 info，
 * 模板层（core/cards/templates）据此渲染 20 种卡片视图。
 * 宿主通过 createEditor({ api }) 注入真实实现；不注入时使用本 mock。
 */
import type {
  CardInfo,
  CardType,
  CardVariant,
  EditorApi,
  FavoriteFolder,
  GameSearchItem,
  UserInfo,
  VideoPostItem,
} from '../../core/types'

/** 模拟网络延迟（ms） */
const mockDelay = 600

/** 延迟工具 */
function delay<T>(value: T, ms = mockDelay): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms)
  })
}

/** 默认头像（内联 SVG dataURL，离线/无图环境下也能正常显示） */
const DEFAULT_AVATAR = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">' +
    '<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#fb7299"/><stop offset="1" stop-color="#23ade5"/>' +
    '</linearGradient></defs>' +
    '<rect width="120" height="120" rx="60" fill="url(#a)"/>' +
    '<circle cx="60" cy="46" r="20" fill="#fff" opacity=".92"/>' +
    '<path d="M24 112c4-22 20-32 36-32s32 10 36 32z" fill="#fff" opacity=".92"/>' +
    '</svg>',
)}`

/** 渐变占位封面（内联 SVG dataURL，demo 无网络也能看到完整版式） */
function svgCover(label: string, from: string, to: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
    `</linearGradient></defs>` +
    `<rect width="320" height="180" fill="url(#g)"/>` +
    `<text x="50%" y="54%" font-family="sans-serif" font-size="26" ` +
    `fill="rgba(255,255,255,.92)" text-anchor="middle" dominant-baseline="middle">${label}</text>` +
    `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** 当前时间戳（秒） */
function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

/** 卡片来源名 */
function sourceNameOf(cardType: CardType): string {
  const map: Record<CardType, string> = {
    video: '哔哩哔哩视频',
    topVideo: '置顶视频',
    opus: '哔哩哔哩图文',
    comment: '哔哩哔哩评论',
    vote: '哔哩哔哩投票',
    music: '哔哩哔哩音乐',
    toy: '哔哩哔哩玩具',
    mall: '会员购展览',
    mallGoods: '会员购商品',
    goods: '哔哩哔哩商品',
    manga: '哔哩哔哩漫画',
    live: '哔哩哔哩直播',
    game: '哔哩哔哩游戏',
    bangumi: '哔哩哔哩番剧',
    user: '哔哩哔哩用户',
    generic: '哔哩哔哩',
  }
  return map[cardType]
}

/** 组装 CardInfo：info 为模板读取的完整业务字段 */
function makeCard(options: {
  cardType: CardType
  refId: string
  variant: CardVariant
  cardStyle: 0 | 1
  info: Record<string, unknown>
  title: string
  desc: string
  cover: string
  badge: string
  extraOptions?: Record<string, unknown>
}): CardInfo {
  const data = JSON.stringify({ info: options.info, ...options.extraOptions })
  return {
    cardType: options.cardType,
    variant: options.variant,
    refId: options.refId,
    title: options.title,
    desc: options.desc,
    cover: options.cover,
    sourceName: sourceNameOf(options.cardType),
    badge: options.badge,
    data,
    status: 'loaded',
    cardStyle: options.cardStyle,
    icon: '',
    extra: data,
  }
}

/** 视频卡片（detailed / player 由 refId 是否含 player 决定；?t= 解析为起播时间） */
function buildVideoCard(refId: string, top: boolean): CardInfo {
  const player = top || refId.includes('player')
  const cover = svgCover('KALAMOS VIDEO', '#fb7299', '#23ade5')
  const startMatch = /\?t=(\d+)/.exec(refId)
  const info = {
    title: '从零实现一个富文本编辑器：20 种卡片 1:1 复刻',
    cover,
    duration: 754,
    start_time: startMatch === null ? 132 : Number(startMatch[1]),
    video_ts: {
      duration: 754,
      start_time: startMatch === null ? 132 : Number(startMatch[1]),
    },
    stat_infos: [
      { type: 'VIDEO_VIEW_INFO', text: '25.8万' },
      { type: 'VIDEO_DANMAKU_INFO', text: '3.9万' },
    ],
    badge: { text: '热门', head_icon: '' },
  }
  return makeCard({
    cardType: top ? 'topVideo' : 'video',
    refId,
    variant: top ? 'top' : player ? 'player' : 'detailed',
    cardStyle: player ? 1 : 0,
    info,
    title: info.title,
    desc: '龟龟家的猫 · 3天前',
    cover,
    badge: '热门',
  })
}

/** 图文卡片 */
function buildOpusCard(refId: string): CardInfo {
  const cover = svgCover('KALAMOS OPUS', '#23ade5', '#7c4dff')
  const info = {
    title: 'kalamos 2.0 发布：20 种卡片与纯 SSR 渲染',
    content: '这次我们把 B 站 York 编辑器的卡片全家桶搬进了 kalamos。',
    pics: [{ url: cover }],
    author: { name: '龟龟家的猫' },
    view: '1.2万 阅读',
    reply: '233 评论',
    publish_text: '2026-10-20 12:00 发布',
    badge: '专栏',
    is_only_fans: false,
  }
  return makeCard({
    cardType: 'opus',
    refId,
    variant: 'default',
    cardStyle: 0,
    info,
    title: info.title,
    desc: info.content,
    cover,
    badge: '专栏',
  })
}

/** 评论卡片（basic / advanced / screenshot 由 refId 后缀决定） */
function buildCommentCard(refId: string): CardInfo {
  const variant: CardVariant = refId.includes('screenshot')
    ? 'screenshot'
    : refId.includes('basic')
      ? 'basic'
      : 'advanced'
  const cover = svgCover('KALAMOS VIDEO', '#fb7299', '#23ade5')
  const info = {
    user: {
      name: '低调的播放器',
      uid: '4',
      avatar: DEFAULT_AVATAR,
      level: '',
      name_sub_text: '3天前 发布了评论',
    },
    content: '这个卡片的还原度也太高了吧，连圆角、字重和图标都对上了。',
    thumbup: { count: 1204, is_thumbup: true, is_up_thumbup: true },
    source: {
      desc: '哔哩哔哩',
      title: '【kalamos】从零实现富文本编辑器',
      thumbnail: cover,
      type: '1',
    },
    parent_comment: {
      author_name: '龟龟家的猫',
      content: '感谢支持，卡片模板已经和 SSR 共用同一份实现。',
    },
    pics: variant === 'screenshot' ? [{ url: svgCover('COMMENT PIC', '#00aeec', '#7c4dff') }] : [],
    link: 'https://www.bilibili.com/video/BV1kalamos01',
  }
  return makeCard({
    cardType: 'comment',
    refId,
    variant,
    cardStyle: 0,
    info,
    title: '这个卡片的还原度也太高了吧',
    desc: '低调的播放器 发布了评论',
    cover,
    badge: '1204 赞',
  })
}

/** 投票卡片 */
function buildVoteCard(refId: string): CardInfo {
  const info = {
    title: '你最喜欢哪一种卡片样式？',
    desc: '投票截止后会展示结果',
    join_num: 4580,
    end_time: nowSeconds() + 7 * 86400,
    choice_cnt: 1,
    owner_mode: false,
    my_votes: [],
    options: [
      { opt_idx: 0, opt_desc: '视频卡片', cnt: 1820 },
      { opt_idx: 1, opt_desc: '评论卡片', cnt: 1420 },
      { opt_idx: 2, opt_desc: '番剧卡片', cnt: 1340 },
    ],
  }
  return makeCard({
    cardType: 'vote',
    refId,
    variant: 'default',
    cardStyle: 0,
    info,
    title: info.title,
    desc: info.desc,
    cover: '',
    badge: '进行中',
  })
}

/** 音乐卡片 */
function buildMusicCard(refId: string): CardInfo {
  const cover = svgCover('KALAMOS MUSIC', '#7c4dff', '#fb7299')
  const info = {
    title: '夜航星',
    up_name: '虚拟歌手',
    cover_url: cover,
    intro: 'kalamos 原声集 · 第 3 首',
    duration_text: '04:16',
  }
  return makeCard({
    cardType: 'music',
    refId,
    variant: 'default',
    cardStyle: 0,
    info,
    title: info.title,
    desc: info.up_name,
    cover,
    badge: '04:16',
  })
}

/** 玩具卡片（link / card 由 refId 是否含 link 决定） */
function buildToyCard(refId: string): CardInfo {
  const link = refId.includes('link')
  const cover = svgCover('KALAMOS TOY', '#ff9f1c', '#fb7299')
  const info = {
    title: '星尘系列手办 · 限定版',
    poster: cover,
    tag_text: '玩具',
    up: { name: 'kalamos 小店' },
    stat_text: '2.3万 播放',
    btn_text: '去看看',
    jump_uri: 'https://www.bilibili.com',
    show_text: '星尘系列手办',
  }
  return makeCard({
    cardType: 'toy',
    refId,
    variant: link ? 'link' : 'card',
    cardStyle: link ? 0 : 1,
    info,
    title: info.title,
    desc: 'kalamos 小店',
    cover,
    badge: '玩具',
    extraOptions: { showText: '星尘系列手办' },
  })
}

/** 会员购展览 */
function buildMallCard(refId: string): CardInfo {
  const cover = svgCover('KALAMOS EXPO', '#00aeec', '#7c4dff')
  const start = nowSeconds() + 14 * 86400
  const info = {
    name: '2026 kalamos 主题展 · 上海站',
    performance_image: cover,
    start_time: start,
    end_time: start + 10 * 86400,
    province_name: '上海',
    city_name: '上海',
    district_name: '浦东新区',
    venue_name: '新国际博览中心',
    price_low: 128,
  }
  return makeCard({
    cardType: 'mall',
    refId,
    variant: 'default',
    cardStyle: 0,
    info,
    title: info.name,
    desc: '上海 · 新国际博览中心',
    cover,
    badge: '售票中',
  })
}

/** 商品卡片（goods / mallGoods 价格单位不同） */
function buildGoodsCard(refId: string, mallGoods: boolean): CardInfo {
  const cover = svgCover(mallGoods ? 'MALL GOODS' : 'GOODS', '#fb7299', '#ff9f1c')
  const info = mallGoods
    ? { goodsName: 'kalamos 会员购限定周边', price: 12900, mainImgUrl: cover }
    : { goodsName: 'kalamos 编辑器主题键帽', price: 59.9, mainImgUrl: cover }
  return makeCard({
    cardType: mallGoods ? 'mallGoods' : 'goods',
    refId,
    variant: 'default',
    cardStyle: 0,
    info,
    title: info.goodsName,
    desc: mallGoods ? '¥ 129.00' : '¥ 59.9',
    cover,
    badge: mallGoods ? '会员购' : '商品',
  })
}

/** 漫画卡片 */
function buildMangaCard(refId: string): CardInfo {
  const cover = svgCover('MANGA', '#7c4dff', '#00aeec')
  const info = {
    title: 'kalamos 漫画物语',
    author: ['画师小卡'],
    vertical_cover: cover,
    evaluate: '连载中 · 每周五更新',
  }
  return makeCard({
    cardType: 'manga',
    refId,
    variant: 'default',
    cardStyle: 0,
    info,
    title: info.title,
    desc: '画师小卡',
    cover,
    badge: '连载中',
  })
}

/** 直播卡片 */
function buildLiveCard(refId: string): CardInfo {
  const cover = svgCover('LIVE', '#fb7299', '#ff6699')
  const info = {
    title: '一起来玩播放器开发挑战！',
    uname: '龟龟家的猫',
    cover,
    area_v2_name: '知识 · 编程',
    online: 10240,
    live_status: 1,
  }
  return makeCard({
    cardType: 'live',
    refId,
    variant: 'default',
    cardStyle: 0,
    info,
    title: info.title,
    desc: info.uname,
    cover,
    badge: '直播中',
  })
}

/** 游戏卡片 */
function buildGameCard(refId: string): CardInfo {
  const cover = svgCover('GAME', '#23ade5', '#7c4dff')
  const info = {
    game_name: '像素编辑器大冒险',
    game_icon: cover,
    game_tags: '独立 · 像素 · 模拟经营',
    summary: '用富文本编辑器搭建属于你的像素世界。',
  }
  return makeCard({
    cardType: 'game',
    refId,
    variant: 'default',
    cardStyle: 0,
    info,
    title: info.game_name,
    desc: info.game_tags,
    cover,
    badge: '游戏',
  })
}

/** 番剧卡片 */
function buildBangumiCard(refId: string): CardInfo {
  const cover = svgCover('BANGUMI', '#00aeec', '#fb7299')
  const info = {
    title: 'kalamos 的奇妙冒险',
    cover,
    badgeText: '更新至第 12 话',
    followText: '9.5 分 · 1.2万人追番',
    followActionText: '追番',
  }
  return makeCard({
    cardType: 'bangumi',
    refId,
    variant: 'default',
    cardStyle: 0,
    info,
    title: info.title,
    desc: info.followText,
    cover,
    badge: info.badgeText,
  })
}

/** 用户名片 */
function buildUserCard(refId: string): CardInfo {
  const info = {
    user: {
      mid: refId.length > 0 ? refId : '3',
      name: '龟龟家的猫',
      face: DEFAULT_AVATAR,
      relation: { status: 0 },
    },
    follower: '405 粉丝',
    like: '233 获赞',
    desc: '喵呜，每天都要发电',
  }
  return makeCard({
    cardType: 'user',
    refId,
    variant: 'default',
    cardStyle: 0,
    info,
    title: info.user.name,
    desc: info.desc,
    cover: DEFAULT_AVATAR,
    badge: '405 粉丝',
  })
}

/** 通用卡片 */
function buildGenericCard(refId: string): CardInfo {
  const cover = svgCover('LINK', '#9499a0', '#61666d')
  const info = {
    title: 'kalamos 官方文档',
    description: '三层架构、Markdown 管线与 20 种卡片渲染说明',
    cover,
  }
  return makeCard({
    cardType: 'generic',
    refId,
    variant: 'default',
    cardStyle: 0,
    info,
    title: info.title,
    desc: info.description,
    cover,
    badge: '',
  })
}

/** 按类型生成 mock 卡片信息（demo 与 NodeView 共用） */
export function createMockCardInfo(cardType: CardType, refId: string): CardInfo {
  switch (cardType) {
    case 'video':
      return buildVideoCard(refId, false)
    case 'topVideo':
      return buildVideoCard(refId, true)
    case 'opus':
      return buildOpusCard(refId)
    case 'comment':
      return buildCommentCard(refId)
    case 'vote':
      return buildVoteCard(refId)
    case 'music':
      return buildMusicCard(refId)
    case 'toy':
      return buildToyCard(refId)
    case 'mall':
      return buildMallCard(refId)
    case 'mallGoods':
      return buildGoodsCard(refId, true)
    case 'goods':
      return buildGoodsCard(refId, false)
    case 'manga':
      return buildMangaCard(refId)
    case 'live':
      return buildLiveCard(refId)
    case 'game':
      return buildGameCard(refId)
    case 'bangumi':
      return buildBangumiCard(refId)
    case 'user':
      return buildUserCard(refId)
    default:
      return buildGenericCard(refId)
  }
}

/** 内置 mock 用户表 */
const mockUsers: UserInfo[] = [
  { id: '1', name: '爱发电的阿伟', avatar: DEFAULT_AVATAR, sign: '每天发电一点点', fans: '1.2万 粉丝' },
  { id: '2', name: '科学的哈基米', avatar: DEFAULT_AVATAR, sign: '科学发电', fans: '8362 粉丝' },
  { id: '3', name: '龟龟家的猫', avatar: DEFAULT_AVATAR, sign: '喵呜', fans: '405 粉丝' },
  { id: '4', name: '低调的播放器', avatar: DEFAULT_AVATAR, sign: '播放器开发者', fans: '22 粉丝' },
]

/** mock 我的投稿列表（视频弹窗「我的投稿」tab） */
const mockPosts: VideoPostItem[] = [
  {
    aid: '4001',
    bvid: 'BV1kalamos01',
    title: '从零实现一个富文本编辑器：20 种卡片 1:1 复刻',
    cover: svgCover('KALAMOS VIDEO', '#fb7299', '#23ade5'),
    duration: 754,
    author: '龟龟家的猫',
    view: '25.8万',
    pubdate: '2026-10-27',
    cornerBadge: '',
  },
  {
    aid: '4002',
    bvid: 'BV1kalamos02',
    title: 'SSR 纯展示渲染：Node 与浏览器共用同一份实现',
    cover: svgCover('KALAMOS SSR', '#23ade5', '#7c4dff'),
    duration: 486,
    author: '龟龟家的猫',
    view: '8.4万',
    pubdate: '2026-10-21',
    cornerBadge: '',
  },
  {
    aid: '4003',
    bvid: 'BV1kalamos03',
    title: '弹幕列表 1:1 移植：DOM 结构与滚动行为对齐',
    cover: svgCover('KALAMOS DM', '#00aeec', '#23ade5'),
    duration: 1042,
    author: '龟龟家的猫',
    view: '12.3万',
    pubdate: '2026-10-14',
    cornerBadge: '充电专属',
  },
  {
    aid: '4004',
    bvid: 'BV1kalamos04',
    title: 'QtPlayer 零拷贝渲染：从 AVFoundation 到 Direct3D',
    cover: svgCover('KALAMOS QT', '#ff9f1c', '#fb7299'),
    duration: 1873,
    author: '龟龟家的猫',
    view: '3.2万',
    pubdate: '2026-10-08',
    cornerBadge: '',
  },
  {
    aid: '4005',
    bvid: 'BV1kalamos05',
    title: '互动视频全流程：转码 / 剧情树 / 播放器联动',
    cover: svgCover('KALAMOS IVW', '#7c4dff', '#00aeec'),
    duration: 921,
    author: '龟龟家的猫',
    view: '6.7万',
    pubdate: '2026-09-30',
    cornerBadge: '',
  },
  {
    aid: '4006',
    bvid: 'BV1kalamos06',
    title: 'GPU 加速转码实战：SegmentBase DASH 与 HLS 双协议',
    cover: svgCover('KALAMOS GPU', '#fb7299', '#ff6699'),
    duration: 1345,
    author: '龟龟家的猫',
    view: '1.9万',
    pubdate: '2026-09-22',
    cornerBadge: '',
  },
]

/** mock 收藏夹列表（视频弹窗「我的收藏」tab 左侧导航） */
const mockFavoriteFolders: FavoriteFolder[] = [
  { id: 'fav-1', title: '播放器开发合集', count: 2 },
  { id: 'fav-2', title: '编辑器 / 前端技术', count: 1 },
]

/** mock 收藏夹内视频表（folderId → 视频列表） */
const mockFavoriteVideos: Record<string, VideoPostItem[]> = {
  // slice 组合避免索引访问的 undefined 联合类型
  'fav-1': mockPosts.slice(0, 1).concat(mockPosts.slice(3, 4)),
  'fav-2': mockPosts.slice(1, 2),
}

/** mock 游戏搜索表（游戏弹窗「搜索添加」tab，模糊过滤） */
const mockGames: GameSearchItem[] = [
  { gameBaseId: '1001', name: '像素编辑器大冒险', icon: svgCover('GAME 1', '#23ade5', '#7c4dff') },
  { gameBaseId: '1002', name: '弹幕物语', icon: svgCover('GAME 2', '#fb7299', '#23ade5') },
  { gameBaseId: '1003', name: '卡片收藏家', icon: svgCover('GAME 3', '#ff9f1c', '#fb7299') },
  { gameBaseId: '1004', name: '渲染工坊', icon: svgCover('GAME 4', '#00aeec', '#23ade5') },
  { gameBaseId: '1005', name: '番剧世界物语', icon: svgCover('GAME 5', '#7c4dff', '#fb7299') },
]

/** 构造 mock EditorApi */
export function createMockApi(): EditorApi {
  return {
    fetchCardInfo(cardType, refId) {
      // refId 为空时模拟「无法识别该链接」错误态
      if (refId.trim().length === 0) {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('cardNotFound')), mockDelay)
        })
      }
      return delay(createMockCardInfo(cardType, refId))
    },

    searchUser(keyword) {
      const kw = keyword.trim().toLowerCase()
      const filtered =
        kw.length === 0
          ? mockUsers
          : mockUsers.filter((user) => user.name.toLowerCase().includes(kw))
      return delay(filtered, 200)
    },

    uploadImage(file) {
      // 本地 FileReader 转 dataURL（demo 环境无上传服务）
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.addEventListener('load', () => {
          resolve({ src: String(reader.result) })
        })
        reader.addEventListener('error', () => {
          reject(new Error('uploadFailed'))
        })
        reader.readAsDataURL(file)
      })
    },

    fetchMyPosts() {
      return delay(mockPosts.slice())
    },

    fetchMyFavorites() {
      return delay(mockFavoriteFolders.slice())
    },

    fetchFavoriteVideos(folderId) {
      return delay((mockFavoriteVideos[folderId] ?? []).slice())
    },

    searchGames(keyword) {
      const kw = keyword.trim().toLowerCase()
      const filtered =
        kw.length === 0 ? mockGames : mockGames.filter((game) => game.name.toLowerCase().includes(kw))
      return delay(filtered, 300)
    },
  }
}
