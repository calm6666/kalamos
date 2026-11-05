/**
 * opus 展示页示例数据
 * URL / 文本 / 目录结构取自原站取证（docs/implementation.md §7.5），覆盖全部段落形态
 */
import type { OpusDisplayDoc, OpusDisplaySection, OpusTocItem } from '../core/opus/display'

/** 取证页面的真实图片地址（2026-10-29 复测均返回 200，无 referer 可访问） */
const picA = '//i0.hdslb.com/bfs/new_dyn/b0ab588f3d741caf5cd28fe88f589dd1374034429.jpg@420w_560h_1e_1c'
const picB = '//i0.hdslb.com/bfs/new_dyn/0946bafe25fbc13e9cfe912d8ba8f08b46845469.jpg@1192w'
const picC = '//i0.hdslb.com/bfs/new_dyn/4db3792e15bee59182d7ab869630ebf846845469.webp@948w_1114h'

/** 图文相册页作者（万扯淡动态页取证头像） */
const author = {
  name: '万扯淡',
  avatarUrl: '//i0.hdslb.com/bfs/face/e9c8f4e9dc988ea1af42398ca65f56263fd7c4df.jpg@74w_74h_1c_1s.webp',
  pubText: '2025-10-11 18:30',
  nameColor: '#FB7299',
}

/** 标题目录页作者（GUI_N，独立取证头像） */
const movieAuthor = {
  name: 'GUI_N',
  avatarUrl: '//i1.hdslb.com/bfs/face/1437dfa5a7a339b038723a3926a5559b0dd06d0e.jpg@74w_74h_1c_1s.webp',
  pubText: '2025-10-11 18:30',
  nameColor: '#FB7299',
}

/** 取证页面的完整目录（16 一级 + 14 号内嵌 6 二级） */
const tocItems: OpusTocItem[] = [
  { text: '1.钟离权出场造型' },
  { text: '2.初见大圣彩蛋' },
  { text: '3.张果老预判道馆会火和诈死' },
  { text: '4.韩湘子的关系' },
  { text: '5.「狗咬吕洞宾，不识好人心」' },
  { text: '6.「站起来，不准跪」' },
  { text: '7.让我想起了上辈子在天上做神仙的日子' },
  { text: '8.铁拐李“前身“' },
  { text: '9.“黄粱一梦”' },
  { text: '10.何仙姑专武' },
  { text: '11.孙悟空暗示出场' },
  { text: '12.「我叫你一声你敢答应吗」' },
  { text: '13.「踩着七彩祥云来」' },
  {
    text: '14.八仙本命法器亮相，剩余八仙介绍',
    children: [
      { text: '(一)钟离权：芭蕉扇' },
      { text: '（二）韩湘子：紫金箫' },
      { text: '（三）曹国舅-阴阳玉板' },
      { text: '（四）张果老-渔鼓' },
      { text: '（五）蓝采和-花篮' },
      { text: '（六）铁拐李-紫金葫芦' },
    ],
  },
  { text: '15.八仙死亡的不同形态' },
  { text: '16.贴个电影最后的彩蛋以及个人猜测' },
]

/** 一级标题段 */
function h1(text: string): OpusDisplaySection {
  return {
    node_type: 0,
    words: [{ node_type: 1, text, font_size: 17 }],
    paragraph_style: { heading_level: 1 },
  }
}

/** 二级标题段 */
function h2(text: string): OpusDisplaySection {
  return {
    node_type: 0,
    words: [{ node_type: 1, text, font_size: 17 }],
    paragraph_style: { heading_level: 2 },
  }
}

/** 普通文本段 */
function p(text: string): OpusDisplaySection {
  return { node_type: 0, words: [{ node_type: 1, text, font_size: 17 }] }
}

