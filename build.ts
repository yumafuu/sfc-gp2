import YAML from "yaml";
import { mdToPdf } from "md-to-pdf";

import { PDFDocument } from "pdf-lib";

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
  figureTable: { name: string; page: number }[];
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

const pagenumSpan = (i: number) => {
  return `<span class="align-right font-mid"> ${i} </span>`;
};

const buildMokuji = (titles: [number, string, string][ ]) => {
  let content = "# 目次\n\n";
  content += "<section class='mokuji'>\n\n";
  for (let title of titles) {
    let [page, ver, str] = title;

    // の数を数えて、その数だけ`#`をつける
    const size = ver.split(".").length;
    const hprefix = `#`.repeat(size + 1);
    if (size === 1) {
      if (ver === "") ver = "";
      else ver = `第${ver}章`;
    }

    content += `${hprefix} ${ver} ${str}${pagenumSpan(page)}\n\n`;
  }
  content += "</section>";

  return content;
};

const buildZuMokuji = (zus: {name: string; page: number}[]) => {
  let content = "# 図目次\n\n";
  content += "<section class='mokuji'>\n\n";
  for (let zu of zus) {
    const { name, page } = zu;
    content += `${name}${pagenumSpan(page)}\n\n`;
  }
  content += "</section>";

  return content;
}

const build = async () => {
  const dir = import.meta.url.replace("/build.ts", "").replace("file://", "");
  const file = Bun.file(`${dir}/contents/content.yaml`);
  const yamlcontent = await file.text();

  const parsed: Document = YAML.parse(yamlcontent);

  let body = "";
  let mokujis: [number, string, string][] = [];
  const processSections = async (sections: Section[], page: number) => {
    for (let section of sections) {
      page = section.page || page;
      mokujis.push([page, section.index, section.title]);

      const indexsize = section.index.split(".").length;
      const mdprefix = `#`.repeat(indexsize);
      const indexstr = mdprefix === "#"
        ? section.index ? `第${section.index}章` : section.index
        : section.index;

      if (indexsize === 1) {
        body += pagerbreak;
      }
      body += `${mdprefix} ${indexstr} ${section.title}\n\n`;
      body += await getContent(section.content) + "\n";

      if (section.subsections) {
        await processSections(section.subsections, page);
      }
    }
  };
  await processSections(parsed.sections, 0);

  let mdcontent = "";
  const cover = await getContent(parsed.cover.content);
  mdcontent += cover;
  mdcontent += pagerbreak;
  mdcontent += pagerbreak;

  const summary = await getContent(parsed.summary.content);
  mdcontent += summary;
  mdcontent += pagerbreak;
  mdcontent += buildMokuji(mokujis);
  mdcontent += pagerbreak;
  mdcontent += buildZuMokuji(parsed.figureTable);
  mdcontent += body;

  const contentpdf = await mdToPdf({ content: mdcontent }, config as any);

  // Add page numbers
  const pdfDoc = await PDFDocument.load(contentpdf.content as any);
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
  const pdf = await pdfDoc.save();
  Bun.write("dist/main.pdf", pdf);

  const now = new Date().toLocaleString();
  console.log(`PDF generated successfully at ${now}`);
};

await build();
