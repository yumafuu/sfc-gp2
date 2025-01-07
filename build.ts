import YAML from "yaml";
import { mdToPdf } from "md-to-pdf";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";

const config = {
  stylesheet: ["style.css"],
  css: ``,
  body_class: ["markdown_body"],
  marked_options: {
    headerIds: false,
    smartypants: false,
  },
  pdf_options: {
    format: "A5",
    margin: "20mm",
  },
  stylesheet_encoding: "utf-8",
};


const pagerbreak = `<div class="page-break"></div>\n\n`;

export interface Document {
  cover: { content: string };
  summary: { content: string };
  sections: Section[];
}

export interface Section {
  title: string;
  index: string;
  content: string;
  page: number;
  subsections?: Section[];
}

const getContent = (content: string) => {
  const match = content.match(/file\(`(.*)`\)/);
  if (match) {
    const filepath = `contents/${match[1]}`;
    return (Bun.file(filepath)).text();
  } else {
    return content;
  }
};

const pagenumSpan = (i: string|number, id: string = "") => {
  return `<span class="align-right font-mid" id="${id}"> ${i} </span>`;
};

const buildMokuji = (titles: [string, string][ ]) => {
  let content = "# 目次\n\n";
  content += "<section class='mokuji'>\n\n";
  for (let title of titles) {
    let [ver, str] = title;

    // の数を数えて、その数だけ`#`をつける
    const size = ver.split(".").length;
    const hprefix = `#`.repeat(size + 1);
    if (size === 1) {
      if (ver === "") ver = "";
      else ver = `第${ver}章`;
    }

    content += `${hprefix} ${ver} ${str}${pagenumSpan(`{{ page:${ver||"+"+str} }}`)}\n\n`;
  }

  // 参考⽂献
  content += `## 参考⽂献 ${pagenumSpan(`{{ page:+参考⽂献 }}`)}\n\n`;
  content += "</section>";

  return content;
};

type Figure = {
  uid: string;
  name: string;
}
type Mokuji = [string, string]

const buildFiguresMokuji = (figures: Figure[]) => {
  let content = "# 図目次\n\n";
  content += "<section>\n\n";
  for (let fig of figures) {
    const { uid, name } = fig;
    content += `${uid} ${name} ${pagenumSpan(`{{ pagefig:${uid} }}`, `pagefig-${uid}`)}\n\n`;
  }
  content += "</section>";

  return content;
}

const buildRefs = (refs: string[]) => {
  let content = "# {{ pageindex:+参考⽂献 }} 参考文献";
  content += "<ul>\n\n";
  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i];
    content += `<li class="mt-[20px] nonlist">[${i + 1}] ${ref}</li>`;
  }
  content += "</ul>";

  return content;
}