/** 展示页一：纯图文 + 相册（对齐 opus/1262391497954689049 形态） */
export const gallerySample: OpusDisplayDoc = {
  id: 'cv51546360',
  title: '《八仙！》观影记录：现场图与剧照合集',
  cover: { url: picA, height: 419 },
  author,
  topicName: '八仙电影🎥',
  sections: [
    p('上周去看了《八仙！》的首映，现场氛围非常好，整理了一些现场图与剧照， spoil 与否自行判断～'),
    {
      node_type: 2,
      pics: [
        { url: picA, width: 420, height: 560, caption: null },
        { url: picB, width: 1192, height: null, caption: null },
        { url: picC, width: 948, height: 1114, caption: null },
      ],
    },
    {
      node_type: 2,
      pics: [{ url: picC, width: 948, height: 1114, caption: '散场时的灯牌墙，人还蛮多的' }],
    },
    p('整体观感超出预期，钟离权的出场造型尤其讲究，推荐没看过的朋友补个票。'),
  ],
  copyrightText: '本文为我原创，未经授权禁止转载',
}

/** 展示页二：标题/TOC/话题/高亮视频/大字级/失效卡（对齐 opus/1225703900149973011 形态） */
export const movieSample: OpusDisplayDoc = {
  id: 'cv51546361',
  title: '电影《八仙！》一些彩蛋致敬和原典故设定（含剧透）【原作者，搬运自小黑盒】',
  cover: { url: '//i0.hdslb.com/bfs/new_dyn/1276b175e7f79d85b08a911be32528b346845469.jpg@1416w_798h_1c.webp', height: 419 },
  author: movieAuthor,
  topicName: '八仙电影🎥',
  toc: tocItems,
  sections: [
    p('以下内容涉及剧透，请酌情阅读。整理自原作者的小黑盒专栏，搬运已获授权。'),
    h1('1.钟离权出场造型'),
    p('钟离权的出场造型完全对齐「八仙过海」连环画里的经典形象：袒胸露乳、手持芭蕉扇，连扇面上的纹路都有出处。'),
    h1('2.初见大圣彩蛋'),
    p('这个镜头一闪而过，但背景壁画上赫然是齐天大圣的剪影，属于制作组埋给二创观众的第一颗糖。'),
    h1('5.「狗咬吕洞宾，不识好人心」'),
    {
      node_type: 0,
      words: [
        { node_type: 1, text: '这句歇后语的化用是全片最密集的笑点段落，', font_size: 17 },
        { node_type: 1, text: '吕洞宾的每一次救人都在为后文的反转铺路', font_size: 17, bold: true },
        { node_type: 1, text: '，台词节奏极佳。', font_size: 17 },
      ],
    },
    h1('12.「我叫你一声你敢答应吗」'),
    p('紫金葫芦的收人桥段与《西游记》银角大王一段形成互文，配音甚至找回了同一位老艺术家。'),
    h1('13.「踩着七彩祥云来」'),
    p('致敬段落直接使用了《大话西游》的经典 BGM 改编版，影厅里此起彼伏都是会心的笑声。'),
    {
      node_type: 0,
      words: [
        { node_type: 1, text: '关于八仙的原型考证，可以参考这篇视频：', font_size: 17 },
        {
          node_type: 3,
          link_type: 'url',
          show_text: '【考据向】八仙故事源流梳理',
          url: 'https://www.bilibili.com/video/BV1GJ411x7h7',
          video: true,
        },
      ],
    },
    { node_type: 7, tip: '此内容无法展示' },
    h1('14.八仙本命法器亮相，剩余八仙介绍'),
    h2('(一)钟离权：芭蕉扇'),
    p('芭蕉扇能扇出清风与业火两面，是全片出场率最高的法器。'),
    h2('（二）韩湘子：紫金箫'),
    p('紫金箫声能安魂定魄，对应「笛箫仙人」的原典设定。'),
    h2('（三）曹国舅-阴阳玉板'),
    p('玉板可分可合，合则为盾，分则为刃。'),
    h2('（四）张果老-渔鼓'),
    p('渔鼓敲响时会有倒转时空的幻象，是「张果老倒骑驴」的视觉化。'),
    h2('（五）蓝采和-花篮'),
    p('花篮中百花各有其用，对应踏歌行乞的蓝采和本传。'),
    h2('（六）铁拐李-紫金葫芦'),
    p('葫芦收妖的桥段前面已经提过，这里补一个细节：葫芦塞上的纹样是云雷纹。'),
    h1('16.贴个电影最后的彩蛋以及个人猜测'),
    p('片尾字幕后还有一段隐藏剧情，暗示续作会引入东海龙宫线，等一个官方确认。'),
  ],
  copyrightText: '本文为我原创，未经授权禁止转载',
}