const build = async () => {
  const dir = import.meta.url.replace("/build.ts", "").replace("file://", "");
  const file = Bun.file(`${dir}/contents/content.yaml`);
  const yamlcontent = await file.text();

  const parsed: Document = YAML.parse(yamlcontent);

  let body = "";
  let mokujis: Mokuji[] = []
  let figures: Figure[] = []; // list of uid
  let references: string[] = []
  let figindexes = {};
  const processSections = async (sections: Section[], page: number) => {
    for (let section of sections) {
      page = section.page || page;
      mokujis.push([section.index, section.title]);

      const indexsize = section.index.split(".").length;
      const mdprefix = `#`.repeat(indexsize);
      const indexstr = mdprefix === "#"
        ? section.index ? `第${section.index}章` : section.index
        : section.index;

      if (indexsize === 1) {
        body += pagerbreak;
      }
      body += `${mdprefix} {{ pageindex:${indexstr||"+" + section.title} }} ${section.title}\n\n`;

      const rawcontnt = await getContent(section.content) + "\n";
      // 参考文献 {{ ref:(ref content) }} を置換
      const refcontent = rawcontnt.replace(/\{\{\s*ref:\s*(.*?)\}\}/g, (_, ref) => {
        references.push(ref);
        return `[${references.length}]`;
      });

      // 図 {{ fig:(fig content) }} からfiguresを作成
      const figcontent = refcontent.replace(/\{\{\s*fig:\s*(.*?)\}\}/g, (_, name) => {
        const key = section.index[0]
        figindexes[key] = figindexes[key] ? figindexes[key] + 1 : 1;
        const i = figindexes[key];
        const uid = `${section.index[0]}.${i}`;

        const normalized = name.replace(/⽇/g, "日").replace(/⼊/g, "入"); // 文字コードが違う
        figures.push({ uid, name: normalized });
        return `図${uid} ${name}`;
      })

      body += figcontent;

      if (section.subsections) {
        await processSections(section.subsections, page);
      }
    }
  };
  await processSections(parsed.sections, 0);

  let rawmdcontent = "";
  const cover = await getContent(parsed.cover.content);
  rawmdcontent += cover;
  rawmdcontent += pagerbreak;
  rawmdcontent += pagerbreak;

  const summary = await getContent(parsed.summary.content);
  rawmdcontent += summary;
  rawmdcontent += pagerbreak;
  rawmdcontent += buildMokuji(mokujis);
  rawmdcontent += pagerbreak;
  rawmdcontent += buildFiguresMokuji(figures);
  rawmdcontent += body;
  rawmdcontent += pagerbreak;
  rawmdcontent += buildRefs(references);

  const rawpdfcontent = await mdToPdf({ content: rawmdcontent }, config as any);
  const pdfDocWithoutPageNum = await PDFDocument.load(rawpdfcontent.content as any);

  let mdcontent = rawmdcontent;
  let pdf = await pdfDocWithoutPageNum.save();
  const pdflibdoc = await pdfjsLib.getDocument(pdf).promise


  console.log({ mdcontent })
  const figpageoffset = 4
  const mokujipageoffset = 6
  // 全ページを順に走査
  for (let pageNum = 1; pageNum <= pdflibdoc.numPages; pageNum++) {
    const page = await pdflibdoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    const pageText = textContent.items.map((item) => item.str).join("");

    // 目次のページ番号を挿入 {{ pageindex:1.1 }} など
    pageText.replace(/\{\{\s*pageindex:\s*(.*?)\}\}/g, (match, uid) => {
      console.log({ match, uid })
      mdcontent = mdcontent.replace(`{{ page:${uid}}}`, `${pageNum - mokujipageoffset}`);
      if (uid[0] === "+") {
        console.log(`replacing ${uid} is + prefix`)
        mdcontent = mdcontent.replace(`{{ pageindex:${uid}}}`, ``);
      } else {
        mdcontent = mdcontent.replace(`{{ pageindex:${uid}}}`, `${uid}`);
      }

      return uid
    })

    // 図x.x をページ番号に置換
    pageText.replace(/図(\d+\.\d+)/g, (match, uid) => {
      mdcontent = mdcontent.replace(`{{ pagefig:${uid} }}`, `${pageNum - figpageoffset}`);

      return match
    })
  }

  const pdfcontent = await mdToPdf({ content: mdcontent }, config as any);
  const pdfDoc = await PDFDocument.load(pdfcontent.content as any);
  // PDFにページ番号を挿入
  const totalPages = pdfDoc.getPageCount();

  const romans = ["i", "ii", "iii", "iv", "v", "vi", "vii"];
  const metapageNum = 6;
  const startOffset = 2

  for (let i = 0; i < totalPages; i++) {
    if (i < startOffset) continue;

    const pagePdf = pdfDoc.getPage(i);
    let displayValue: string|number
    if (i < metapageNum) {
      displayValue = romans[i - startOffset];
    } else {
      displayValue = i - metapageNum + 1
    }

    const { width } = pagePdf.getSize();
    pagePdf.drawText(displayValue.toString(), {
      x: width / 2 - 10, // 中央寄せ
      y: 20, // 下からの位置
      size: 6,
    });
  }

  pdf = await pdfDoc.save();
  Bun.write("dist/main.pdf", pdf);

  const now = new Date().toLocaleString();
  console.log(`PDF generated successfully at ${now}`);
};

await build();
